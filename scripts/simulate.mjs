// Webhookを署名付きで疑似送信し、Bot全体の動作を検証する（LINE APIはモック）。
// 使い方: node scripts/simulate.mjs
import http from "node:http";
import crypto from "node:crypto";
import { handleRequest, scheduled } from "../src/core/app.mjs";
import { memoryStore } from "../src/core/store.mjs";
import { report } from "../src/core/stats.mjs";
import { runFollowups } from "../src/core/followup.mjs";
import { buildReport, runWeekly } from "../src/core/report.mjs";
import { makeClient } from "../src/core/line.mjs";
import { loadBudget } from "../src/core/budget.mjs";
import { runDigest, parseFeed } from "../src/core/notefeed.mjs";
import { variantOf } from "../src/core/handler.mjs";
import { TIP_STATE, TIP_KEYS } from "../src/core/tips.mjs";
import { keyOf } from "../src/core/matcher.mjs";

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
const imageEvt = (uid = "Uuser1") => ({ ...userEvt({ type: "message", replyToken: "rt-" + Math.random(), message: { type: "image", id: "2", contentProvider: { type: "line" } } }), source: { type: "user", userId: uid } });

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
let r2;
r = await send([userEvt({ type: "follow", replyToken: "rtF" })]);
ok(r.replies.length === 1, "あいさつを1回返信");
ok(calls.some((c) => c.path.startsWith("/v2/bot/profile/")), "表示名を取得");
const greet = JSON.stringify(r.replies[0].body.messages);
ok(greet.includes("テスト太郎さん"), "名前入りのあいさつ");
ok(greet.includes("30秒診断をスタート"), "診断開始ボタンがある");
ok(r.replies[0].body.messages.length === 2 && r.replies[0].body.messages[0].type === "text", "1通目は運営からの短いあいさつ（テキスト）、2通目が診断カード");
r2 = await send([userEvt({ type: "follow", replyToken: "rtG", follow: { isUnblocked: true } })]);
ok(JSON.stringify(r2.replies[0].body.messages).includes("おかえりなさい"), "ブロック解除で戻った方には「おかえりなさい」");
ok(r.replies[0].body.replyToken === "rtF" && r.replies[0].auth === "Bearer tok", "replyTokenとトークンが正しい");
ok(sizeOk(r.replies[0].body.messages), "メッセージ数・サイズが上限内");

console.log("\n[3] 診断を最後までタップ（看護師・30代・500〜700万・派遣希望）");
r = await send([postback("st")]);
let pbs = postbacks(r.replies[0].body.messages);
ok(pbs.some((p) => p.data === "d|j:med"), "Q1に医療・福祉の選択肢");
/** 診断結果のうち、紹介リンク（サービス）のカルーセル */
const svcCarousel = (msgs) => [...msgs].reverse().find((m) => m.contents?.type === "carousel" && JSON.stringify(m).includes("紹介リンク経由の登録で"));
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
ok(last.messages.length === 5, "診断完了で5件返信（結果・体験記・登録案内・サービス・次のアクション）", String(last.messages.length));
const res = JSON.stringify(last.messages);
ok(res.includes("MC-ナースネット") && res.includes("ナースJJ"), "看護師の2社が表示される");
ok(res.includes("r.8to.jp"), "アフィリエイトリンクが入っている");
ok(res.indexOf("MC-ナースネット") < res.indexOf("ナースJJ"), "派遣希望なのでMC-ナースネットが先頭");
ok(res.includes("年収ポジション") && res.includes("国税庁"), "年収ポジション（出典つき）が表示される");
ok(res.includes("毎月抽選で3名様"), "抽選3名様の明記");
ok(Boolean(last.messages.at(-1).quickReply?.items?.length), "診断結果の最後にショートカット（クイックリプライ）");
ok(JSON.stringify(last.messages.at(-1)).includes("regy|") && JSON.stringify(last.messages.at(-1)).includes("登録した（スクショで応募）"), "最後は、登録した／迷っている／あとで、を押すだけの大きなボタンのカード");
ok(res.includes("notes/n4d10dab114ec.jpg") || res.includes("notes/n7ff23e3fe450.jpg"), "看護師の体験記が添えられる");
ok([...store._dump().keys()].some((k) => k === "d:Uuser1"), "フォロー配信の宛先が保存される");
ok(JSON.stringify(svcCarousel(last.messages)).includes("r.8to.jp") && last.messages.indexOf(svcCarousel(last.messages)) === last.messages.length - 2, "紹介リンクのカードは、最後の1つ前（そのすぐ下に大きなボタンのカード）");

