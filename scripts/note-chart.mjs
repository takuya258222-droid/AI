// note用グラフ「有料職業紹介の事業所数の推移」を作る。使い方: node scripts/note-chart.mjs → public/img/note/agent-count.png
// データ出典：厚生労働省 職業安定局需給調整事業課調べ「民営職業紹介事業所数の推移【事業報告】」の有料職業紹介事業所数
//   https://www.mhlw.go.jp/content/11600000/001699953.pdf （平成2年度〜令和7年度）
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "public/img/note/agent-count.png");

// 年度（西暦）: 有料職業紹介事業所数。平成2年度=1990 … 令和7年度=2025
const START = 1990;
const DATA = [
  3071, 3213, 3318, 3307, 3273, 3227, 3187, 3375, 3498, 3727, // 1990-1999（平成2〜11）
  4675, 5562, 6441, 7234, 8689, 10375, 12808, 15453, 17165, 17084, // 2000-2009（平成12〜21）
  17024, 16613, 16916, 17315, 17893, 18457, 19355, 20783, 22977, // 2010-2018（平成22〜30）
  25684, 26793, 27899, 28740, 30113, 31486, 32751, // 2019-2025（令和元〜7）
];
if (DATA.length !== 36) throw new Error("データ数が想定と違います: " + DATA.length);

const W = 1200, H = 675;
const PAD = { l: 90, r: 40, t: 250, b: 150 };
const MAX = 35000;
const plotW = W - PAD.l - PAD.r, plotH = H - PAD.t - PAD.b;
const bw = plotW / DATA.length;
const y = (v) => PAD.t + plotH - (v / MAX) * plotH;
const fmt = (n) => n.toLocaleString("en-US");
const label = { 0: "平成2年度\n(1990)", 10: "平成12年度\n(2000)", 25: "平成27年度\n(2015)", 35: "令和7年度\n(2025)" };
const showVal = new Set([0, 10, 25, 35]);

const bars = DATA.map((v, i) => {
  const x = PAD.l + i * bw + bw * 0.14, w = bw * 0.72;
  const last = i === DATA.length - 1;
  const fill = last ? "url(#gold)" : i >= 25 ? "#5b78c4" : "#3a4f8f";
  return `<rect x="${x.toFixed(1)}" y="${y(v).toFixed(1)}" width="${w.toFixed(1)}" height="${(PAD.t + plotH - y(v)).toFixed(1)}" rx="3" fill="${fill}"/>`;
}).join("");
const vals = [...showVal].map((i) => {
  const cx = PAD.l + i * bw + bw / 2;
  const anchor = i === 0 ? "start" : i === DATA.length - 1 ? "end" : "middle";
  const dx = i === 0 ? -bw * 0.4 : i === DATA.length - 1 ? bw * 0.4 : 0;
  return `<text x="${(cx + dx).toFixed(1)}" y="${(y(DATA[i]) - 12).toFixed(1)}" text-anchor="${anchor}" font-size="${i === DATA.length - 1 ? 30 : 24}" font-weight="900" fill="${i === DATA.length - 1 ? "#8a6521" : "#1c2233"}">${fmt(DATA[i])}</text>`;
}).join("");
const ticks = Object.entries(label).map(([i, t]) => {
  const cx = PAD.l + Number(i) * bw + bw / 2;
  const [a, b] = t.split("\n");
  const anchor = Number(i) === 0 ? "start" : Number(i) === DATA.length - 1 ? "end" : "middle";
  const dx = Number(i) === 0 ? -bw * 0.4 : Number(i) === DATA.length - 1 ? bw * 0.4 : 0;
  return `<text x="${(cx + dx).toFixed(1)}" y="${PAD.t + plotH + 32}" text-anchor="${anchor}" font-size="22" font-weight="700" fill="#1c2233">${a}</text><text x="${(cx + dx).toFixed(1)}" y="${PAD.t + plotH + 58}" text-anchor="${anchor}" font-size="20" fill="#6b7285">${b}</text>`;
}).join("");
const grid = [0, 10000, 20000, 30000].map((g) => `<line x1="${PAD.l}" x2="${W - PAD.r}" y1="${y(g)}" y2="${y(g)}" stroke="#d9d3c3" stroke-width="${g === 0 ? 2 : 1}"/><text x="${PAD.l - 10}" y="${y(g) + 7}" text-anchor="end" font-size="20" fill="#6b7285">${g === 0 ? "0" : fmt(g)}</text>`).join("");

const html = `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;700;900&display=block" rel="stylesheet">
<style>*{box-sizing:border-box;margin:0}body{width:${W}px;height:${H}px;background:#f6f3ec;font-family:'Noto Sans JP',sans-serif;color:#1c2233;position:relative;overflow:hidden}
.head{position:absolute;left:0;right:0;top:0;height:210px;background:linear-gradient(135deg,#0d1b3e,#16295a);color:#fff;padding:26px 44px}
.head .q{font-size:26px;font-weight:700;color:#e3c98a}
.head h1{font-size:50px;font-weight:900;line-height:1.3;margin-top:6px}
.head h1 em{font-style:normal;color:#e3c98a}
.head .sub{font-size:26px;font-weight:500;color:#d5daea;margin-top:8px}
svg{position:absolute;left:0;top:0}
.foot{position:absolute;left:44px;right:44px;bottom:16px;font-size:17px;color:#6b7285;line-height:1.5}
.unit{position:absolute;left:${PAD.l}px;top:${PAD.t - 36}px;font-size:20px;color:#6b7285}
</style></head><body>
<div class="head"><div class="q">人材紹介の“数”は、どれだけ増えたのか</div><h1>有料職業紹介の事業所は、<br>35年で<em>約10倍</em>に。直近10年でも<em>約1.8倍</em></h1></div>
<div class="unit">事業所数（か所）</div>
<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs><linearGradient id="gold" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#e8cf8f"/><stop offset="1" stop-color="#c9a55c"/></linearGradient></defs>${grid}${bars}${vals}${ticks}</svg>
<div class="foot">出典：厚生労働省 職業安定局需給調整事業課調べ「民営職業紹介事業所数の推移【事業報告】」（有料職業紹介事業所）。平成2年度〜令和7年度。<br>※「事業所」（拠点）の数で、会社の数とは一致しません。増加＝質の良し悪し、を示すものではありません。</div>
</body></html>`;

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
await page.setContent(html, { waitUntil: "networkidle", timeout: 45000 });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(250);
await page.screenshot({ path: OUT });
console.log("chart:", OUT, "ratio all:", (DATA[35] / DATA[0]).toFixed(2), "ratio 10y:", (DATA[35] / DATA[25]).toFixed(2));
await browser.close();
