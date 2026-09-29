// 全メッセージをLINEの検証APIにかけ、Flexの記述ミスを事前に検出する。
// 使い方: LINE_CHANNEL_ACCESS_TOKEN=xxx node scripts/validate-messages.mjs
import { makeClient } from "../src/core/line.mjs";
import { JOBS, SUBS, AGES, INCOMES, INCOME_UNKNOWN, PRIORITIES, TIMINGS, AREAS } from "../src/core/labels.mjs";
import { questionMessage, resultMessages, salaryAskMessage, salaryResultMessage } from "../src/core/diagnosis.mjs";
import * as M from "../src/core/messages.mjs";
import { followupMessage } from "../src/core/followup.mjs";
import { encode } from "../src/core/state.mjs";

const BASE = "https://example.workers.dev";
const client = makeClient({ LINE_CHANNEL_ACCESS_TOKEN: process.env.LINE_CHANNEL_ACCESS_TOKEN });
let n = 0, bad = 0;

async function check(name, messages) {
  for (let i = 0; i < messages.length; i += 5) {
    const chunk = messages.slice(i, i + 5);
    try {
      await client.validateReply(chunk);
      n++;
    } catch (e) {
      bad++;
      console.log("NG", name, JSON.stringify(e.body).slice(0, 400));
    }
    await new Promise((r) => setTimeout(r, 60));
  }
}

// 質問カード（全ステップ）
await check("q:j", [questionMessage("j", {}, BASE)]);
for (const [j, sub] of Object.entries(SUBS)) await check(`q:s:${j}`, [questionMessage("s", { j }, BASE)]);
await check("q:g", [questionMessage("g", { j: "office" }, BASE)]);
await check("q:i", [questionMessage("i", { j: "office", g: "a25" }, BASE)]);
await check("q:p", [questionMessage("p", { j: "office", g: "a25", i: "i4" }, BASE)]);
await check("q:t", [questionMessage("t", { j: "office", g: "a25", i: "i4", p: "up" }, BASE)]);
await check("q:r", [questionMessage("r", { j: "it", s: "it_none", g: "a25", i: "i4", p: "up", t: "now" }, BASE)]);

// 診断結果（代表パターン）
const samples = [
  { j: "med", s: "nurse", g: "a30", i: "i5", p: "haken", t: "m3" },
  { j: "med", s: "care", g: "a25", i: "ix", p: "new", t: "now" },
  { j: "med", s: "child", g: "a25", i: "i3", p: "fit", t: "info" },
  { j: "med", s: "medother", g: "a35", i: "i5", p: "car", t: "m6" },
  { j: "it", s: "it_none", g: "a25", i: "i3", p: "new", t: "now", r: "kanto" },
  { j: "it", s: "it_sr", g: "a30", i: "i7", p: "up", t: "m3" },
  { j: "sales", s: "bizsales", g: "a25", i: "i4", p: "up", t: "m3" },
  { j: "sales", s: "bizsales", g: "a35", i: "i5", p: "car", t: "m6", r: "kansai" },
  { j: "office", g: "a30", i: "i3", p: "haken", t: "info" },
  { j: "tech", s: "mfg", g: "a25", i: "i0", p: "up", t: "now" },
  { j: "const", g: "a25", i: "i4", p: "up", t: "m3" },
  { j: "other", s: "dis", g: "a30", i: "ix", p: "wl", t: "m3" },
];
for (const a of samples) await check(`result:${encode(a)}`, resultMessages(a, BASE));

// その他のパネル
await check("welcome", M.welcomeMessages(BASE, "テスト太郎"));
await check("welcome-noname", M.welcomeMessages(BASE));
await check("welcome-returning", M.welcomeMessages(BASE, "テスト太郎", { returning: true }));
await check("campaign", [M.campaignMessage(BASE)]);
await check("steps", [M.stepsMessage(BASE)]);
await check("receipt", M.receiptMessages(BASE));
await check("taiken", [M.taikenMessage(BASE)]);
await check("knowledge", [M.knowledgeMessage(BASE)]);
await check("faq-menu", [M.faqMenuMessage()]);
for (const k of Object.keys(M.FAQ)) await check(`faq:${k}`, [M.faqAnswerMessage(k)]);
await check("about", [M.aboutMessage(BASE)]);
await check("policy", [M.policyMessage(BASE)]);
await check("privacy", [M.privacyMessage(BASE)]);
await check("contact", [M.contactMessage()]);
await check("home", [M.homeMessage(BASE)]);
await check("fallback", M.fallbackMessages(BASE));
await check("salary-ask", [salaryAskMessage(BASE)]);
for (const i of INCOMES) await check(`salary:${i.v}`, [salaryResultMessage(i.v, BASE)]);
await check("followup0", [followupMessage(0, "j:med,s:nurse,g:a30,i:i5,p:wl,t:m3")]);
await check("followup1", [followupMessage(1, "j:med,s:nurse,g:a30,i:i5,p:wl,t:m3")]);

console.log(`validated=${n} invalid=${bad}`);
process.exit(bad ? 1 : 0);