console.log("\n[3b] 保存（KV）が失敗しても、診断結果は必ず届く");
{
  const okStore = env.__store;
  env.__store = { async get() { throw new Error("KV down"); }, async put() { throw new Error("KV limit exceeded"); }, async delete() { throw new Error("KV down"); }, async list() { throw new Error("KV down"); } };
  let rr = await send([postback("st")]);
  let lastF = rr.replies[0].body;
  for (const label of path) {
    const data = pick(lastF.messages, label);
    rr = await send([postback(data)]);
    lastF = rr.replies[0].body;
  }
  const t = JSON.stringify(lastF.messages);
  ok(lastF.messages.length === 5 && t.includes("r.8to.jp"), "KVが全部エラーでも、紹介リンク付きの結果が返る");
  env.__store = okStore;
}

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
const kw = { 診断: "STEP 1", 求人: "30秒診断がいちばん", 転職: "30秒診断がいちばん", エージェント: "30秒診断がいちばん", キャンペーン: "PRESENT CAMPAIGN", PayPay: "PRESENT CAMPAIGN", ペイペイ: "PRESENT CAMPAIGN", 登録: "HOW TO ENTER", スクショ: "HOW TO ENTER", 問い合わせ: "PRIVATE CONSULT", 手取り: "TAKE-HOME", 管理人: "PRIVATE CONSULT", スケジュール: "SCHEDULE", 面談準備: "INTERVIEW PREP", シェア: "SHARE", 転職の相談: "30秒診断がいちばん", 年収: "SALARY", 体験記: "CAREER STORIES", ノウハウ: "転職を成功させる4つの基本", 運営者: "ABOUT", 選定基準: "OUR STANDARDS", プライバシー: "PRIVACY", よくある質問: "Q & A", メニュー: "何をお探しですか" };
for (const [k, expect] of Object.entries(kw)) {
  r = await send([textEvt(k)]);
  ok(r.replies.length === 1 && JSON.stringify(r.replies[0].body.messages).includes(expect), `「${k}」→ ${expect}`);
}
r = await send([textEvt("こんにちは、質問があります")]);
ok(JSON.stringify(r.replies[0].body.messages).includes("質問") , "質問系の文はFAQへ");
r = await send([textEvt("ありがとう")]);
ok(JSON.stringify(r.replies[0].body.messages).includes("運営が内容を確認"), "その他はフォールバック（運営確認の案内）");
r = await send([userEvt({ type: "message", replyToken: "s", message: { type: "sticker", id: "3", packageId: "1", stickerId: "1" } })]);
ok(r.replies.length === 1, "スタンプにも応答");

console.log("\n[9] FAQ・各パネル");
r = await send([postback("faq")]);
const faqPb = postbacks(r.replies[0].body.messages).filter((p) => p.data.startsWith("faq|"));
ok(faqPb.length === 9, "FAQ項目が9件（登録前の不安3件を追加）");
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
ok(out.sent === 1 && (await store.get("d:Ufollow")).stage === 2, "約4日後に2通目を送る");
calls.length = 0;
out = await runFollowups({ store, client, now: T0 + 7 * 24 * 3600 * 1000 + 1000 }); // 7日後12:00 JST
ok(out.sent === 1 && JSON.stringify(calls.at(-1).body).includes("迷っている方へ"), "約7日後に3通目（迷っている方へ）を送る");
const lastRec = await store.get("d:Ufollow");
ok(lastRec && lastRec.stage === 3, "3通目のあとも、保存期間内は診断の記録を残す（結果の再表示のため）");
out = await runFollowups({ store, client, now: T0 + 8 * 24 * 3600 * 1000 });
ok(out.sent === 0, "3通目のあとは、フォローを送らない");
await store.delete("d:Ufollow");
await store.put("d:Unight", { state: "j:office,g:a25,i:i3,p:up,t:now", ts: T0, stage: 0 });
out = await runFollowups({ store, client, now: T0 + 30 * 3600 * 1000 }); // 翌日 18:00+... => JST 18時
ok(out.sent === 1, "日中(JST 9〜21時)は送る");
await store.put("d:Unight2", { state: "j:office,g:a25,i:i3,p:up,t:now", ts: T0, stage: 0 });
out = await runFollowups({ store, client, now: Date.UTC(2026, 9, 2, 15, 30, 0) }); // JST 00:30
ok(out.skipped === "quiet-hours", "深夜は送らない");
// 「rs|...」で結果が再表示できる
r = await send([postback("rs|j:med,s:nurse,g:a30,i:i5,p:wl,t:m3")]);
ok(r.replies[0].body.messages.length === 5, "保存した回答から結果を再表示");

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

console.log("\n[11b] 便利ツール・管理人に相談");
r = await send([postback("net|i:i4")]);
ok(JSON.stringify(r.replies[0].body.messages).includes("約320〜395万円"), "手取り目安（400〜500万円）");
r = await send([postback("net")]);
ok(postbacks(r.replies[0].body.messages).length === 5, "手取り：年収の選択肢5つ");
r = await send([postback("plan|t:m3")]);
ok(JSON.stringify(r.replies[0].body.messages).includes("今週"), "スケジュール逆算（3か月）");
r = await send([postback("plan")]);
ok(postbacks(r.replies[0].body.messages).length === 3, "スケジュール：希望時期3つ");
r = await send([postback("prep")]);
ok(JSON.stringify(r.replies[0].body.messages).includes("oaMessage"), "面談準備シートから相談メモを開ける");
r = await send([postback("share")]);
ok(JSON.stringify(r.replies[0].body.messages).includes("line.me/R/share"), "友だちにシェア（LINE共有画面）");
r = await send([postback("contact")]);
ok(JSON.stringify(r.replies[0].body.messages).includes("oaMessage/%40641thwzc"), "管理人に相談：入力済みのトークを開く");
const asUser = (uid, tx) => ({ ...textEvt(tx), source: { type: "user", userId: uid } });
r = await send([asUser("Uconsult", "ありがとうございます")]);
ok(r.pushes.some((p) => p.body.to === ADMIN && JSON.stringify(p.body).includes("新しいメッセージ")), "自由入力は運営者に通知");
r = await send([asUser("Uconsult", "ありがとうございます")]);
ok(r.pushes.length === 0, "同じ人からの連続通知は抑制（6時間に1回）");

