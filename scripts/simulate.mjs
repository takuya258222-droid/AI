// Webhookを署名付きで疑似送信し、Bot全体の動作を検証する（LINE APIはモック）。
// 使い方: node scripts/simulate.mjs
import http from "node:http";
import crypto from "node:crypto";
import { handleRequest, scheduled } from "../src/core/app.mjs";
import { memoryStore } from "../src/core/store.mjs";
import { report } from "../src/core/stats.mjs";
import { runFollowups } from "../src/core/followup.mjs";
import { makeClient } from "../src/core/line.mjs";

const SECRET = "test-secret";
const ADMIN = "Uadmin";
let pass = 0, fail = 0;
const ok = (cond, name, extra = "") => { (cond ? pass++ : fail++); console.log(`${cond ? "  ✓" : "  ✗ FAIL"} ${name}${cond ? "" : " " + extra}`); };

// ---- LINE APIモック ----
const calls = [];
const server = http.createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    const j = body ? JSON.parse(body) : {};
    calls.push({ method: req.method, path: req.url, body: j, auth: req.headers.authorization });
    res.setHeader("content-type", "application/json");
    if (req.url.startsWith("/v2/bot/profile/")) return res.end(JSON.stringify({ displayName: "テスト太郎" }));
    res.end("{}");
  });
});
await new Promise((r) => server.listen(0, r));
const PORT = server.address().port;

const store = memoryStore();
const env = { LINE_CHANNEL_SECRET: SECRET, LINE_CHANNEL_ACCESS_TOKEN: "tok", LINE_API_BASE: `http://127.0.0.1:${PORT}`, ADMIN_USER_ID: ADMIN, __store: store };
const sign = (raw) => crypto.createHmac("sha256", SECRET).update(raw).digest("base64");

async function send(events, { badSig = false } = {}) {
  const raw = JSON.stringify({ destination: "U0", events });
  calls.length = 0;
  const res = await handleRequest(new Request("https://bot.example.workers.dev/webhook", { method: "POST", headers: { "x-line-signature": badSig ? "AAAA" : sign(raw) }, body: raw }), env, {});
  return { status: res.status, replies: calls.filter((c) => c.path === "/v2/bot/message/reply"), pushes: calls.filter((c) => c.path === "/v2/bot/message/push") };
}
const userEvt = (o) => ({ timestamp: Date.now(), source: { type: "user", userId: "Uuser1" }, mode: "active", ...o });
const postback = (data) => userEvt({ type: "postback", replyToken: "rt-" + Math.random(), postback: { data } });
const textEvt = (t) => userEvt({ type: "message", replyToken: "rt-" + Math.random(), message: { type: "text", id: "1", text: t } });
const imageEvt = () => userEvt({ type: "message", replyToken: "rt-" + Math.random(), message: { type: "image", id: "2", contentProvider: { type: "line" } } });

// 返信メッセージ中の postback data を全部集める
function postbacks(msgs) {
  const out = [];
  const walk = (o) => {
    if (Array.isArray(o)) return o.forEach(walk);
    if (o && typeof o === "object") {
      if (o.type === "postback" && o.data) out.push({ data: o.data, label: o.displayText ?? o.label });
      Object.values(o).forEach(walk);
    }
  };
  walk(msgs);
  return out;
}
const sizeOk = (msgs) => msgs.length <= 5 && msgs.every((m) => JSON.stringify(m).length < 48000);

// ================================================================
console.log("\n[1] セキュリティ・基本");
let r = await send([], { badSig: true });
ok(r.status === 401, "署名が不正なら401");
r = await send([]);
ok(r.status === 200, "空イベント(接続確認)は200");
r = await handleRequest(new Request("https://x/webhook", { method: "GET" }), env, {});
ok(r.status === 405, "GETは405");
r = await handleRequest(new Request("https://x/health"), env, {});
ok(r.status === 200, "/health は200");

console.log("\n[2] 友だち追加 → あいさつ");
r = await send([userEvt({ type: "follow", replyToken: "rtF" })]);
ok(r.replies.length === 1, "あいさつを1回返信");
ok(calls.some((c) => c.path.startsWith("/v2/bot/profile/")), "表示名を取得");
const greet = JSON.stringify(r.replies[0].body.messages);
ok(greet.includes("テスト太郎さん"), "名前入りのあいさつ");
ok(greet.includes("30秒診断をスタート"), "診断開始ボタンがある");
ok(r.replies[0].body.replyToken === "rtF" && r.replies[0].auth === "Bearer tok", "replyTokenとトークンが正しい");
ok(sizeOk(r.replies[0].body.messages), "メッセージ数・サイズが上限内");

