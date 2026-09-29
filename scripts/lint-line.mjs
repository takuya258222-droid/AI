// LINEの仕様上の制限に、全メッセージ・全診断ルートが収まっているかをローカルで総当たり検査する。
// （実物の検証APIは LINE_CHANNEL_ACCESS_TOKEN が要るので、それができない環境でも回せる代わりの検査）
// 使い方: node scripts/lint-line.mjs
import fs from "node:fs";
import path from "node:path";
import { questionMessage, resultMessages, resultFallbackMessages, salaryAskMessage, salaryResultMessage } from "../src/core/diagnosis.mjs";
import * as M from "../src/core/messages.mjs";
import * as T from "../src/core/tools.mjs";
import { followupMessage, remindMessage } from "../src/core/followup.mjs";
import { tipsFlow, tipsAgePickerMessage, tipsPickerMessage, TIP_KEYS } from "../src/core/tips.mjs";
import { digestMessage, parseFeed, latestNoteBubble } from "../src/core/notefeed.mjs";
import { INCOMES } from "../src/core/labels.mjs";
import { decode, encode, parseData, nextKey } from "../src/core/state.mjs";
import { decide } from "../src/core/matcher.mjs";

const BASE = "https://career-line-bot.example.workers.dev";
const PUBLIC = path.resolve("public");
const enc = new TextEncoder();
let msgCount = 0, problems = new Map();
const bad = (where, what) => { const k = `${what}`; const e = problems.get(k) ?? { n: 0, where }; e.n++; problems.set(k, e); };

function walk(o, fn, p = "") {
  if (Array.isArray(o)) return o.forEach((x, i) => walk(x, fn, `${p}[${i}]`));
  if (o && typeof o === "object") { fn(o, p); for (const [k, v] of Object.entries(o)) walk(v, fn, `${p}.${k}`); }
}

function checkAction(a, where) {
  if (!a || typeof a !== "object" || !a.type) return;
  if (a.label !== undefined && [...a.label].length > 20) bad(where, `action.label>20: ${a.label}`);
  if (a.type === "postback") {
    if (!a.data) bad(where, "postback without data");
    else if (enc.encode(a.data).length > 300) bad(where, `postback.data>300B: ${a.data}`);
    if (a.displayText && [...a.displayText].length > 300) bad(where, "displayText>300");
    const { action, arg } = parseData(a.data ?? "");
    if ((action === "d" || action === "b") && arg && encode(decode(arg)) !== arg) bad(where, `postback state not round-trip: ${a.data}`);
  }
  if (a.type === "uri") {
    if (!a.uri || a.uri.length > 1000) bad(where, `uri length: ${String(a.uri).slice(0, 60)}`);
    else if (!/^(https:\/\/|line:\/\/|tel:|mailto:)/.test(a.uri)) bad(where, `uri scheme: ${a.uri.slice(0, 60)}`);
  }
  if (a.type === "message" && (!a.text || a.text.length > 300)) bad(where, "message action text");
}

