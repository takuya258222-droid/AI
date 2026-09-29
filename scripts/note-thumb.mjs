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

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 670 }, deviceScaleFactor: 1 });
for (const [name, t] of Object.entries(THUMBS)) {
  await page.setContent(html(t), { waitUntil: "networkidle", timeout: 45000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
  console.log("thumb:", name);
}
await browser.close();
