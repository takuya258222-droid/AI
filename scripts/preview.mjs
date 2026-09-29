// Flex Message の簡易プレビュー画像を出力する（開発用・LINE実機とは細部が異なります）
// 使い方: node scripts/preview.mjs   → screenshots/preview/*.png
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { questionMessage, resultMessages, salaryResultMessage } from "../src/core/diagnosis.mjs";
import * as M from "../src/core/messages.mjs";
import * as T from "../src/core/tools.mjs";
import { followupMessage, remindMessage } from "../src/core/followup.mjs";
import { tipsMessage, tipsPickerMessage } from "../src/core/tips.mjs";
import { digestMessage } from "../src/core/notefeed.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "screenshots/preview");
fs.mkdirSync(OUT, { recursive: true });
const BASE = "file://" + path.join(ROOT, "public");

const KW = { none: 0, xs: 2, sm: 4, md: 8, lg: 12, xl: 16, xxl: 20 };
const px = (v, d = 0) => (v == null ? d : typeof v === "number" ? v : KW[v] ?? parseFloat(v));
const FS = { xxs: 10, xs: 12, sm: 14, md: 16, lg: 19, xl: 22, xxl: 25, "3xl": 30 };
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/\n/g, "<br>");
const W = { nano: 120, micro: 160, kilo: 260, mega: 300, giga: 340 };

function styleBox(n, parent) {
  const s = [];
  if (n.flex != null) s.push(`flex:${n.flex} ${n.flex === 0 ? 0 : 1} ${n.flex === 0 ? "auto" : "0"}`);
  else if (parent?.layout === "horizontal") s.push("flex:1 1 0");
  if (n.width) s.push(`width:${n.width}`);
  if (n.height) s.push(`height:${n.height}`);
  if (n.margin) s.push(`margin-${parent?.layout === "horizontal" ? "left" : "top"}:${px(n.margin)}px`);
  for (const k of ["paddingAll", "paddingTop", "paddingBottom", "paddingStart", "paddingEnd"]) {
    if (n[k] != null) s.push(`${{ paddingAll: "padding", paddingTop: "padding-top", paddingBottom: "padding-bottom", paddingStart: "padding-left", paddingEnd: "padding-right" }[k]}:${px(n[k])}px`);
  }
  if (n.backgroundColor) s.push(`background:${n.backgroundColor}`);
  if (n.background?.type === "linearGradient") s.push(`background:linear-gradient(${n.background.angle},${n.background.startColor},${n.background.endColor})`);
  if (n.cornerRadius) s.push(`border-radius:${px(n.cornerRadius)}px`);
  if (n.borderWidth) s.push(`border:${px(n.borderWidth, 1)}px solid ${n.borderColor || "#ccc"}`);
  if (n.justifyContent) s.push(`justify-content:${{ "flex-start": "flex-start", center: "center", "flex-end": "flex-end", "space-between": "space-between" }[n.justifyContent] || "flex-start"}`);
  if (n.alignItems) s.push(`align-items:${n.alignItems}`);
  return s.join(";");
}

function node(n, parent) {
  switch (n.type) {
    case "box": {
      const gap = n.spacing ? px(n.spacing) : 0;
      const kids = n.contents.map((c) => node(c, n)).join("");
      return `<div style="display:flex;flex-direction:${n.layout === "horizontal" ? "row" : "column"};${gap ? `gap:${gap}px;` : ""}box-sizing:border-box;min-width:0;${styleBox(n, parent)}">${kids}</div>`;
    }
    case "text": {
      const st = [`font-size:${FS[n.size || "md"]}px`, `color:${n.color || "#111"}`, `font-weight:${n.weight === "bold" ? 700 : 400}`, `text-align:${{ start: "left", end: "right", center: "center" }[n.align] || "left"}`, "line-height:1.45", "min-width:0"];
      if (n.flex != null) st.push(`flex:${n.flex} ${n.flex === 0 ? 0 : 1} ${n.flex === 0 ? "auto" : "0"}`);
      else if (parent?.layout === "horizontal") st.push("flex:1 1 0");
      if (n.margin) st.push(`margin-${parent?.layout === "horizontal" ? "left" : "top"}:${px(n.margin)}px`);
      if (n.wrap === false) st.push("white-space:nowrap");
      if (n.maxLines) st.push(`display:-webkit-box;-webkit-line-clamp:${n.maxLines};-webkit-box-orient:vertical;overflow:hidden`);
      return `<div style="${st.join(";")}">${esc(n.text)}</div>`;
    }
    case "separator":
      return `<div style="height:1px;background:${n.color || "#ddd"};margin-top:${px(n.margin, 0)}px"></div>`;
    case "button": {
      const link = n.style === "link";
      return `<div style="text-align:center;padding:${link ? 8 : 12}px;color:${n.color || "#0a66ff"};font-size:14px;margin-top:0">${esc(n.action.label)}</div>`;
    }
    case "image": {
      const f = n.url.replace("file://", "");
      const src = fs.existsSync(f) ? `data:image/${f.endsWith(".png") ? "png" : "jpeg"};base64,${fs.readFileSync(f).toString("base64")}` : n.url;
      return `<img src="${src}" style="width:100%;aspect-ratio:${(n.aspectRatio || "1:1").replace(":", "/")};object-fit:cover;display:block">`;
    }
    default:
      return "";
  }
}