console.log("\n[11c] 抽選ツール（運営者専用）");
for (const u of ["U2", "U3", "U4", "U5", "U5"]) await send([imageEvt(u)]);
const adm = (t) => ({ ...textEvt(t), source: { type: "user", userId: ADMIN } });
r = await send([adm("応募者数")]);
ok(JSON.stringify(r.replies[0].body.messages).includes("今月") && JSON.stringify(r.replies[0].body.messages).includes("5名"), "応募者数：5名");
r = await send([textEvt("抽選今月")]);
ok(!JSON.stringify(r.replies[0].body.messages).includes("抽選結果"), "一般ユーザーは抽選を実行できない");
r = await send([adm("抽選今月")]);
const draw1 = JSON.stringify(r.replies[0].body.messages);
ok(draw1.includes("抽選結果") && (draw1.match(/さん（応募/g) || []).length === 3, "運営者が抽選すると当選候補3名");
r = await send([adm("抽選今月")]);
ok(JSON.stringify(r.replies[0].body.messages).includes("抽選済み"), "二重抽選を防止");
r = await send([adm("抽選今月再")]);
ok(JSON.stringify(r.replies[0].body.messages).includes("抽選結果"), "「再」で引き直せる");
r = await send([adm("当選連絡")]);
const winnerPushes = r.pushes.filter((p) => p.body.to !== ADMIN);
ok(winnerPushes.length === 3 && new Set(winnerPushes.map((p) => p.body.to)).size === 3 && JSON.stringify(winnerPushes[0].body).includes("ご当選"), "当選者3名に当選連絡");
r = await send([adm("当選連絡")]);
ok(JSON.stringify(r.replies[0].body.messages).includes("連絡済み"), "当選連絡の二重送信を防止");
r = await send([adm("管理")]);
ok(JSON.stringify(r.replies[0].body.messages).includes("運営者用コマンド"), "ヘルプ");

console.log("\n[11d] 流入経路・職種別の入口・週次レポート");
let lr = await handleRequest(new Request("https://bot.example.workers.dev/l/note1?job=nurse"), env, {});
ok(lr.status === 302 && lr.headers.get("location").includes("oaMessage") && decodeURIComponent(lr.headers.get("location")).includes("【note1】看護師"), "/l/note1?job=nurse がトークを開くリンクにリダイレクト");
lr = await handleRequest(new Request("https://bot.example.workers.dev/l/bad tag!"), env, {});
ok(lr.status === 404, "不正な経路名は404");
const asU = (uid, ev) => ({ ...ev, source: { type: "user", userId: uid } });
r = await send([asU("Utag", textEvt("30秒診断を始める【note1】看護師"))]);
const q = JSON.stringify(r.replies[0].body.messages);
ok(q.includes("年代を教えてください") && !q.includes("現在のお仕事は"), "看護師の入口は、職種の質問を飛ばして年代から開始");
r = await send([asU("Utag", postback("d|j:med,s:nurse,g:a25,i:i4,p:up,t:now"))]);
ok(r.replies[0].body.messages.length === 5, "診断完了");
await send([asU("Utag", imageEvt("Utag"))]);
const rep = await buildReport(store, 7, Date.now());
ok(rep.includes("note1：1→1→1→1"), "経路別に クリック→開始→完了→スクショ が集計される");
ok(rep.includes("看護師"), "職種別の診断数が出る");
r = await send([adm("統計")]);
ok(JSON.stringify(r.replies[0].body.messages).includes("流入経路別"), "「統計」に経路別が出る");
r = await send([adm("経路リンク")]);
ok(JSON.stringify(r.replies[0].body.messages).includes("/l/経路名"), "「経路リンク」で使い方を案内");
const MON = Date.UTC(2026, 9, 5, 0, 30, 0); // 月曜 9:30 JST
calls.length = 0;
const cl = makeClient(env);
let wk = await runWeekly({ store, client: cl, env, now: MON });
ok(wk.sent === true && calls.some((c) => c.path === "/v2/bot/message/push" && c.body.to === ADMIN && JSON.stringify(c.body).includes("週次レポート") && JSON.stringify(c.body).includes("💡")), "月曜9時台に週次レポート（ヒントつき）を運営者へ送信");
wk = await runWeekly({ store, client: cl, env, now: MON + 600 * 1000 });
ok(wk.skipped === "already-sent", "同じ週は二重送信しない");
wk = await runWeekly({ store, client: cl, env, now: MON + 24 * 3600 * 1000 });
ok(wk.skipped === "not-monday-9", "月曜以外は送らない");

console.log("\n[12] 異常系");
env.LINE_API_BASE = `http://127.0.0.1:${PORT}`;
const bad = await handleRequest(new Request("https://x/webhook", { method: "POST", headers: { "x-line-signature": sign("not json") }, body: "not json" }), env, {});
ok(bad.status === 400, "壊れたJSONは400");
for (const tabData of ["tab=a", "tab=b", "tab=c"]) {
  r = await send([postback(tabData)]);
  ok(r.status === 200 && r.replies.length === 0, `リッチメニューのタブ切り替え（${tabData}）には返信しない`);
}
r = await send([postback("unknown-action")]);
ok(r.replies.length === 1, "未知のpostbackでも落ちずに応答");
r = await send([postback("d|j:hacker,s:zzz,g:a99")]);
ok(r.status === 200, "改ざんされたstateでも落ちない");
for (const d of ["net|i:ix", "sal|i:ix", "net|i:zzz", "sal|i:zzz", "plan|t:now", "plan|t:zzz", "faq|nope", "b|zzz", "rs|j:zzz", "d|j:med,s:nurse,g:zz"]) {
  r = await send([postback(d)]);
  ok(r.status === 200 && r.replies.length === 1 && !JSON.stringify(r.replies[0].body.messages).includes("エラー"), `不正・改ざんpostback「${d}」でも普通に案内が返る`);
}

