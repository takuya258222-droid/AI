// HTTPリクエストの入口（Cloudflare Workers / Node 共通）
import { makeClient, verifySignature } from "./line.mjs";
import { handleEvent } from "./handler.mjs";
import { getStore } from "./store.mjs";
import { runFollowups } from "./followup.mjs";
import { runDigest } from "./notefeed.mjs";
import { loadBudget } from "./budget.mjs";
import { runWeekly } from "./report.mjs";
import { bumpTag, bumpMany } from "./stats.mjs";
import { brand } from "./content.mjs";
import { prefilledChatUrl } from "./tools.mjs";

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
    const work = (async () => {
      const results = await Promise.allSettled((body.events ?? []).map((e) => handleEvent(e, c)));
      for (const r of results) if (r.status === "rejected") console.log(JSON.stringify({ evt: "handler_error", msg: String(r.reason).slice(0, 300) }));
    })();
    // LINEは応答が遅いと接続を切る。切られるとWorkerの処理も中断され、診断最終ステップの返信が届かなくなる。
    // そこで200を即返し、返信・集計は waitUntil で最後まで実行する（ctxが無いNode/テストでは従来どおり待つ）。
    if (typeof ctx?.waitUntil === "function") ctx.waitUntil(work);
    else await work;
    return json({ ok: true });
  }

  // 流入経路つきの入口: /l/<経路名>?job=nurse → 診断開始の文面を入力済みでトークを開く
  const m = url.pathname.match(/^\/l\/([A-Za-z0-9_-]{1,24})$/);
  if (m) {
    const JOB = { nurse: "看護師", care: "介護職", pharm: "薬剤師", child: "保育士", it: "IT", sales: "営業", mfg: "製造", consul: "コンサル", ma: "M&A" };
    const job = JOB[url.searchParams.get("job")] ?? "";
    await bumpTag(getStore(env), m[1], "click");
    return Response.redirect(prefilledChatUrl(`30秒診断を始める【${m[1]}】${job}`), 302);
  }

  return json({ error: "not found" }, 404);
}

/** Cron（毎時）: 診断後のフォロー配信 */
export async function scheduled(env, now = Date.now()) {
  const store = getStore(env);
  if (!store || !env.LINE_CHANNEL_ACCESS_TOKEN) return { skipped: true };
  const client = makeClient(env);
  // 月の配信数を数えながら、優先度の高い順に送る（締切リマインド・フォロー → 新着note）。無料プランの月200通を超えないようにする
  const budget = await loadBudget(store, env, now);
  const max = Number(env.CRON_MAX_SENDS ?? 6); // 1回のCronで送る人数（無料プランのCPU時間の制限。有料プランなら増やせる）
  const r = await runFollowups({ store, client, now, budget, max }).catch((e) => ({ error: String(e).slice(0, 120) }));
  const d = await runDigest({ store, client, env, now, budget, max }).catch((e) => ({ error: String(e).slice(0, 120) }));
  await budget.commit();
  const w = await runWeekly({ store, client, env, now }).catch((e) => ({ error: String(e).slice(0, 120) }));
  const n = (k, v) => Array(Math.max(0, Number(v) || 0)).fill(k);
  await bumpMany(store, [...n("fu_sent", r.sent), ...n("rem_sent", r.reminded), ...n("dg_sent", d.sent)], now);
  console.log(JSON.stringify({ evt: "cron", followup: r, digest: d, weekly: w, pushUsed: budget.used(), pushLimit: budget.limit }));
  return { followup: r, digest: d, weekly: w };
}
