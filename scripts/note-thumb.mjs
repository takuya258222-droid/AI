// note用のサムネイル画像（1280x670）を作る。使い方: node scripts/note-thumb.mjs  → public/img/note/*.png
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "public/img/note");
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");

// 悩み（1行目）＋訴求（2行目）＋小さく肩書き
const THUMBS = {
  "profile-thumb": {
    worry: "転職エージェント、どこも同じに見えませんか？",
    appeal: "元エージェント営業9年・成約800名が\n「選び方」を全部書きます",
    small: "相談8,000名超｜正しい転職エージェントの使い方",
  },
};

const html = (t) => `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@500;900&display=block" rel="stylesheet">
<style>
  * { box-sizing: border-box; margin: 0; }
  body { width: 1280px; height: 670px; font-family: 'Noto Sans JP', sans-serif; background: linear-gradient(135deg,#0d1b3e 0%,#16295a 100%); color: #fff; position: relative; overflow: hidden; }
  .ring { position: absolute; right: -120px; top: -120px; width: 520px; height: 520px; border: 2px solid rgba(201,165,92,.35); border-radius: 50%; }
  .ring.b { right: -40px; top: -40px; width: 360px; height: 360px; }
  .wrap { position: absolute; inset: 0; padding: 64px 80px; display: flex; flex-direction: column; justify-content: center; }
  .worry { display: inline-block; align-self: flex-start; font-size: 34px; font-weight: 500; color: #0d1b3e; background: #e3c98a; padding: 8px 22px; border-radius: 8px; margin-bottom: 30px; }
  .appeal { font-size: 56px; font-weight: 900; line-height: 1.35; white-space: pre-line; }
  .appeal em { font-style: normal; color: #e3c98a; }
  .small { margin-top: 34px; font-size: 28px; color: #c9cfe2; }
</style></head><body><div class="ring"></div><div class="ring b"></div>
<div class="wrap"><div class="worry">${esc(t.worry)}</div><div class="appeal">${esc(t.appeal).replace("「選び方」", "<em>「選び方」</em>")}</div><div class="small">${esc(t.small)}</div></div>
</body></html>`;


// ---- v2: 「選び方がわからない人へ」＋完全無料＋できること（LINE案内版） ----
const FONT = `<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@500;700;900&display=block" rel="stylesheet">`;
const BASE_CSS = `* { box-sizing: border-box; margin: 0; } body { font-family: 'Noto Sans JP', sans-serif; color: #fff; }`;

const thumbV2 = () => `<!doctype html><html><head><meta charset="utf-8">${FONT}<style>${BASE_CSS}
  body { width: 1280px; height: 670px; background: linear-gradient(135deg,#0d1b3e 0%,#16295a 100%); position: relative; overflow: hidden; }
  .ring { position: absolute; right: -140px; top: -140px; width: 540px; height: 540px; border: 2px solid rgba(201,165,92,.30); border-radius: 50%; }
  .wrap { position: absolute; inset: 0; padding: 56px 76px; display: flex; flex-direction: column; justify-content: center; gap: 26px; }
  .row { display: flex; align-items: center; gap: 20px; }
  .free { background: linear-gradient(90deg,#e8cf8f,#c9a55c); color: #0d1b3e; font-weight: 900; font-size: 46px; padding: 6px 30px; border-radius: 12px; }
  .tag { font-size: 30px; font-weight: 500; color: #e3c98a; }
  h1 { font-size: 74px; font-weight: 900; line-height: 1.3; }
  h1 em { font-style: normal; color: #e3c98a; }
  .sub { font-size: 34px; font-weight: 500; color: #d5daea; }
  .pills { display: flex; gap: 18px; }
  .pill { border: 2px solid #c9a55c; border-radius: 999px; padding: 10px 24px; font-size: 27px; font-weight: 700; background: rgba(255,255,255,.06); white-space: nowrap; }
</style></head><body><div class="ring"></div><div class="wrap">
  <div class="row"><div class="free">完全無料</div><div class="tag">30秒・タップだけ・登録は任意</div></div>
  <h1>転職サービスの<br><em>選び方</em>がわからない人へ</h1>
  <div class="sub">元エージェント営業9年・成約800名が作った 公式LINE</div>
  <div class="pills"><div class="pill">✔ 合う2〜4社に絞る</div><div class="pill">✔ 年収の現在地が分かる</div><div class="pill">✔ 面接のポイント</div></div>
</div></body></html>`;

