// note用の画像（実際のLINE配信画面つき）を作る。使い方: node scripts/note-screens.mjs
//   → public/img/note/profile-thumb-v3.png（見出し画像 1280x670）／line-delivery-list.png（配信リスト）
// 画面は、実際のBotが返すFlex Messageを簡易描画したもの（LINE実機とは細部が異なります）
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { questionMessage, resultMessages, salaryResultMessage } from "../src/core/diagnosis.mjs";
import * as M from "../src/core/messages.mjs";
import { tipsFlow } from "../src/core/tips.mjs";
import { bubbleHtml } from "./lib/flex-html.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "public/img/note");
const BASE = "file://" + path.join(ROOT, "public");
const first = (m) => (m.contents.type === "carousel" ? m.contents.contents[0] : m.contents);

const answers = { j: "med", s: "nurse", g: "a30", i: "i5", p: "haken", t: "m3" };
const screens = {
  q: first(questionMessage("j", {}, BASE)),
  res: first(resultMessages(answers, BASE)[0]),
  tips: first(tipsFlow("nurse.a30", BASE)[0]),
  sal: first(salaryResultMessage("i4", BASE)),
  taiken: first(M.taikenMessage(BASE, [{ title: "【転職事例】34歳・介護福祉士。夜勤をやめたら年収が87万円落ちた", link: "https://note.com/wise_ivy1277", ts: Date.parse("2026-09-26T09:00:00+0900"), thumb: "" }])),
};

const FONT = `<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@500;700;900&display=block" rel="stylesheet">`;
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox", "--allow-file-access-from-files"] });

// 1) 各画面を、背景透過のPNGにする
const shots = {};
{
  const page = await browser.newPage({ viewport: { width: 420, height: 900 }, deviceScaleFactor: 2 });
  for (const [k, b] of Object.entries(screens)) {
    await page.setContent(`<!doctype html><html><head><meta charset="utf-8">${FONT}</head><body style="margin:0;background:transparent"><div id="b" style="display:inline-block;padding:14px">${bubbleHtml(b)}</div></body></html>`, { waitUntil: "networkidle", timeout: 45000 });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(150);
    shots[k] = "data:image/png;base64," + (await page.locator("#b").screenshot({ omitBackground: true })).toString("base64");
  }
  await page.close();
}

const CSS = `* { box-sizing: border-box; margin: 0; } body { font-family: 'Noto Sans JP', sans-serif; color: #fff; }
  .gold { background: linear-gradient(90deg,#e8cf8f,#c9a55c); color: #0d1b3e; }
  .fade { -webkit-mask-image: linear-gradient(#000 78%, transparent 100%); mask-image: linear-gradient(#000 78%, transparent 100%); overflow: hidden; }
  .scr img { width: 100%; display: block; filter: drop-shadow(0 10px 18px rgba(0,0,0,.45)); }
  .chip { position: absolute; left: 50%; transform: translateX(-50%); white-space: nowrap; background: #0d1b3e; color: #e3c98a; border: 2px solid #c9a55c; border-radius: 999px; font-weight: 900; }`;