console.log("\n[3] 診断を最後までタップ（看護師・30代・500〜700万・派遣希望）");
r = await send([postback("st")]);
let pbs = postbacks(r.replies[0].body.messages);
ok(pbs.some((p) => p.data === "d|j:med"), "Q1に医療・福祉の選択肢");
const pick = (msgs, label) => postbacks(msgs).find((p) => p.label === label)?.data;
const path = ["医療・福祉", "看護師", "30〜34歳", "500〜700万円", "派遣で働きたい", "3か月以内に動きたい"];
let last = r.replies[0].body;
for (const label of path) {
  const data = pick(last.messages, label);
  ok(Boolean(data), `「${label}」を選べる`);
  r = await send([postback(data)]);
  last = r.replies[0].body;
  ok(sizeOk(last.messages), `  返信が上限内(${last.messages.length}件)`);
}
ok(last.messages.length === 4, "診断完了で4件返信（結果・サービス・登録案内・体験記）", String(last.messages.length));
const res = JSON.stringify(last.messages);
ok(res.includes("MC-ナースネット") && res.includes("ナースJJ"), "看護師の2社が表示される");
ok(res.includes("r.8to.jp"), "アフィリエイトリンクが入っている");
ok(res.indexOf("MC-ナースネット") < res.indexOf("ナースJJ"), "派遣希望なのでMC-ナースネットが先頭");
ok(res.includes("年収ポジション") && res.includes("国税庁"), "年収ポジション（出典つき）が表示される");
ok(res.includes("毎月抽選で3名様"), "抽選3名様の明記");
ok(res.includes("notes/n4d10dab114ec.jpg") || res.includes("notes/n7ff23e3fe450.jpg"), "看護師の体験記が添えられる");
ok([...store._dump().keys()].some((k) => k === "d:Uuser1"), "フォロー配信の宛先が保存される");

console.log("\n[4] エリア追加質問（IT未経験・20代・→首都圏限定サービス）");
let st = "d|j:it,s:it_none,g:a25,i:i3,p:new,t:now";
r = await send([postback(st)]);
ok(JSON.stringify(r.replies[0].body.messages).includes("エリア"), "エリア質問が挟まる");
r = await send([postback(st + ",r:kanto")]);
ok(JSON.stringify(r.replies[0].body.messages).includes("Agent Projin"), "首都圏ならAgent Projinを案内");
r = await send([postback(st + ",r:kansai")]);
ok(!JSON.stringify(r.replies[0].body.messages).includes("Agent Projin"), "関西ではAgent Projinを案内しない");

console.log("\n[5] 戻る・やり直し");
r = await send([postback("b|j:med")]);
ok(JSON.stringify(r.replies[0].body.messages).includes("医療・福祉の中で"), "戻る→サブ質問（看護師/介護職…）");
r = await send([postback("b")]);
ok(JSON.stringify(r.replies[0].body.messages).includes("現在のお仕事"), "戻る→職種質問");
r = await send([postback("d|j:med,s:nurse")]);
ok(JSON.stringify(r.replies[0].body.messages).includes("b|j:med"), "年代の質問の「前に戻る」はサブ質問へ戻る");

console.log("\n[6] 年収診断（単体）");
r = await send([postback("sal")]);
ok(JSON.stringify(r.replies[0].body.messages).includes("sal|i:i4"), "年収の選択肢");
r = await send([postback("sal|i:i7")]);
ok(JSON.stringify(r.replies[0].body.messages).includes("上位約17%"), "700万円〜は上位約17%");

console.log("\n[7] スクショ受信");
r = await send([imageEvt()]);
const rc = JSON.stringify(r.replies[0].body.messages);
ok(rc.includes("スクリーンショットを受け取りました") && rc.includes("抽選で3名様") && rc.includes("当選のご連絡"), "受付返信（応募受付・抽選3名・当選連絡）");
ok(r.pushes.length === 1 && r.pushes[0].body.to === ADMIN, "運営へ通知");
ok(!store._dump().has("d:Uuser1"), "応募後はフォロー配信を停止");

console.log("\n[8] キーワード自動応答");
const kw = { 診断: "STEP 1", 求人: "30秒診断がいちばん", 転職: "30秒診断がいちばん", エージェント: "30秒診断がいちばん", キャンペーン: "PRESENT CAMPAIGN", PayPay: "PRESENT CAMPAIGN", ペイペイ: "PRESENT CAMPAIGN", 登録: "HOW TO ENTER", スクショ: "HOW TO ENTER", 問い合わせ: "CONTACT", 年収: "SALARY", 体験記: "CAREER STORIES", ノウハウ: "転職を成功させる4つの基本", 運営者: "ABOUT", 選定基準: "OUR STANDARDS", プライバシー: "PRIVACY", よくある質問: "Q & A", メニュー: "何をお探しですか" };
for (const [k, expect] of Object.entries(kw)) {
  r = await send([textEvt(k)]);
  ok(r.replies.length === 1 && JSON.stringify(r.replies[0].body.messages).includes(expect), `「${k}」→ ${expect}`);
}
r = await send([textEvt("こんにちは、質問があります")]);
ok(JSON.stringify(r.replies[0].body.messages).includes("質問") , "質問系の文はFAQへ");
r = await send([textEvt("ありがとう")]);
ok(JSON.stringify(r.replies[0].body.messages).includes("運営が確認"), "その他はフォールバック（運営確認の案内）");
r = await send([userEvt({ type: "message", replyToken: "s", message: { type: "sticker", id: "3", packageId: "1", stickerId: "1" } })]);
ok(r.replies.length === 1, "スタンプにも応答");

