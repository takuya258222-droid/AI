// HTTPリクエストの入口（Cloudflare Workers / Node 共通）
import { makeClient, verifySignature } from "./line.mjs";
import { handleEvent } from "./handler.mjs";
import { getStore } from "./store.mjs";
import { runFollowups } from "./followup.mjs";

const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json; charset=utf-8" } });

/** 画像などの公開URLの基準。環境変数があれば優先し、なければリクエストのオリジン */
export const baseUrl = (env, url) => (env.PUBLIC_BASE_URL || url.origin).replace(/\/$/, "");

export async function handleRequest(request, env, ctx) {
  const url = new URL(request.url);

  if (url.pathname === "/health") return json({ ok: true, service: "career-line-bot" });

  if (url.pathname === "/webhook") {
    if (request.method !== "POST") return json({ error: "method not allowed" }, 405);
    const raw = await request.text();
    const ok = await verifySignature(env.LINE_CHANNEL_SECRET, raw, request.headers.get("x-line-signature"));
    if (!ok) return json({ error: "invalid signature" }, 401);

    let body;
    try { body = JSON.parse(raw); } catch { return json({ error: "bad json" }, 400); }

    console.log(JSON.stringify({ evt: "webhook", types: (body.events ?? []).map((e) => e.type + (e.follow?.isUnblocked ? ":unblocked" : "")) }));
    const c = { client: makeClient(env), store: getStore(env), base: baseUrl(env, url), env, now: Date.now() };
    const results = await Promise.allSettled((body.events ?? []).map((e) => handleEvent(e, c)));
    for (const r of results) if (r.status === "rejected") console.log(JSON.stringify({ evt: "handler_error", msg: String(r.reason).slice(0, 300) }));
    return json({ ok: true });
  }

  return json({ error: "not found" }, 404);
}

/** Cron（毎時）: 診断後のフォロー配信 */
export async function scheduled(env) {
  const store = getStore(env);
  if (!store || !env.LINE_CHANNEL_ACCESS_TOKEN) return { skipped: true };
  const r = await runFollowups({ store, client: makeClient(env) });
  console.log(JSON.stringify({ evt: "followup_run", ...r }));
  return r;
}
