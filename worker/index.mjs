// Cloudflare Workers の入り口。静的ファイル(public/)は wrangler の assets が先に配信する。
import { handleRequest, scheduled } from "../src/core/app.mjs";

export default {
  async fetch(request, env, ctx) {
    try {
      return await handleRequest(request, env, ctx);
    } catch (e) {
      console.log(JSON.stringify({ evt: "fatal", msg: String(e).slice(0, 300) }));
      return new Response(JSON.stringify({ error: "internal error" }), { status: 500, headers: { "content-type": "application/json" } });
    }
  },
  // Cron（毎時）: 診断後のフォロー配信
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(scheduled(env));
  },
};