console.log("\n[13] 応答の速さ（本番で起きた『最終ステップだけ返信が届かない』の再発防止）");
{
  // (a) ctx.waitUntil がある環境では 200 を即返し、返信は waitUntil の中で最後まで送られる
  const pending = [];
  const ctx = { waitUntil: (p) => pending.push(p) };
  const okStore = env.__store;
  const slow = (ms) => new Promise((r) => setTimeout(r, ms));
  const base = memoryStore();
  // 保存が遅いKV（1回500ms）でも、返信は保存より先に出る
  env.__store = { async get(k) { await slow(500); return base.get(k); }, async put(k, v, o) { await slow(500); return base.put(k, v, o); }, async delete(k) { return base.delete(k); }, async list(o) { return base.list(o); } };
  const done = "d|j:it,s:it_sr,g:a30,i:i7,p:up,t:m3";
  const raw = JSON.stringify({ destination: "U0", events: [postback(done)] });
  calls.length = 0;
  const t0 = Date.now();
  const res = await handleRequest(new Request("https://bot.example.workers.dev/webhook", { method: "POST", headers: { "x-line-signature": sign(raw) }, body: raw }), env, ctx);
  const tRes = Date.now() - t0;
  ok(res.status === 200 && tRes < 300, `waitUntil環境ではWebhookに即200を返す（${tRes}ms）`);
  ok(pending.length === 1, "返信処理は waitUntil に渡される");
  await Promise.all(pending);
  const rp = calls.filter((c) => c.path === "/v2/bot/message/reply");
  ok(rp.length === 1 && JSON.stringify(rp[0].body.messages).includes("r.8to.jp"), "waitUntilの中で紹介リンク付きの結果が返信される");
  // (b) 返信の到着時刻: 保存(500msx複数)を待たずに返信される
  const t1 = Date.now();
  calls.length = 0;
  const pending2 = [];
  const raw2 = JSON.stringify({ destination: "U0", events: [postback(done)] });
  let replyAt = 0;
  const poll = setInterval(() => { if (!replyAt && calls.some((c) => c.path === "/v2/bot/message/reply")) replyAt = Date.now() - t1; }, 5);
  await handleRequest(new Request("https://bot.example.workers.dev/webhook", { method: "POST", headers: { "x-line-signature": sign(raw2) }, body: raw2 }), env, { waitUntil: (p) => pending2.push(p) });
  await Promise.all(pending2);
  clearInterval(poll);
  ok(replyAt > 0 && replyAt < 400, `保存が遅くても診断結果の返信は先に届く（返信まで${replyAt}ms）`);
  env.__store = okStore;
}

console.log("\n[14] フォロー配信（Cron）の異常系");
{
  const HOUR = 3600 * 1000;
  const noon = Date.parse("2026-10-05T03:00:00Z"); // 日本時間 12:00
  const mk = (rec) => { const st = memoryStore(); return st.put("d:Ufollow", rec).then(() => st); };
  const rec = { state: "j:med,s:nurse,g:a30,i:i5,p:wl,t:m3", ts: noon - 30 * HOUR, stage: 0 };
  const pushes = [];
  const okClient = { async push(to, msgs) { pushes.push({ to, msgs }); } };
  // (a) 保存の更新が失敗する → 送らない（毎時の二重送信を防ぐ）
  let st = await mk(rec);
  const badPut = { ...st, put: async () => { throw new Error("KV limit exceeded"); } };
  let res = await runFollowups({ store: badPut, client: okClient, now: noon });
  ok(pushes.length === 0 && res.errors === 1, "保存が失敗したときは、フォローを送らない（二重送信の防止）");
  // (b) 正常: 1回だけ送り、stage が進む。同じ時刻に再実行しても再送しない
  st = await mk(rec);
  res = await runFollowups({ store: st, client: okClient, now: noon });
  const res2 = await runFollowups({ store: st, client: okClient, now: noon });
  ok(pushes.length === 1 && (await st.get("d:Ufollow")).stage === 1 && res.sent === 1 && res2.sent === 0, "正常時は1回だけ送り、再実行しても再送しない");
  // (c) 一時エラー(500)は元に戻して次回再試行、ブロック(403)は削除
  st = await mk(rec);
  await runFollowups({ store: st, client: { async push() { const e = new Error("x"); e.status = 500; throw e; } }, now: noon });
  ok((await st.get("d:Ufollow"))?.stage === 0, "一時エラー(500)のときは、送信前の状態に戻して次回再試行");
  st = await mk(rec);
  await runFollowups({ store: st, client: { async push() { const e = new Error("x"); e.status = 403; throw e; } }, now: noon });
  ok((await st.get("d:Ufollow")) === null, "送れない宛先(403)は保存データを削除");
  // (d) 夜間は送らない／KV一覧が失敗しても例外を出さない
  st = await mk(rec);
  res = await runFollowups({ store: st, client: okClient, now: Date.parse("2026-10-05T15:00:00Z") });
  ok(res.skipped === "quiet-hours", "日本時間の夜間は送らない");
  res = await runFollowups({ store: { ...st, list: async () => { throw new Error("KV down"); }, listMeta: async () => { throw new Error("KV down"); } }, client: okClient, now: noon });
  ok(res.errors === 1, "KVの一覧取得が失敗しても例外を出さない");
  // (e) Cron全体（KVが壊れていても落ちない）
  const sres = await scheduled({ LINE_CHANNEL_ACCESS_TOKEN: "tok", LINE_API_BASE: `http://127.0.0.1:${PORT}`, __store: { get: async () => { throw new Error("x"); }, put: async () => { throw new Error("x"); }, delete: async () => { throw new Error("x"); }, list: async () => { throw new Error("x"); } } }, noon);
  ok(!!sres.followup && !!sres.weekly, "Cron全体は、KVが全部壊れていても例外を出さない");
}