// 2) 見出し画像：左＝できること、右＝実際の配信画面
const thumb = () => `<!doctype html><html><head><meta charset="utf-8">${FONT}<style>${CSS}
  body { width: 1280px; height: 670px; background: linear-gradient(135deg,#0d1b3e 0%,#16295a 100%); position: relative; overflow: hidden; }
  .ring { position: absolute; right: -160px; top: -160px; width: 560px; height: 560px; border: 2px solid rgba(201,165,92,.28); border-radius: 50%; }
  .left { position: absolute; left: 60px; top: 0; bottom: 0; width: 610px; display: flex; flex-direction: column; justify-content: center; gap: 20px; }
  .top { display: flex; align-items: center; gap: 16px; }
  .free { font-weight: 900; font-size: 44px; padding: 4px 26px; border-radius: 12px; white-space: nowrap; }
  .tag { font-size: 24px; font-weight: 500; color: #e3c98a; line-height: 1.35; }
  h1 { font-size: 52px; font-weight: 900; line-height: 1.3; white-space: nowrap; }
  h1 em { font-style: normal; color: #e3c98a; }
  ul { list-style: none; padding: 0; display: flex; flex-direction: column; gap: 12px; }
  li { display: flex; align-items: center; gap: 16px; font-size: 30px; font-weight: 700; white-space: nowrap; }
  .no { flex: none; width: 42px; height: 42px; border-radius: 50%; background: #c9a55c; color: #0d1b3e; font-weight: 900; font-size: 24px; display: flex; align-items: center; justify-content: center; }
  .by { font-size: 22px; color: #c3cadf; }
  .scr { position: absolute; }
  .note { position: absolute; right: 24px; bottom: 12px; font-size: 17px; color: #aab3cf; }
</style></head><body><div class="ring"></div>
<div class="left">
  <div class="top"><div class="free gold">完全無料</div><div class="tag">診断もご紹介も求職者は無料<br>30秒・タップだけ・登録は任意</div></div>
  <h1>選び方がわからない人へ<br>公式LINEで<em>できること</em></h1>
  <ul>
    <li><span class="no">1</span>30秒・タップだけの転職診断</li>
    <li><span class="no">2</span>合うサービスを2〜4社に絞って案内</li>
    <li><span class="no">3</span>年収の現在地が分かる</li>
    <li><span class="no">4</span>面談・選考のポイントが分かる</li>
    <li><span class="no">5</span>転職体験記の新着が届く</li>
  </ul>
  <div class="by">元エージェント営業9年・成約800名が運営</div>
</div>
<div class="scr fade" style="left:664px;top:74px;width:240px;height:470px;transform:rotate(-4deg)"><img src="${shots.tips}"></div>
<div class="scr fade" style="left:1046px;top:74px;width:240px;height:470px;transform:rotate(4deg)"><img src="${shots.sal}"></div>
<div class="scr fade" style="left:850px;top:34px;width:290px;height:540px"><img src="${shots.res}"></div>
<div class="chip" style="left:790px;top:548px;font-size:22px;padding:4px 16px;transform:translateX(-50%)">選考ポイント</div>
<div class="chip" style="left:995px;top:566px;font-size:24px;padding:4px 20px;transform:translateX(-50%)">診断結果</div>
<div class="chip" style="left:1170px;top:548px;font-size:22px;padding:4px 16px;transform:translateX(-50%)">年収ポジション</div>
<div class="note">※画面は実際の配信内容を再現したイメージ　PR</div>
</body></html>`;