console.log("\n[9] FAQ・各パネル");
r = await send([postback("faq")]);
const faqPb = postbacks(r.replies[0].body.messages).filter((p) => p.data.startsWith("faq|"));
ok(faqPb.length === 6, "FAQ項目が6件");
for (const p of faqPb) {
  r = await send([postback(p.data)]);
  ok(r.replies.length === 1, `FAQ ${p.data}`);
}
for (const d of ["camp", "steps", "know", "taiken", "about", "policy", "privacy", "contact", "home"]) {
  r = await send([postback(d)]);
  ok(r.replies.length === 1 && sizeOk(r.replies[0].body.messages), `パネル ${d}`);
}
r = await send([postback("taiken")]);
ok(JSON.stringify(r.replies[0].body.messages).includes("m4015cc74146b"), "体験記パネルにnoteマガジンのリンク");

console.log("\n[10] フォロー配信");
const T0 = Date.UTC(2026, 9, 1, 3, 0, 0); // 日本時間 12:00
await store.put("d:Ufollow", { state: "j:med,s:nurse,g:a30,i:i5,p:wl,t:m3", ts: T0, stage: 0 });
const client = makeClient(env);
let out = await runFollowups({ store, client, now: T0 + 3600 * 1000 });
ok(out.sent === 0, "1時間後はまだ送らない");
calls.length = 0;
out = await runFollowups({ store, client, now: T0 + 23 * 3600 * 1000 }); // 翌日11:00 JST
ok(out.sent === 1 && calls.some((c) => c.path === "/v2/bot/message/push" && c.body.to === "Ufollow"), "約1日後に1通目を送る");
ok(JSON.stringify(calls.at(-1).body).includes("rs|j:med"), "結果をもう一度見るボタン");
out = await runFollowups({ store, client, now: T0 + 25 * 3600 * 1000 });
ok(out.sent === 0, "2通目はまだ送らない");
out = await runFollowups({ store, client, now: T0 + 4 * 24 * 3600 * 1000 + 1000 }); // 4日後12:00 JST
ok(out.sent === 1 && !(await store.get("d:Ufollow")), "約4日後に2通目を送り、以後は送らない");
await store.put("d:Unight", { state: "j:office,g:a25,i:i3,p:up,t:now", ts: T0, stage: 0 });
out = await runFollowups({ store, client, now: T0 + 30 * 3600 * 1000 }); // 翌日 18:00+... => JST 18時
ok(out.sent === 1, "日中(JST 9〜21時)は送る");
await store.put("d:Unight2", { state: "j:office,g:a25,i:i3,p:up,t:now", ts: T0, stage: 0 });
out = await runFollowups({ store, client, now: Date.UTC(2026, 9, 2, 15, 30, 0) }); // JST 00:30
ok(out.skipped === "quiet-hours", "深夜は送らない");
// 「rs|...」で結果が再表示できる
r = await send([postback("rs|j:med,s:nurse,g:a30,i:i5,p:wl,t:m3")]);
ok(r.replies[0].body.messages.length === 4, "保存した回答から結果を再表示");

console.log("\n[11] 配信停止・ブロック・統計");
await store.put("d:Uuser1", { state: "j:office,g:a25,i:i3,p:up,t:now", ts: T0, stage: 0 });
r = await send([textEvt("配信停止")]);
ok(JSON.stringify(r.replies[0].body.messages).includes("削除しました") && !store._dump().has("d:Uuser1"), "「配信停止」で停止・削除");
await store.put("d:Uuser1", { state: "j:office,g:a25,i:i3,p:up,t:now", ts: T0, stage: 0 });
await send([userEvt({ type: "unfollow" })]);
ok(!store._dump().has("d:Uuser1"), "ブロック(unfollow)で削除");
const adminEvt = { ...textEvt("統計"), source: { type: "user", userId: ADMIN } };
r = await send([adminEvt]);
ok(JSON.stringify(r.replies[0].body.messages).includes("診断完了率"), "運営者だけが「統計」を見られる");
r = await send([textEvt("統計")]);
ok(!JSON.stringify(r.replies[0].body.messages).includes("診断完了率"), "一般ユーザーには統計を見せない");

console.log("\n[12] 異常系");
env.LINE_API_BASE = `http://127.0.0.1:${PORT}`;
const bad = await handleRequest(new Request("https://x/webhook", { method: "POST", headers: { "x-line-signature": sign("not json") }, body: "not json" }), env, {});
ok(bad.status === 400, "壊れたJSONは400");
r = await send([postback("unknown-action")]);
ok(r.replies.length === 1, "未知のpostbackでも落ちずに応答");
r = await send([postback("d|j:hacker,s:zzz,g:a99")]);
ok(r.status === 200, "改ざんされたstateでも落ちない");

server.close();
console.log(`\n結果: pass=${pass} fail=${fail}`);
process.exit(fail ? 1 : 0);