const cardV2 = () => `<!doctype html><html><head><meta charset="utf-8">${FONT}<style>${BASE_CSS}
  body { width: 1200px; background: #f6f3ec; color: #1c2233; padding: 0; }
  .card { width: 1200px; background: #fff; overflow: hidden; }
  .head { background: linear-gradient(135deg,#0d1b3e,#16295a); color: #fff; padding: 44px 56px; display: flex; align-items: center; gap: 28px; }
  .free { background: linear-gradient(90deg,#e8cf8f,#c9a55c); color: #0d1b3e; font-weight: 900; font-size: 52px; padding: 8px 32px; border-radius: 14px; white-space: nowrap; }
  .head h2 { font-size: 46px; font-weight: 900; line-height: 1.35; }
  .sec { padding: 40px 56px 8px; }
  .sec h3 { font-size: 34px; font-weight: 900; color: #8a6521; margin-bottom: 20px; }
  .item { display: flex; gap: 22px; align-items: flex-start; margin-bottom: 22px; }
  .no { flex: none; width: 52px; height: 52px; border-radius: 50%; background: #0d1b3e; color: #e3c98a; font-weight: 900; font-size: 28px; display: flex; align-items: center; justify-content: center; }
  .item b { display: block; font-size: 33px; font-weight: 900; }
  .item span { font-size: 26px; color: #4a5168; }
  .who { background: #faf5e8; margin: 12px 56px 0; padding: 30px 36px; border-radius: 18px; border: 2px solid #e3d3a4; }
  .who h3 { font-size: 34px; font-weight: 900; color: #8a6521; margin-bottom: 14px; }
  .who li { list-style: none; font-size: 31px; font-weight: 700; margin-bottom: 12px; padding-left: 44px; position: relative; }
  .who li::before { content: '✔'; position: absolute; left: 0; color: #b98a3b; font-weight: 900; }
  .foot { padding: 26px 56px 40px; font-size: 22px; color: #6b7285; line-height: 1.6; }
</style></head><body><div class="card" id="card">
  <div class="head"><div class="free">完全無料</div><h2>選び方がわからない人のための<br>公式LINE</h2></div>
  <div class="sec"><h3>公式LINEでできること</h3>
    <div class="item"><div class="no">1</div><div><b>30秒転職診断</b><span>タップだけ。合うサービスを、理由つきで2〜4社に絞ってご案内</span></div></div>
    <div class="item"><div class="no">2</div><div><b>年収ポジション診断</b><span>公的データで、あなたの年収の現在地が分かる</span></div></div>
    <div class="item"><div class="no">3</div><div><b>面談・選考で見られるポイント</b><span>職種×年代別に、見られやすい5つのポイント</span></div></div>
    <div class="item"><div class="no">4</div><div><b>診断結果はいつでも見直せる</b><span>「結果」と送れば、30日間もう一度表示</span></div></div>
  </div>
  <div class="who"><h3>こんな人に向いています</h3><ul>
    <li>転職サービスが多すぎて、選べない</li>
    <li>自分の年収が、世の中のどのあたりか知りたい</li>
    <li>面談や選考で見られる点を、先に知っておきたい</li>
    <li>まずは情報収集だけしたい（転職は未定）</li></ul></div>
  <div class="foot">運営：なぎ（元転職エージェント／営業9年・支援成約800名・相談8,000名超）<br>診断・ご紹介は求職者の方は無料、登録は任意です<br>※各サービスの条件は、各社のご案内をご確認ください<br>※当アカウントは紹介リンク経由の登録で各社から報酬を受け取る場合があります（PR）</div>
</div></body></html>`;

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 670 }, deviceScaleFactor: 1 });
for (const [name, t] of Object.entries(THUMBS)) {
  await page.setContent(html(t), { waitUntil: "networkidle", timeout: 45000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
  console.log("thumb:", name);
}
{
  const p2 = await browser.newPage({ viewport: { width: 1280, height: 670 }, deviceScaleFactor: 1 });
  await p2.setContent(thumbV2(), { waitUntil: "networkidle", timeout: 45000 });
  await p2.evaluate(() => document.fonts.ready); await p2.waitForTimeout(200);
  await p2.screenshot({ path: path.join(OUT, "profile-thumb-v2.png") });
  console.log("thumb: profile-thumb-v2");
  const p3 = await browser.newPage({ viewport: { width: 1200, height: 900 }, deviceScaleFactor: 1 });
  await p3.setContent(cardV2(), { waitUntil: "networkidle", timeout: 45000 });
  await p3.evaluate(() => document.fonts.ready); await p3.waitForTimeout(200);
  await p3.locator("#card").screenshot({ path: path.join(OUT, "line-summary.png") });
  console.log("card: line-summary");
}
await browser.close();