// 3) 配信リスト：実画面4つ＋「そのほか」
const list = () => `<!doctype html><html><head><meta charset="utf-8">${FONT}<style>${CSS}
  body { width: 1200px; background: #f6f3ec; color: #1c2233; }
  .head { background: linear-gradient(135deg,#0d1b3e,#16295a); color: #fff; padding: 36px 48px; display: flex; align-items: center; gap: 24px; }
  .free { font-weight: 900; font-size: 44px; padding: 6px 28px; border-radius: 12px; white-space: nowrap; }
  .head h2 { font-size: 42px; font-weight: 900; line-height: 1.35; }
  .head small { display: block; font-size: 22px; font-weight: 500; color: #d5daea; margin-top: 4px; }
  .cols { display: flex; gap: 20px; padding: 36px 40px 8px; }
  .col { flex: 1; min-width: 0; text-align: center; }
  .col .scr { position: relative; background: #8fa3b8; border-radius: 18px; padding: 6px 0 0; height: 520px; overflow: hidden; }
  .col .scr::after { content: ""; position: absolute; left: 0; right: 0; bottom: 0; height: 90px; background: linear-gradient(rgba(143,163,184,0), #8fa3b8); }
  .col .scr.nf::after { display: none; }
  .col .scr img { filter: none; }
  .no { display: inline-flex; align-items: center; justify-content: center; width: 46px; height: 46px; border-radius: 50%; background: #0d1b3e; color: #e3c98a; font-weight: 900; font-size: 26px; margin-top: 18px; }
  .col b { display: block; font-size: 25px; white-space: nowrap; font-weight: 900; margin-top: 8px; line-height: 1.35; }
  .col span { display: block; font-size: 21px; color: #4a5168; margin-top: 6px; line-height: 1.5; }
  .more { margin: 24px 40px 0; background: #faf5e8; border: 2px solid #e3d3a4; border-radius: 18px; padding: 24px 32px; }
  .more h3 { font-size: 28px; font-weight: 900; color: #8a6521; margin-bottom: 12px; }
  .more .chips { display: flex; flex-wrap: wrap; gap: 12px; }
  .more .c { background: #fff; border: 2px solid #c9a55c; border-radius: 999px; padding: 6px 20px; font-size: 24px; font-weight: 700; white-space: nowrap; }
  .more .c em { font-style: normal; color: #8a6521; }
  .foot { padding: 22px 48px 34px; font-size: 20px; color: #6b7285; line-height: 1.6; }
</style></head><body><div id="card">
  <div class="head"><div class="free gold">完全無料</div><h2>公式LINEで届く画面（配信リスト）<small>タップだけ。診断もご紹介も、求職者の方は無料・登録は任意です</small></h2></div>
  <div class="cols">
    <div class="col"><div class="scr nf"><img src="${shots.q}"></div><div class="no">1</div><b>30秒転職診断</b><span>職種・年代・年収を<br>タップで選ぶだけ</span></div>
    <div class="col"><div class="scr"><img src="${shots.res}"></div><div class="no">2</div><b>診断結果</b><span>合うサービス2〜4社と<br>年収の現在地が分かる</span></div>
    <div class="col"><div class="scr nf"><img src="${shots.tips}"></div><div class="no">3</div><b>面談・選考のポイント</b><span>職種×年代別に<br>見られやすい5つ</span></div>
    <div class="col"><div class="scr nf"><img src="${shots.taiken}"></div><div class="no">4</div><b>転職体験記</b><span>noteの連載の新着を<br>希望者だけに配信</span></div>
  </div>
  <div class="more"><h3>そのほか、送るだけで見られるもの</h3><div class="chips">
    <div class="c"><em>「年収」</em>年収ポジション診断</div><div class="c"><em>「手取り」</em>手取りの目安</div><div class="c"><em>「スケジュール」</em>転職時期からの逆算</div><div class="c"><em>「面談準備」</em>準備シート</div><div class="c"><em>「結果」</em>診断結果を30日間見直せる</div><div class="c"><em>「質問」</em>よくある質問</div>
  </div></div>
  <div class="foot">運営：なぎ（元転職エージェント／営業9年・支援成約800名・相談8,000名超）<br>※画面は実際の配信内容を再現したイメージです（実機と細部が異なる場合があります）<br>※各サービスの条件は、各社のご案内をご確認ください<br>※当アカウントは紹介リンク経由の登録で各社から報酬を受け取る場合があります（PR）</div>
</div></body></html>`;

{
  const p = await browser.newPage({ viewport: { width: 1280, height: 670 }, deviceScaleFactor: 1 });
  await p.setContent(thumb(), { waitUntil: "networkidle", timeout: 45000 });
  await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(250);
  await p.screenshot({ path: path.join(OUT, "profile-thumb-v3.png") });
  console.log("thumb: profile-thumb-v3");
  const q = await browser.newPage({ viewport: { width: 1200, height: 900 }, deviceScaleFactor: 1 });
  await q.setContent(list(), { waitUntil: "networkidle", timeout: 45000 });
  await q.evaluate(() => document.fonts.ready); await q.waitForTimeout(250);
  await q.locator("#card").screenshot({ path: path.join(OUT, "line-delivery-list.png") });
  console.log("list: line-delivery-list");
}
await browser.close();