console.log("\n[15] コンサル・M&Aの選択ボタン（ハイクラス）");
{
  const walk = async (first, labels) => {
    let rr = await send([postback("st")]);
    let last = rr.replies[0].body;
    ok(pick(last.messages, first) !== undefined, `Q1に「${first}」のボタンがある`);
    for (const label of labels) {
      const data = pick(last.messages, label);
      if (!data) { ok(false, `「${label}」を選べる`); return null; }
      rr = await send([postback(data)]);
      last = rr.replies[0].body;
    }
    return { rr, last };
  };
  // コンサル: 20代後半・関西 → エリア質問が挟まり、コンサル特化サービスが3〜4社届く
  let w = await walk("コンサル", ["コンサル", "25〜29歳", "500〜700万円", "年収アップ", "3か月以内に動きたい"]);
  ok(w && JSON.stringify(w.last.messages).includes("エリア"), "コンサル(25歳〜)ではエリア質問が挟まる（関西限定のsXars用）");
  w.rr = await send([postback(pick(w.last.messages, "関西（大阪・京都・兵庫など）") ?? pick(w.last.messages, w.last.messages.length ? postbacks(w.last.messages).find((p) => /関西/.test(p.label))?.label : ""))]);
  let carousel = svcCarousel(w.rr.replies[0].body.messages);
  let names = carousel.contents.contents.map((b) => JSON.stringify(b)).join("");
  const cards = carousel.contents.contents.length - 1; // 最後はメニューカード
  ok(cards >= 3 && cards <= 4, `コンサル(関西)は${cards}社のリンクが届く`);
  ok(names.includes("Groovement Agent") && names.includes("sXars") && names.includes("ASSIGN"), "Groovement・sXars・ASSIGNが含まれる");
  const firstCard = JSON.stringify(carousel.contents.contents[0]);
  ok(firstCard.includes("ASSIGN") && firstCard.includes("いちばんのおすすめ"), "ASSIGNが出るときは先頭（いちばんのおすすめ）に表示される");
  ok(!names.includes("MyVision") && !names.includes("af.moshimo.com"), "MyVisionは案内しない");
  // コンサル・関東: sXarsは出ない
  w = await walk("コンサル", ["コンサル", "30〜34歳", "700万円〜", "キャリアアップ", "3か月以内に動きたい"]);
  w.rr = await send([postback(postbacks(w.last.messages).find((p) => /首都圏/.test(p.label))?.data ?? "")]);
  carousel = svcCarousel(w.rr.replies[0].body.messages);
  names = JSON.stringify(carousel.contents);
  ok(!names.includes("sXars") && names.includes("Groovement Agent") && carousel.contents.contents.length - 1 >= 3, "コンサル(関東)はsXarsを出さず、Groovementほか3社以上");
  // M&A: 20代 → NewMA・M&A BEGINNERS・ASSIGN ほか
  w = await walk("M&A・FAS", ["M&A・FAS", "25〜29歳", "400〜500万円", "年収アップ", "半年〜1年以内に検討"]);
  carousel = svcCarousel(w.rr.replies[0].body.messages);
  names = JSON.stringify(carousel.contents);
  const cardsMa = carousel.contents.contents.length - 1;
  ok(cardsMa >= 3 && cardsMa <= 4 && names.includes("NewMA") && names.includes("M&A BEGINNERS"), `M&A(20代)はNewMA・M&A BEGINNERSを含む${cardsMa}社`);
  ok(w.rr.replies[0].body.messages.at(-1).quickReply, "最後のカードにクイックリプライ");
  // キーワード・流入経路
  r = await send([textEvt("コンサル転職について知りたい")]);
  ok(r.replies.length === 1 && JSON.stringify(r.replies[0].body.messages).includes("STEP 2 / 5"), "「コンサル」と送ると、職種を飛ばして年代の質問から始まる");
  r = await send([textEvt("M&Aに興味があります")]);
  ok(r.replies.length === 1 && JSON.stringify(r.replies[0].body.messages).includes("STEP 2 / 5"), "「M&A」と送ると、年代の質問から始まる");
  r = await send([textEvt("30秒診断を始める【note9】コンサル")]);
  ok(JSON.stringify(r.replies[0].body.messages).includes("STEP 2 / 5"), "経路つきの入口(コンサル)でも職種を飛ばして開始");
}

