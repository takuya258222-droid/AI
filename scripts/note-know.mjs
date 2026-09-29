// note用の画像「このアカウントで知れること」を作る。使い方: node scripts/note-know.mjs → public/img/note/account-know.png
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "public/img/note/account-know.png");

const icon = (d) => `<svg viewBox="0 0 48 48" width="56" height="56" fill="none" stroke="#e3c98a" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const ICONS = {
  book: icon('<path d="M6 10h14a4 4 0 0 1 4 4v24a3 3 0 0 0-3-3H6z"/><path d="M42 10H28a4 4 0 0 0-4 4v24a3 3 0 0 1 3-3h15z"/>'),
  chart: icon('<path d="M8 40V8"/><path d="M8 40h34"/><rect x="14" y="26" width="6" height="10" rx="1"/><rect x="25" y="18" width="6" height="18" rx="1"/><rect x="36" y="10" width="6" height="26" rx="1"/>'),
  compass: icon('<circle cx="24" cy="24" r="17"/><path d="M31 17l-4 10-10 4 4-10z"/>'),
  chat: icon('<path d="M8 10h32a2 2 0 0 1 2 2v20a2 2 0 0 1-2 2H22l-9 7v-7H8a2 2 0 0 1-2-2V12a2 2 0 0 1 2-2z"/><path d="M15 20h18M15 27h11"/>'),
};
const CARDS = [
  { ic: "book", tag: "連載", title: "転職体験記", desc: "動機・選考・年収の増減・後悔・その後まで。リアルな転職の全記録" },
  { ic: "chart", tag: "公的データ", title: "職種別のデータと相場", desc: "厚生労働省などの公的データをもとに整理" },
  { ic: "compass", tag: "職種 × 年齢 × 優先順位", title: "サービスの選び方", desc: "どんな人に、どのサービスが向くのかを解説" },
  { ic: "chat", tag: "完全無料", title: "公式LINE", desc: "タップだけ・30秒。合うサービスを、理由つきで2〜4社に絞る" },
];
const card = (c, i) => `<div class="card ${i === 3 ? "line" : ""}"><div class="ic">${ICONS[c.ic]}</div><div class="txt"><div class="tag">${c.tag}</div><div class="ti">${c.title}</div><div class="de">${c.desc}</div></div></div>`;

const html = `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700;900&display=block" rel="stylesheet">
<style>*{box-sizing:border-box;margin:0}body{width:1200px;background:#f6f3ec;font-family:'Noto Sans JP',sans-serif;color:#1c2233}
.head{background:linear-gradient(135deg,#0d1b3e,#16295a);color:#fff;padding:38px 48px 34px}
.head .q{font-size:26px;font-weight:700;color:#e3c98a}
.head h1{font-size:54px;font-weight:900;line-height:1.3;margin-top:6px}
.head h1 em{font-style:normal;color:#e3c98a}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:22px;padding:34px 40px 10px}
.card{display:flex;gap:20px;align-items:center;background:#fff;border:2px solid #e3d3a4;border-radius:20px;padding:26px 26px;min-height:190px}
.card.line{background:linear-gradient(135deg,#fff8e6,#f6e8c2);border-color:#c9a55c}
.ic{flex:none;width:92px;height:92px;border-radius:22px;background:#0d1b3e;display:flex;align-items:center;justify-content:center}
.tag{display:inline-block;font-size:19px;font-weight:700;color:#8a6521;background:#faf5e8;border:1.5px solid #e3d3a4;border-radius:999px;padding:1px 14px;margin-bottom:6px}
.line .tag{background:#0d1b3e;color:#e3c98a;border-color:#0d1b3e}
.ti{font-size:34px;font-weight:900;line-height:1.3}
.de{font-size:22px;color:#4a5168;line-height:1.55;margin-top:4px}
.foot{padding:16px 48px 30px;font-size:19px;color:#6b7285;line-height:1.6}
</style></head><body><div id="card">
<div class="head"><div class="q">転職エージェントを、戦略的に使うために</div><h1>このアカウントで<em>知れること</em></h1></div>
<div class="grid">${CARDS.map(card).join("")}</div>
<div class="foot">運営：なぎ（元転職エージェント／営業9年・支援成約800名・相談8,000名超）<br>診断もご紹介も求職者の方は無料、登録は任意です。各サービスの条件は、各社のご案内をご確認ください。<br>※当アカウントは紹介リンク経由の登録で各社から報酬を受け取る場合があります（PR）</div>
</div></body></html>`;

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1200, height: 900 }, deviceScaleFactor: 1 });
await page.setContent(html, { waitUntil: "networkidle", timeout: 45000 });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(250);
await page.locator("#card").screenshot({ path: OUT });
console.log("card:", OUT);
await browser.close();
