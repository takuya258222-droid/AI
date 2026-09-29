// Cloudflare Workers と同じ実行環境(wrangler dev / workerd)でBotを起動し、署名付きWebhookを送って検証する。
// 使い方: node scripts/e2e-worker.mjs
import http from "node:http";
import crypto from "node:crypto";
import { spawn } from "node:child_process";

const SECRET = "e2e-secret";
const calls = [];
const mock = http.createServer((req, res) => {
  let b = ""; req.on("data", (c) => (b += c));
  req.on("end", () => {
    calls.push({ path: req.url, body: b ? JSON.parse(b) : {} });
    res.setHeader("content-type", "application/json");
    res.end(req.url.startsWith("/v2/bot/profile/") ? JSON.stringify({ displayName: "E2E" }) : "{}");
  });
});
await new Promise((r) => mock.listen(0, r));
const MOCK = `http://127.0.0.1:${mock.address().port}`;
const PORT = 8799;

try { await fetch(`http://127.0.0.1:${PORT}/health`); console.log(`ポート${PORT}が使用中です。残っているwrangler/workerdを終了してください`); process.exit(2); } catch { /* 空いている */ }
const child = spawn("npx", ["wrangler", "dev", "--port", String(PORT), "--ip", "127.0.0.1", "--test-scheduled", "--log-level", "warn",
  "--var", `LINE_CHANNEL_SECRET:${SECRET}`, "--var", "LINE_CHANNEL_ACCESS_TOKEN:tok", "--var", `LINE_API_BASE:${MOCK}`, "--var", "ADMIN_USER_ID:Uadmin"],
  { cwd: process.cwd(), stdio: ["ignore", "pipe", "pipe"], detached: true, env: { ...process.env, WRANGLER_SEND_METRICS: "false", CI: "1" } });
let log = "";
child.stdout.on("data", (d) => (log += d)); child.stderr.on("data", (d) => (log += d));

let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? "  ✓" : "  ✗ FAIL"} ${n}`); };
const url = (p) => `http://127.0.0.1:${PORT}${p}`;

async function waitReady() {
  for (let i = 0; i < 90; i++) {
    try { const r = await fetch(url("/health")); if (r.ok) return true; } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}
const sign = (raw) => crypto.createHmac("sha256", SECRET).update(raw).digest("base64");
async function hook(events) {
  const raw = JSON.stringify({ destination: "U0", events });
  calls.length = 0;
  const r = await fetch(url("/webhook"), { method: "POST", headers: { "x-line-signature": sign(raw), "content-type": "application/json" }, body: raw });
  // 200は即返り、返信は waitUntil で非同期に送られる。返信が出揃う（一定時間増えない）まで待つ
  let last = -1, still = 0;
  for (let i = 0; i < 80 && still < 6; i++) {
    await new Promise((res) => setTimeout(res, 50));
    if (calls.length === last) still++; else { last = calls.length; still = 0; }
  }
  return { status: r.status, replies: calls.filter((c) => c.path === "/v2/bot/message/reply") };
}
const src = { type: "user", userId: "Ue2e" };

try {
  ok(await waitReady(), "Workerが起動し /health に応答");
  let r = await fetch(url("/img/welcome.jpg"));
  ok(r.status === 200 && r.headers.get("content-type")?.includes("image"), "画像(public/img)が配信される");
  r = await fetch(url("/legal.html"));
  ok(r.status === 200, "規約ページ(legal.html)が配信される");
  r = await fetch(url("/webhook"), { method: "POST", headers: { "x-line-signature": "bad" }, body: "{}" });
  ok(r.status === 401, "不正な署名は401");

  let h = await hook([{ type: "follow", replyToken: "r1", source: src }]);
  ok(h.status === 200 && h.replies.length === 1, "友だち追加にあいさつ返信");
  ok(JSON.stringify(h.replies[0].body.messages).includes("E2Eさん"), "  表示名つき");
  ok(JSON.stringify(h.replies[0].body.messages).includes(`127.0.0.1:${PORT}/img/welcome.jpg`), "  画像URLがWorkerのオリジンから生成される");

  const seq = ["st", "d|j:it,s:it_sr,g:a30,i:i7,p:up,t:m3"];
  for (const d of seq) h = await hook([{ type: "postback", replyToken: "r2", source: src, postback: { data: d } }]);
  const out = JSON.stringify(h.replies[0].body.messages);
  ok(h.replies[0].body.messages.length === 3 && out.includes("TechGo"), "診断完了（IT経験者→TechGo）で3件返信");

  h = await hook([{ type: "message", replyToken: "r3", source: src, message: { type: "image", id: "1" } }]);
  ok(JSON.stringify(h.replies[0]?.body.messages).includes("スクリーンショットを受け取りました"), "スクショ受信の自動返信");

  const s = await fetch(url("/__scheduled?cron=0+*+*+*+*"));
  ok(s.status === 200, "Cron(フォロー配信)が例外なく実行される");
} catch (e) {
  fail++; console.log("ERROR", e);
} finally {
  try { process.kill(-child.pid, "SIGKILL"); } catch { child.kill("SIGKILL"); }
  mock.close();
  if (fail) console.log("\n--- wrangler log ---\n" + log.slice(-2500));
  console.log(`\n結果: pass=${pass} fail=${fail}`);
  process.exit(fail ? 1 : 0);
}