function bubbleHtml(b) {
  const w = W[b.size || "mega"];
  const part = (p, k) => (p ? `<div style="background:${b.styles?.[k]?.backgroundColor || "#fff"}">${node(p, null)}</div>` : "");
  return `<div style="width:${w}px;flex:none;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.25);font-family:'Noto Sans JP',sans-serif">${b.hero ? node(b.hero, null) : ""}${part(b.body, "body")}${part(b.footer, "footer")}</div>`;
}

function messageHtml(m) {
  if (m.type === "text") return `<div style="max-width:300px;background:#fff;padding:10px 14px;border-radius:14px;font-size:14px;line-height:1.5">${esc(m.text)}</div>`;
  const c = m.contents;
  const bubbles = c.type === "carousel" ? c.contents : [c];
  return `<div style="display:flex;gap:8px;align-items:flex-start">${bubbles.map(bubbleHtml).join("")}</div>`;
}

const jobs = {
  welcome: M.welcomeMessages(BASE, "テスト"),
  q1: [questionMessage("j", {}, BASE)],
  q_income: [questionMessage("i", { j: "med", s: "nurse", g: "a30" }, BASE)],
  q_priority: [questionMessage("p", { j: "med", s: "nurse", g: "a30", i: "i5" }, BASE)],
  result_nurse: resultMessages({ j: "med", s: "nurse", g: "a30", i: "i5", p: "haken", t: "m3" }, BASE),
  result_sales: resultMessages({ j: "sales", s: "bizsales", g: "a25", i: "i4", p: "up", t: "m3" }, BASE),
  result_it: resultMessages({ j: "it", s: "it_none", g: "a25", i: "i3", p: "fit", t: "info", r: "kanto" }, BASE),
  result_consul: resultMessages({ j: "consul", g: "a25", i: "i5", p: "up", t: "m3", r: "kansai" }, BASE),
  result_ma: resultMessages({ j: "ma", g: "a25", i: "i4", p: "car", t: "m3" }, BASE),
  salary: [salaryResultMessage("i4", BASE)],
  campaign: [M.campaignMessage(BASE)],
  taiken: [M.taikenMessage(BASE)],
  receipt: M.receiptMessages(BASE),
  faq: [M.faqMenuMessage(), M.faqAnswerMessage("free")],
  about_policy: [M.aboutMessage(BASE), M.policyMessage(BASE), M.privacyMessage(BASE)],
  knowledge: [M.knowledgeMessage(BASE)],
  tools: [T.consultMessage(BASE), T.netResultMessage("i4", BASE), T.planResultMessage("m3"), T.prepSheetMessage(BASE)],
  followup: [followupMessage(0, "j:med"), followupMessage(1, "j:med")],
  followup3_remind: [followupMessage(2, "j:med,s:nurse,g:a30,i:i5,p:wl,t:m3"), remindMessage(2, "j:med,s:nurse,g:a30,i:i5,p:wl,t:m3")],
  tips: [tipsMessage("nurse"), tipsMessage("consul"), tipsPickerMessage("tips")],
  reg_home: [M.regMessages("m", "j:med,s:nurse,g:a30,i:i5,p:wl,t:m3")[0].type === "text" ? M.homeMessage(BASE) : null].filter(Boolean),
  taiken_latest: [M.taikenMessage(BASE, [
    { title: "【転職事例No.6】【薬剤師】時短で勤務は25%減。なのに年収は190万円落ちた ―― 消えた管理薬剤師手当50,000円と、派遣で510万円に戻すまでの給与明細", link: "https://note.com/wise_ivy1277/n/n56586a2f4fe6", ts: Date.parse("2026-09-27T21:59:37+0900"), thumb: "" },
    { title: "【コンサル】ケース面接で落ちる人の共通点", link: "https://note.com/wise_ivy1277/n/x", ts: Date.parse("2026-09-28T09:00:00+0900"), thumb: "" },
  ])],
  digest: [digestMessage([{ title: "【看護師】夜勤をやめたら年収はどうなる", link: "https://note.com/wise_ivy1277/n/n1", ts: Date.parse("2026-10-02T20:00:00+0900"), thumb: "" }])],
};

const only = process.argv[2];
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox", "--allow-file-access-from-files"] });
const page = await browser.newPage({ viewport: { width: 1500, height: 900 }, deviceScaleFactor: 1.4 });
for (const [name, msgs] of Object.entries(jobs)) {
  if (only && only !== name) continue;
  const html = `<html><head><link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;700&display=block" rel="stylesheet"></head><body style="margin:0;background:#8fa3b8;padding:20px;display:flex;flex-direction:column;gap:14px;align-items:flex-start;width:max-content;min-width:340px">${msgs.map(messageHtml).join("")}</body></html>`;
  await page.setContent(html, { waitUntil: "networkidle", timeout: 45000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true });
  console.log("preview:", name);
}
await browser.close();