function checkMessage(m, where) {
  msgCount++;
  if (m.type === "text") {
    if (!m.text || m.text.length > 5000) bad(where, "text length");
  } else if (m.type === "flex") {
    if (!m.altText || m.altText.length > 400) bad(where, `altText length: ${m.altText?.length}`);
    const size = enc.encode(JSON.stringify(m.contents)).length;
    if (size > 45000) bad(where, `flex size ${size}B (limit 50000)`);
    if (m.contents?.type === "carousel" && (m.contents.contents.length < 1 || m.contents.contents.length > 12)) bad(where, "carousel bubbles");
  } else if (m.type === "image") {
    for (const k of ["originalContentUrl", "previewImageUrl"]) if (!/^https:\/\//.test(m[k] ?? "")) bad(where, `image ${k} not https`);
  } else bad(where, `unknown type ${m.type}`);

  if (m.quickReply) {
    const items = m.quickReply.items ?? [];
    if (items.length > 13) bad(where, "quickReply>13");
    for (const it of items) checkAction(it.action, where);
  }
  walk(m, (o) => {
    if (o.type === "text" && typeof o.text === "string" && m.type === "flex" && !o.text.length && !o.contents) bad(where, "flex empty text");
    if (o.type === "box" && !Array.isArray(o.contents)) bad(where, "flex box without contents array");
    if (o.action) checkAction(o.action, where);
    if (o.type === "image" && o.url !== undefined) {
      if (!/^https:\/\//.test(o.url)) bad(where, `flex image url: ${o.url}`);
      else if (o.url.startsWith(BASE + "/")) {
        const f = path.join(PUBLIC, decodeURIComponent(o.url.slice(BASE.length + 1).split("?")[0]));
        if (!fs.existsSync(f)) bad(where, `image file missing: ${o.url}`);
      }
    }
  });
  const s = JSON.stringify(m);
  if (/undefined|\[object Object\]|NaN/.test(s)) bad(where, `stray value in message: ${(s.match(/.{20}(undefined|\[object Object\]|NaN).{10}/) ?? [""])[0]}`);
}

function checkReply(msgs, where) {
  if (!Array.isArray(msgs) || !msgs.length) return bad(where, "empty reply");
  if (msgs.length > 5) bad(where, `reply>5 messages (${msgs.length})`);
  msgs.forEach((m) => checkMessage(m, where));
}

// ---- 1) 診断の全ルートを、実際のボタンをたどって総当たり ----
const seen = new Set();
const queue = [{}];
let terminals = 0, questions = 0;
while (queue.length) {
  const a = queue.pop();
  const key = encode(a);
  if (seen.has(key)) continue;
  seen.add(key);
  const nk = nextKey(a);
  if (nk) {
    questions++;
    const q = questionMessage(nk, a, BASE);
    checkReply([q], `question ${nk} ${key}`);
    walk(q, (o) => { if (o.type === "postback" && o.data?.startsWith("d|")) queue.push(decode(o.data.slice(2))); });
    continue;
  }
  terminals++;
  const res = decide(a);
  if (res.status === "need_area") {
    const q = questionMessage("r", a, BASE);
    checkReply([q], `question r ${key}`);
    walk(q, (o) => { if (o.type === "postback" && o.data?.startsWith("d|")) queue.push(decode(o.data.slice(2))); });
    continue;
  }
  const msgs = resultMessages(a, BASE);
  checkReply(msgs, `result ${key}`);
  const svc = msgs.at(-1); // 紹介リンクのカルーセルが、いちばん下（最後の吹き出し）。その最後の1枚が、登録の意思ボタン
  if (!/https:\/\//.test(JSON.stringify(svc)) || svc.contents?.type !== "carousel" || !JSON.stringify(svc).includes("紹介リンク経由の登録で")) bad(`result ${key}`, "紹介リンクのカードが最後にない");
  if (!JSON.stringify(svc.contents.contents.at(-1)).includes("regy|") || !svc.quickReply) bad(`result ${key}`, "最後のカードに、登録の意思ボタン（とクイックリプライ）がない");
  if (JSON.stringify(msgs).includes("REAL STORIES")) bad(`result ${key}`, "noteの体験記カードが残っている");
  const fb = resultFallbackMessages(a);
  if (!fb) bad(`result ${key}`, "文字だけの代替が作れない");
  else { checkReply(fb, `fallback ${key}`); for (const p of res.picks) if (!fb[0].text.includes(p.service.url)) bad(`fallback ${key}`, `代替に紹介URLがない ${p.service.id}`); }
  for (const p of res.picks) if (!/^https:\/\/r\.8to\.jp\//.test(p.service.url) && !/^https:\/\//.test(p.service.url)) bad(`result ${key}`, `service url ${p.service.id}`);
}

// ---- 2) その他のパネル ----
const misc = {
  welcome: M.welcomeMessages(BASE, "テスト太郎"), "welcome-noname": M.welcomeMessages(BASE), "welcome-returning": M.welcomeMessages(BASE, "テスト太郎", { returning: true }),
  campaign: [M.campaignMessage(BASE)], steps: [M.stepsMessage(BASE)], receipt: M.receiptMessages(BASE), taiken: [M.taikenMessage(BASE)], knowledge: [M.knowledgeMessage(BASE)],
  "faq-menu": [M.faqMenuMessage()], about: [M.aboutMessage(BASE)], policy: [M.policyMessage(BASE)], privacy: [M.privacyMessage(BASE)], contact: [M.contactMessage()],
  home: [M.homeMessage(BASE)], fallback: M.fallbackMessages(BASE), "salary-ask": [salaryAskMessage(BASE)],
  "net-ask": [T.netAskMessage(BASE)], prep: [T.prepSheetMessage(BASE)], "plan-ask": [T.planAskMessage()], share: [T.shareMessage()], consult: [T.consultMessage(BASE)],
};
for (const k of Object.keys(M.FAQ)) misc[`faq:${k}`] = [M.faqAnswerMessage(k)];
for (const i of INCOMES) { misc[`salary:${i.v}`] = [salaryResultMessage(i.v, BASE)]; misc[`net:${i.v}`] = [T.netResultMessage(i.v, BASE)]; }
for (const k of ["m3", "m6", "y1"]) misc[`plan:${k}`] = [T.planResultMessage(k)];
for (const [name, msgs] of Object.entries(misc)) checkReply(msgs, name);

// 施策の新しいメッセージ（面談ポイント・登録の意思ボタン・リマインド・新着note）
{
  checkReply([tipsPickerMessage("tips")], "tips-picker");
  checkReply([tipsPickerMessage("sub")], "sub-picker");
  for (const k of TIP_KEYS) {
    checkReply([tipsAgePickerMessage(k)], `tips-age:${k}`);
    for (const g of ["a20", "a25", "a30", "a35"]) checkReply(tipsFlow(`${k}.${g}`, BASE), `tips:${k}.${g}`);
  }
  checkReply(tipsFlow("zzz", BASE), "tips:bad"); checkReply(tipsFlow("nurse.zz", BASE), "tips:bad-age");
  for (const kind of ["y", "m", "l"]) for (const st of ["j:med,s:nurse,g:a30,i:i5,p:wl,t:m3", "", "j:hacker"]) checkReply(M.regMessages(kind, st), `reg${kind} ${st}`);
  for (const k of [...TIP_KEYS, "all", "zzz"]) checkReply(M.subOnMessage(k), `subon:${k}`);
  const FEED = `<rss><channel><item><title>【看護師】テスト記事</title><media:thumbnail>https://assets.st-note.com/a.png?width=800</media:thumbnail><pubDate>Fri, 02 Oct 2026 20:00:00 +0900</pubDate><link>https://note.com/wise_ivy1277/n/n1</link></item><item><title>長いタイトル${"あ".repeat(200)}</title><pubDate>Fri, 02 Oct 2026 19:00:00 +0900</pubDate><link>https://note.com/wise_ivy1277/n/n2</link></item></channel></rss>`;
  const items = parseFeed(FEED);
  checkReply([digestMessage(items)], "digest");
  checkReply([M.taikenMessage(BASE, items)], "taiken+latest");
  checkReply([M.taikenMessage(BASE)], "taiken");
  checkReply([latestNoteBubble(items[1]) && { type: "flex", altText: "x", contents: latestNoteBubble(items[1]) }], "note-bubble-nothumb");
  for (const d of [0, 1, 2]) checkReply([remindMessage(d, "j:med,s:nurse,g:a30,i:i5,p:wl,t:m3")], `remind${d}`);
  for (const [n, v] of [["a", "a"], ["b", "b"]]) checkReply(M.welcomeMessages(BASE, "テスト太郎", { variant: v }), `welcome-${n}`);
}

// フォロー配信（診断済みの人／state が壊れている人）
for (const st of [null, "", "j:med,s:nurse,g:a30,i:i5,p:wl,t:m3", "j:hacker", "j:it,s:it_none,g:a25,i:i3,p:new,t:now,r:kanto"]) {
  for (const stage of [0, 1, 2]) {
    try { checkReply([followupMessage(stage, st)], `followup${stage} ${st}`); } catch (e) { bad(`followup${stage} ${st}`, `throws: ${e.message}`); }
  }
}

// ---- 3) 壊れた入力でも例外を出さない（改ざん・古いボタン） ----
const fuzz = ["", "d", "d|", "d|j", "d|j:", "d|j:zzz", "d|j:med,s:zzz", "d|s:nurse", "d|j:med,s:nurse,g:zz,i:zz,p:zz,t:zz", "d|j:it,s:it_none,g:a25,i:i3,p:new,t:now,r:mars",
  "d|j:med,j:it", "d|" + "j:med,".repeat(100), "b|j:med", "b|", "b|zzz", "d|j:med,s:nurse,g:a30,i:i5,p:wl,t:m3,r:kanto", "d|__proto__:x", "d|constructor:y", "d|j:__proto__"];
for (const d of fuzz) {
  try {
    const { action, arg } = parseData(d);
    const a = decode(arg);
    const nk = nextKey(a);
    if (nk) questionMessage(nk, a, BASE); else { const r = resultMessages(a, BASE); if (!Array.isArray(r) || !r.length) bad(`fuzz ${d}`, "result empty"); }
  } catch (e) { bad(`fuzz ${d.slice(0, 40)}`, `throws: ${e.message}`); }
}

console.log(`診断ルート: 質問状態=${questions} 完了状態=${terminals}／検査したメッセージ=${msgCount}`);
if (problems.size) {
  for (const [what, e] of problems) console.log(`  ✗ ${what}  ×${e.n}  例: ${e.where}`);
  console.log(`\n結果: 問題 ${problems.size} 種類`);
  process.exit(1);
}
console.log("結果: 問題なし");