console.log("\n[16] 登録の意思ボタン・結果の再表示・面談ポイント・体験記・新着note配信");
{
  const STATE = "j:med,s:nurse,g:a30,i:i5,p:wl,t:m3";
  const feed = (items) => `<?xml version="1.0"?><rss><channel>${items.map((i) => `<item><title><![CDATA[${i[0]}]]></title><media:thumbnail>https://assets.st-note.com/x/${i[3]}.png?width=800</media:thumbnail><pubDate>${i[1]}</pubDate><link>https://note.com/wise_ivy1277/n/${i[2]}</link></item>`).join("")}</channel></rss>`;
  const FEED = feed([
    ["【看護師】夜勤をやめたら年収はどうなる", "Fri, 02 Oct 2026 20:00:00 +0900", "n1", "a"],
    ["【IT】未経験からエンジニアへ", "Thu, 01 Oct 2026 20:00:00 +0900", "n2", "b"],
    ["【営業】数字の作り方", "Wed, 30 Sep 2026 20:00:00 +0900", "n3", "c"],
    ["古い記事【介護】", "Mon, 21 Sep 2026 20:00:00 +0900", "n4", "d"],
  ]);
  ok(parseFeed(FEED).length === 4 && parseFeed(FEED)[0].link.endsWith("/n1"), "noteのRSSを解析できる（新しい順）");
  env.__noteFeed = FEED;

  // (a) 診断結果の下に、登録の意思ボタンと面談ポイント
  let rr = await send([postback(`d|${STATE}`)]);
  const qr = JSON.stringify(rr.replies[0].body.messages.at(-1));
  ok(["regy|", "regm|", "regl|", "tips|nurse"].every((x) => qr.includes(x)), "診断結果に「登録した／まだ迷ってる／あとで登録する／面談・選考のポイント」ボタン");
  ok(rr.replies[0].body.messages.at(-1).quickReply.items.length <= 13, "クイックリプライは13個以内");
  const stBefore = (await store.get("d:Uuser1"))?.state;
  ok(stBefore === STATE, "診断の記録が保存される（結果の再表示・リマインド用）");

  // (b) 登録の意思ボタン
  rr = await send([postback(`regy|${STATE}`)]);
  ok(JSON.stringify(rr.replies[0].body.messages).includes("スクリーンショット") && JSON.stringify(rr.replies[0].body.messages).includes("全員へのプレゼントではありません"), "「登録した」→ スクショ送付と抽選応募を案内（全員プレゼントではない旨つき）");
  rr = await send([postback(`regm|${STATE}`)]);
  ok(JSON.stringify(rr.replies[0].body.messages).includes("断ったり") && JSON.stringify(rr.replies[0].body.messages).includes("tips|nurse"), "「まだ迷ってる」→ 断ってもよいこと・不安のQ&A・面談ポイントを案内");
  rr = await send([postback(`regl|${STATE}`)]);
  ok(JSON.stringify(rr.replies[0].body.messages).includes("結果"), "「あとで登録する」→ 「結果」でいつでも再表示できると案内");
  const day = await store.get(`s:${new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10)}`);
  ok(day?.reg_y >= 1 && day?.reg_m >= 1 && day?.reg_l >= 1, "登録の意思ボタンの回数が集計される");

  // (c) 結果の再表示
  rr = await send([textEvt("結果")]);
  ok(rr.replies[0].body.messages.length === 5 && JSON.stringify(rr.replies[0].body.messages).includes("r.8to.jp"), "「結果」と送ると、診断結果と紹介リンクを再表示");
  rr = await send([postback("myres")]);
  ok(rr.replies[0].body.messages.length === 5, "メニューの「診断結果をもう一度見る」でも再表示");
  await store.delete("d:Uuser1");
  rr = await send([textEvt("診断結果を見たい")]);
  ok(JSON.stringify(rr.replies[0].body.messages).includes("記録が見つかりません") && JSON.stringify(rr.replies[0].body.messages).includes("STEP 1"), "記録が無いときは、もう一度診断を案内");
  await store.put("d:Uuser1", { state: STATE, ts: Date.now(), stage: 0 });

  // (d) 面談・選考ポイント（職種×年代 → 5つのポイント＋その職種・年代に合うエージェント）
  ok(TIP_KEYS.every((k) => keyOf(TIP_STATE[k]) === k), "面談ポイントの全職種が、診断の振り分けキーと対応している");
  rr = await send([postback("tips|nurse")]);
  ok(JSON.stringify(rr.replies[0].body.messages).includes("tips|nurse.a30") && JSON.stringify(rr.replies[0].body.messages).includes("年代を教えてください"), "職種を選ぶと、年代を聞く");
  rr = await send([postback("tips|nurse.a30")]);
  let tj = JSON.stringify(rr.replies[0].body.messages);
  ok(tj.includes("看護師（30〜34歳）：面談・面接で確認したい5つ") && tj.includes("30代前半は"), "看護師×30代: 5つのポイントと、30代の傾向");
  ok(tj.includes("MC-ナースネット") && tj.includes("ナースJJ") && !tj.includes("ASSIGN"), "看護師には看護の専門エージェント（ASSIGNは出さない）");
  ok(rr.replies[0].body.messages.length === 3 && JSON.stringify(rr.replies[0].body.messages.at(-1)).includes("30秒診断で、さらに絞り込む"), "ポイント→エージェントのカード→大きなボタンのカード");
  rr = await send([postback("tips|bizsales.a25")]);
  tj = JSON.stringify(rr.replies[0].body.messages);
  const bizCards = svcCarousel(rr.replies[0].body.messages).contents.contents;
  ok(JSON.stringify(bizCards[0]).includes("ASSIGN") && JSON.stringify(bizCards[0]).includes("いちばんのおすすめ"), "営業×20代後半: ASSIGNが先頭（いちばんのおすすめ）");
  ok(tj.includes("面接対策など選考サポートを重視") && tj.includes("選考のサポート"), "選考サポートの記載があるサービスは、その内容を表示");
  ok(tj.includes("20代後半は") && tj.includes("r.8to.jp"), "20代後半の傾向と、紹介リンクが出る");
  rr = await send([postback("tips|it_sr.a35")]);
  ok(!JSON.stringify(rr.replies[0].body.messages).includes("ASSIGN") && JSON.stringify(rr.replies[0].body.messages).includes("35歳以上は"), "35歳以上はASSIGNを出さず、35歳以上の傾向を表示");
  rr = await send([postback("tips|consul.a30")]);
  ok(JSON.stringify(rr.replies[0].body.messages).includes("Groovement Agent") && JSON.stringify(rr.replies[0].body.messages).includes("逆質問"), "コンサル×30代: Groovementと、コンサルの選考ポイント");
  rr = await send([postback("tips|medother.a25")]);
  ok(JSON.stringify(rr.replies[0].body.messages).includes("専門に特化した提携サービスは現在ありません"), "専門特化の提携先がない職種は、その旨を表示");
  rr = await send([postback("tips|nurse.zz")]);
  ok(JSON.stringify(rr.replies[0].body.messages).includes("tips|nurse.a20"), "不正な年代は、年代の選択にもどる");
  rr = await send([textEvt("選考ポイントを教えて")]);
  ok(JSON.stringify(rr.replies[0].body.messages).includes("tips|consul"), "「選考ポイント」と送ると、職種の選択画面");
  rr = await send([postback("tips|zzz")]);
  ok(JSON.stringify(rr.replies[0].body.messages).includes("tips|nurse"), "不正な職種でも、選択画面に戻る");
  rr = await send([postback(`d|${STATE}`)]);
  ok(JSON.stringify(rr.replies[0].body.messages.at(-1).quickReply).includes("tips|nurse.a30"), "診断のあとの面談ポイントは、年代を聞かずに、診断の職種・年代で開く");

  // (e) 体験記カードに、最新のnoteが並ぶ
  rr = await send([postback("taiken")]);
  const tk = JSON.stringify(rr.replies[0].body.messages);
  ok(tk.includes("https://note.com/wise_ivy1277/n/n1") && tk.includes("NEW｜10/2") && tk.includes("subon|all"), "体験記に最新のnote（RSS）と、新着note配信ボタンが出る");
  env.__noteFeed = "";
  rr = await send([postback("taiken")]);
  ok(rr.replies[0].body.messages[0].contents.contents.length >= 8, "RSSが取れないときは、従来の事例カードだけで表示");
  env.__noteFeed = FEED;

  // (f) 新着noteの購読
  rr = await send([postback("subon|nurse")]);
  ok((await store.get("sub:Uuser1"))?.k === "nurse" && JSON.stringify(rr.replies[0].body.messages).includes("配信を登録しました"), "新着noteの配信を登録できる（看護師）");
  rr = await send([postback("subon|zzz")]);
  ok(JSON.stringify(rr.replies[0].body.messages).includes("subon|nurse"), "不正な職種は、選択画面に戻る");
  const subPut = (u, k) => store.put(`sub:${u}`, { k, ts: Date.now() }, 0, { k, ts: Date.now(), dg: "" });
  await subPut("Usub2", "");
  await subPut("Usub3", "consul");

  // (g) 週次配信: 土曜10時に、職種に合う新着だけ送る
  const SAT = Date.UTC(2026, 9, 3, 1, 0, 0); // 土曜 日本時間10:00
  await store.delete("nd:last");
  const cl = makeClient(env);
  calls.length = 0;
  let budget = await loadBudget(store, env, SAT);
  let dg = await runDigest({ store, client: cl, env, now: SAT, budget });
  const pushed = calls.filter((c) => c.path === "/v2/bot/message/push");
  ok(dg.sent === 2 && dg.skippedNoMatch === 1, `購読者のうち、合う新着がある2名に送り、合わない1名（コンサル）には送らない（sent=${dg.sent}）`);
  ok(pushed.some((c) => c.body.to === "Uuser1" && JSON.stringify(c.body).includes("/n1") && !JSON.stringify(c.body).includes("/n2")), "看護師の購読者には看護師の記事だけ");
  ok(pushed.some((c) => c.body.to === "Usub2" && JSON.stringify(c.body).includes("/n2") && JSON.stringify(c.body).includes("/n3") && !JSON.stringify(c.body).includes("/n4")), "「すべて」の購読者には、前回の配信以降（直近7日）の新着だけ");
  ok(JSON.stringify(pushed[0].body).includes("配信停止") && JSON.stringify(pushed[0].body).includes("PR"), "配信の末尾に、停止方法とPRの注記");
  await budget.commit();
  calls.length = 0;
  dg = await runDigest({ store, client: cl, env, now: SAT + 3600e3, budget: await loadBudget(store, env, SAT) });
  ok(dg.sent === 0 && calls.filter((c) => c.path === "/v2/bot/message/push").length === 0, "同じ週は、送信済みの人には二重に配信しない");
  dg = await runDigest({ store, client: cl, env, now: SAT + 3 * 24 * 3600 * 1000, budget });
  ok(dg.skipped === "not-saturday-10-15", "土曜10〜15時台以外は配信しない");
  dg = await runDigest({ store, client: cl, env, now: SAT + 7 * 3600e3, budget });
  ok(dg.skipped === "not-saturday-10-15", "土曜の夕方（16時以降）は配信しない");

  // (h) 月の配信数の上限
  const tiny = await loadBudget(memoryStore(), { PUSH_MONTHLY_LIMIT: 35, PUSH_RESERVE: 30 }, SAT);
  ok(tiny.take(5) && !tiny.take(1) && tiny.left() === 0, "上限（35通−運営者用30通）を超える配信は、枠が取れない");
  tiny.refund(2);
  ok(tiny.take(2), "送信に失敗したぶんは、枠を戻せる");
  const bstore = memoryStore();
  const b1 = await loadBudget(bstore, env, SAT); b1.take(7); await b1.commit();
  ok((await loadBudget(bstore, env, SAT)).used() === 7 && (await loadBudget(bstore, env, SAT + 40 * 24 * 3600 * 1000)).used() === 0, "配信数は月ごとに数え、翌月は0から");
  await store.delete("nd:2026-10-03"); await store.delete("nd:last");
  await subPut("Uuser1", "nurse"); await subPut("Usub2", ""); // 送信済みの印をリセット
  calls.length = 0;
  dg = await runDigest({ store, client: cl, env, now: SAT, budget: await loadBudget(memoryStore(), { PUSH_MONTHLY_LIMIT: 31, PUSH_RESERVE: 30 }, SAT) });
  ok(dg.sent === 1 && dg.skippedBudget >= 1, "枠が足りないときは、送れる分だけ送り、残りは送らない");
  // 1回のCronで送る人数の上限（残りは次の時間に）
  await store.delete("nd:2026-10-03"); await store.delete("nd:last");
  await subPut("Uuser1", "nurse"); await subPut("Usub2", "");
  for (let i = 0; i < 8; i++) await subPut(`Ubulk${i}`, "");
  calls.length = 0;
  dg = await runDigest({ store, client: cl, env, now: SAT, budget: await loadBudget(memoryStore(), env, SAT), max: 4 });
  ok(dg.sent === 4 && dg.skippedCap > 0, "1回のCronで送る人数には上限があり、残りは後回し");
  dg = await runDigest({ store, client: cl, env, now: SAT + 3600e3, budget: await loadBudget(memoryStore(), env, SAT), max: 4 });
  const dg2 = await runDigest({ store, client: cl, env, now: SAT + 2 * 3600e3, budget: await loadBudget(memoryStore(), env, SAT), max: 20 });
  ok(dg.sent === 4 && dg.sent + dg2.sent >= 6, "次の時間に、残りの人へ続きを送る（送信済みの人には送らない）");

  // (i) 締切リマインド（月末の最後の3日間）
  const EOM = Date.UTC(2026, 9, 29, 3, 0, 0); // 10月29日 12:00 JST（残り2日）
  const rst = memoryStore();
  await rst.put("d:Ur1", { state: STATE, ts: EOM - 5 * 24 * 3600e3, stage: 3 }, 0, { ts: EOM - 5 * 24 * 3600e3, stage: 3, rem: "" });
  await rst.put("d:Ur2", { state: STATE, ts: EOM - 30 * 3600e3, stage: 0 }, 0, { ts: EOM - 30 * 3600e3, stage: 0, rem: "" });
  await rst.put("d:Ur3", { state: STATE, ts: EOM - 5 * 3600e3, stage: 0 }, 0, { ts: EOM - 5 * 3600e3, stage: 0, rem: "" });
  calls.length = 0;
  let fr = await runFollowups({ store: rst, client: cl, now: EOM, budget: await loadBudget(rst, env, EOM) });
  const rp = calls.filter((c) => c.path === "/v2/bot/message/push");
  ok(fr.reminded === 2 && rp.length === 2 && rp.every((c) => JSON.stringify(c.body).includes("応募締切")), "月末の最後の3日間は、応募していない人に締切リマインドを送る");
  ok(!rp.some((c) => c.body.to === "Ur3"), "診断してから20時間たっていない人には送らない");
  ok(JSON.stringify(rp[0].body).includes("あと2日") && JSON.stringify(rp[0].body).includes("全員へのプレゼントではありません"), "残り日数と「全員プレゼントではない」旨を表示");
  calls.length = 0;
  fr = await runFollowups({ store: rst, client: cl, now: EOM + 3600e3, budget: await loadBudget(rst, env, EOM) });
  ok(fr.reminded === 0, "同じ月は、リマインドを2回送らない");
  fr = await runFollowups({ store: rst, client: cl, now: Date.UTC(2026, 9, 15, 3, 0, 0), budget: await loadBudget(rst, env, EOM) });
  ok(fr.reminded === 0, "月の途中(15日)には、リマインドを送らない");
  const rst2 = memoryStore();
  for (const u of ["Ux1", "Ux2", "Ux3"]) await rst2.put(`d:${u}`, { state: STATE, ts: EOM - 5 * 24 * 3600e3, stage: 3 }, 0, { ts: EOM - 5 * 24 * 3600e3, stage: 3, rem: "" });
  fr = await runFollowups({ store: rst2, client: cl, now: EOM, budget: await loadBudget(memoryStore(), { PUSH_MONTHLY_LIMIT: 32, PUSH_RESERVE: 30 }, EOM) });
  ok(fr.reminded === 2 && fr.skippedBudget === 1, "配信数の上限に達したら、送らずに止める");

  const rst3 = memoryStore();
  for (let i = 0; i < 9; i++) await rst3.put(`d:Uc${i}`, { state: STATE, ts: EOM - 5 * 24 * 3600e3, stage: 3 }, 0, { ts: EOM - 5 * 24 * 3600e3, stage: 3, rem: "" });
  fr = await runFollowups({ store: rst3, client: cl, now: EOM, budget: await loadBudget(memoryStore(), env, EOM), max: 4 });
  ok(fr.reminded === 4 && fr.skippedCap === 5, "1回のCronで送る人数には上限があり、残りは次の時間に送る");
  fr = await runFollowups({ store: rst3, client: cl, now: EOM + 3600e3, budget: await loadBudget(memoryStore(), env, EOM), max: 4 });
  ok(fr.reminded === 4, "次の時間に、残りの人へ続きを送る");

  // (j) 配信停止で、診断の記録も購読も削除
  r = await send([textEvt("配信停止")]);
  ok(!store._dump().has("sub:Uuser1") && !store._dump().has("d:Uuser1") && JSON.stringify(r.replies[0].body.messages).includes("新着note"), "「配信停止」で、新着noteの購読も診断の記録も削除");

  // (k) あいさつ文のA/Bテスト
  const vs = new Set(["Ua", "Ub", "Uc", "Ud", "Ue", "Uf", "Ug", "Uh", "Ui", "Uj"].map(variantOf));
  ok(vs.has("a") && vs.has("b") && variantOf("Uabc") === variantOf("Uabc"), "ユーザーIDから、A/Bのどちらかに決まる（同じ人は常に同じ）");
  const uB = ["U1", "U2", "U3", "U4", "U5", "U6", "U7", "U8"].find((u) => variantOf(u) === "b");
  const evB = { ...userEvt({ type: "follow", replyToken: "rtB" }), source: { type: "user", userId: uB } };
  r = await send([evB]);
  ok(JSON.stringify(r.replies[0].body.messages[0]).includes("失敗しないために") && !JSON.stringify(r.replies[0].body.messages[0]).includes("営業9年"), "B案は、短いあいさつ文");
  const uA = ["U1", "U2", "U3", "U4", "U5", "U6", "U7", "U8"].find((u) => variantOf(u) === "a");
  r = await send([{ ...userEvt({ type: "follow", replyToken: "rtA" }), source: { type: "user", userId: uA } }]);
  ok(JSON.stringify(r.replies[0].body.messages[0]).includes("営業9年"), "A案は、経歴つきのあいさつ文");
  const ab = await store.get(`s:${new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10)}`);
  ok(ab?.follow_a >= 1 && ab?.follow_b >= 1, "A/B別の友だち追加数が集計される");

  // (l) 週次レポートに新しい指標が出る
  const rep = await buildReport(store, 7, Date.now(), { weekly: true, env });
  ok(rep.includes("ボタンの反応") && rep.includes("A/Bテスト") && rep.includes("Cron配信"), "レポートに、ボタンの反応・A/Bテスト・配信数が出る");
  delete env.__noteFeed;
}

server.close();
console.log(`\n結果: pass=${pass} fail=${fail}`);
process.exit(fail ? 1 : 0);
