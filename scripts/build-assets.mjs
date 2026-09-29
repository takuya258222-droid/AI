// デザイン素材(リッチメニュー・バナー・アイコン)を生成: node scripts/build-assets.mjs
// 紺×ゴールドのデザインをHTMLで組み、Chromiumで画像化して public/img と assets/ に出力する。
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "public/img");
const ASSETS = path.join(ROOT, "assets");
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(ASSETS, { recursive: true });
const CHROME = process.env.CHROME_PATH || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

const FONTS = `<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@600;700;900&family=Noto+Sans+JP:wght@400;500;700&family=Cormorant+Garamond:wght@500;600;700&display=block" rel="stylesheet">`;

// ---- アイコン（96x96・線画） ----
const ic = (body) => `<svg viewBox="0 0 96 96" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
const ICONS = {
  compass: ic(`<circle cx="48" cy="48" r="34"/><path d="M62 34 L54 54 L34 62 L42 42Z"/><circle cx="48" cy="48" r="3" fill="currentColor"/>`),
  check: ic(`<circle cx="48" cy="48" r="34"/><path d="M32 49 L44 61 L66 37"/>`),
  bars: ic(`<path d="M14 82 H82"/><rect x="18" y="56" width="14" height="26"/><rect x="41" y="40" width="14" height="42"/><rect x="64" y="22" width="14" height="60"/><path d="M20 40 L42 24 L56 30 L80 12"/><path d="M69 12 H80 V23"/>`),
  gift: ic(`<rect x="14" y="40" width="68" height="42"/><rect x="10" y="28" width="76" height="14"/><path d="M48 28 V82"/><path d="M48 28 C40 12 24 16 30 26 C33 30 44 28 48 28Z"/><path d="M48 28 C56 12 72 16 66 26 C63 30 52 28 48 28Z"/>`),
  phone: ic(`<rect x="26" y="10" width="44" height="76" rx="8"/><path d="M42 18 H54"/><path d="M36 52 L45 61 L61 42"/>`),
  book: ic(`<path d="M48 26 C38 19 24 19 12 23 V75 C24 71 38 71 48 78Z"/><path d="M48 26 C58 19 72 19 84 23 V75 C72 71 58 71 48 78Z"/>`),
  faq: ic(`<path d="M16 18 H80 a6 6 0 0 1 6 6 V58 a6 6 0 0 1 -6 6 H46 L30 80 V64 H16 a6 6 0 0 1 -6 -6 V24 a6 6 0 0 1 6 -6Z"/><path d="M40 34 C40 26 56 26 56 34 C56 40 48 40 48 47"/><circle cx="48" cy="55" r="1.6" fill="currentColor"/>`),
  nurse: ic(`<path d="M48 82 C20 62 10 44 20 30 C28 18 44 20 48 32 C52 20 68 18 76 30 C86 44 76 62 48 82Z"/><path d="M48 40 V60 M38 50 H58"/>`),
  care: ic(`<path d="M12 46 L48 16 L84 46"/><path d="M20 40 V82 H76 V40"/><path d="M48 68 C34 60 34 48 42 48 C46 48 48 51 48 53 C48 51 50 48 54 48 C62 48 62 60 48 68Z"/>`),
  pharmacist: ic(`<g transform="rotate(-35 48 48)"><rect x="14" y="34" width="68" height="28" rx="14"/><path d="M48 34 V62"/></g><path d="M74 66 V82 M66 74 H82"/>`),
  childcare: ic(`<rect x="12" y="54" width="32" height="30"/><rect x="52" y="54" width="32" height="30"/><rect x="32" y="22" width="32" height="30" transform="rotate(-8 48 37)"/>`),
  it: ic(`<path d="M34 28 L14 48 L34 68"/><path d="M62 28 L82 48 L62 68"/><path d="M55 22 L41 74"/>`),
  sales: ic(`<path d="M14 84 H82"/><rect x="18" y="58" width="14" height="26"/><rect x="41" y="44" width="14" height="40"/><rect x="64" y="28" width="14" height="56"/><path d="M20 38 L44 22 L58 28 L80 10"/><path d="M69 10 H80 V21"/>`),
  highclass: ic(`<path d="M14 68 L20 30 L36 50 L48 24 L60 50 L76 30 L82 68Z"/><path d="M14 78 H82"/>`),
  young: ic(`<path d="M48 84 V46"/><path d="M48 54 C30 54 20 44 20 30 C36 30 46 38 48 54Z"/><path d="M48 46 C48 30 60 20 76 20 C76 36 66 46 48 46Z"/>`),
  factory: ic(`<path d="M12 82 V46 L36 60 V46 L60 60 V30 H74 V82Z"/><path d="M12 82 H84"/><path d="M24 70 H30 M46 70 H52 M64 44 H70"/>`),
  dispatch: ic(`<circle cx="48" cy="48" r="34"/><path d="M48 26 V48 L62 58"/>`),
  matching: ic(`<circle cx="36" cy="48" r="24"/><circle cx="60" cy="48" r="24"/><path d="M48 32 C52 38 52 58 48 64"/>`),
  coaching: ic(`<path d="M16 18 H80 a6 6 0 0 1 6 6 V58 a6 6 0 0 1 -6 6 H46 L30 80 V64 H16 a6 6 0 0 1 -6 -6 V24 a6 6 0 0 1 6 -6Z"/><circle cx="34" cy="41" r="2.4" fill="currentColor"/><circle cx="48" cy="41" r="2.4" fill="currentColor"/><circle cx="62" cy="41" r="2.4" fill="currentColor"/>`),
  support: ic(`<path d="M48 10 L80 22 V46 C80 66 66 78 48 86 C30 78 16 66 16 46 V22Z"/><path d="M34 47 L44 57 L64 35"/>`),
};

const BASE_CSS = `
*{box-sizing:border-box;margin:0;padding:0}
:root{--navy:#0A1729;--navy2:#132A47;--gold:#C9A567;--gold2:#E8D0A0;--ivory:#F7F1E3}
body{background:#000}
.en{font-family:'Cormorant Garamond',serif;font-weight:600;letter-spacing:7px;color:var(--gold);text-transform:uppercase}
.ser{font-family:'Noto Serif JP',serif}
.sans{font-family:'Noto Sans JP',sans-serif}
.gold-text{background:linear-gradient(90deg,#F6E7C4,#D6B274);-webkit-background-clip:text;background-clip:text;color:transparent}
.banner{width:1200px;height:540px;position:relative;overflow:hidden;
  background:radial-gradient(900px 520px at 88% 12%,rgba(201,165,103,.24),transparent 62%),radial-gradient(700px 400px at 0% 100%,rgba(60,110,180,.20),transparent 60%),linear-gradient(135deg,#0A1729 0%,#12284A 100%)}
.frame{position:absolute;inset:22px;border:1.5px solid rgba(201,165,103,.55)}
.frame2{position:absolute;inset:32px;border:.6px solid rgba(201,165,103,.28)}
.txt{position:absolute;left:92px;top:0;bottom:0;width:700px;display:flex;flex-direction:column;justify-content:center}
.txt .en{font-size:28px;margin-bottom:22px}
.txt h1{font-family:'Noto Serif JP',serif;font-weight:900;font-size:64px;line-height:1.28}
.txt .sub{font-family:'Noto Sans JP',sans-serif;font-weight:500;font-size:30px;color:rgba(247,241,227,.86);margin-top:26px;line-height:1.55;letter-spacing:.5px}
.rule{width:84px;height:3px;background:linear-gradient(90deg,var(--gold),transparent);margin-top:26px}
.emblem{position:absolute;right:100px;top:50%;margin-top:-150px;width:300px;height:300px;border-radius:50%;
  border:2px solid rgba(201,165,103,.75);box-shadow:inset 0 0 0 16px rgba(201,165,103,.07),0 0 80px rgba(201,165,103,.18);
  display:flex;align-items:center;justify-content:center;color:var(--gold2)}
.emblem svg{width:150px;height:150px}
.emblem::after{content:"";position:absolute;inset:-22px;border-radius:50%;border:1px solid rgba(201,165,103,.30)}
`;

const wrap = (css, body) => `<!doctype html><html><head><meta charset="utf-8">${FONTS}<style>${BASE_CSS}${css}</style></head><body>${body}</body></html>`;

function banner({ en, title, sub, icon }) {
  return wrap("", `<div class="banner"><div class="frame"></div><div class="frame2"></div>
  <div class="txt"><div class="en">${en}</div><h1 class="gold-text">${title}</h1><div class="rule"></div>${sub ? `<div class="sub">${sub}</div>` : ""}</div>
  <div class="emblem">${ICONS[icon]}</div></div>`);
}

function stepsBanner() {
  const cards = [
    ["01", "登録", "無料で", "phone"],
    ["02", "スクショ", "完了画面を", "check"],
    ["03", "送信", "このトークへ", "gift"],
  ];
  const css = `
  .steps{position:absolute;left:64px;right:64px;top:118px;bottom:64px;display:flex;align-items:center;justify-content:space-between}
  .card{width:318px;height:330px;border:2px solid rgba(201,165,103,.7);background:linear-gradient(180deg,rgba(255,255,255,.07),rgba(255,255,255,.02));display:flex;flex-direction:column;align-items:center;justify-content:center;position:relative}
  .card .n{position:absolute;top:-34px;left:50%;margin-left:-34px;width:68px;height:68px;border-radius:50%;background:linear-gradient(135deg,#F1DDB0,#C9A567);color:#0A1729;font:700 32px 'Cormorant Garamond',serif;display:flex;align-items:center;justify-content:center}
  .card svg{width:104px;height:104px;color:#E8D0A0;margin-bottom:20px}
  .card .l1{font:600 30px 'Noto Serif JP',serif;color:#F7F1E3}
  .card .l2{font:900 58px 'Noto Serif JP',serif;margin-top:4px}
  .arrow{color:#C9A567;font:400 64px 'Cormorant Garamond',serif}`;
  return wrap(css, `<div class="banner"><div class="frame"></div><div class="frame2"></div>
  <div class="steps">${cards.map((c, i) => `<div class="card"><div class="n">${c[0]}</div>${ICONS[c[3]]}<div class="l1">${c[2]}</div><div class="l2 gold-text">${c[1]}</div></div>${i < 2 ? '<div class="arrow">›</div>' : ""}`).join("")}</div></div>`);
}

const BANNERS = {
  welcome: { en: "Career Diagnosis", title: "30秒で、あなたに<br>合う転職サービスを。", sub: "タップだけで完了 ｜ 診断は無料", icon: "compass" },
  result: { en: "Diagnosis Complete", title: "診断が<br>完了しました", sub: "あなたに合うサービスをご案内します", icon: "check" },
  salary: { en: "Salary Check", title: "年収ポジション<br>診断", sub: "国税庁の公的データで、現在地を確認", icon: "bars" },
  campaign: { en: "Present Campaign", title: "毎月抽選で3名様に<br>PayPay 500円分", sub: "登録完了画面のスクリーンショットを送るだけ", icon: "gift" },
  received: { en: "Entry Received", title: "応募を<br>受け付けました", sub: "抽選で毎月3名様にプレゼント", icon: "check" },
  knowledge: { en: "Career Knowledge", title: "転職を成功させる<br>4つの基本", sub: "はじめての方にも分かりやすく", icon: "book" },
  taiken: { en: "Career Stories", title: "転職体験記", sub: "動機・選考・年収・後悔まで、実例で読む", icon: "book" },
  about: { en: "About", title: "運営者について", sub: "表も裏も知る立場から、違いを整理します", icon: "compass" },
  policy: { en: "Our Standards", title: "ご紹介の<br>考え方", sub: "選び方も、広告であることも、明確に", icon: "check" },
  faq: { en: "Q &amp; A", title: "よくある<br>ご質問", sub: "気になることを、まずここで解決", icon: "faq" },
  childcare: { en: "Childcare", title: "保育士のための<br>転職サポート", sub: "保育業界に特化した求人紹介", icon: "childcare" },
  care: { en: "Care Work", title: "介護職のための<br>転職サポート", sub: "無資格・未経験から常勤・単発まで", icon: "care" },
  nurse: { en: "Nurse Career", title: "看護師のための<br>転職サポート", sub: "常勤・派遣・単発の働き方を比較", icon: "nurse" },
  pharmacist: { en: "Pharmacist", title: "薬剤師のための<br>転職サポート", sub: "調剤薬局・病院・派遣まで", icon: "pharmacist" },
  it: { en: "IT Career", title: "ITキャリアの<br>転職サポート", sub: "未経験からハイクラス、独立まで", icon: "it" },
  sales: { en: "Sales Career", title: "営業職のための<br>転職サポート", sub: "営業経験を活かして次のステージへ", icon: "sales" },
  highclass: { en: "High Class", title: "ハイクラス・<br>キャリアアップ", sub: "年収・ポジションを引き上げる転職", icon: "highclass" },
  young: { en: "Young Career", title: "20代のための<br>転職サポート", sub: "第二新卒・初めての転職も丁寧に", icon: "young" },
  factory: { en: "Manufacturing", title: "製造・工場の<br>お仕事探し", sub: "寮付き・未経験OKの求人も", icon: "factory" },
  dispatch: { en: "Flexible Work", title: "柔軟な働き方の<br>求人を探す", sub: "派遣・正社員・軽作業まで幅広く", icon: "dispatch" },
  matching: { en: "Matching", title: "相性で選ぶ<br>転職エージェント", sub: "迷ったら、合う担当者を紹介してもらう", icon: "matching" },
  coaching: { en: "Career Coaching", title: "まずは相談から<br>始める転職", sub: "考えを整理するところから伴走", icon: "coaching" },
  support: { en: "Support", title: "障がい者雇用の<br>転職サポート", sub: "配慮を前提に、個別に相談", icon: "support" },
};

// ---- リッチメニュー（タブ付き2面：診断・応募 / 体験記・安心）----
const RM_TABS = [
  { id: "main", label: "診断・応募", en: "Diagnosis" },
  { id: "info", label: "体験記・安心", en: "Stories & Trust" },
];
const RM_CELLS = {
  main: [
    { n: "01", jp: "30秒転職診断", en: "Career Diagnosis", icon: "compass", primary: true },
    { n: "02", jp: "年収診断", en: "Salary Check", icon: "bars" },
    { n: "03", jp: "抽選キャンペーン", en: "PayPay 500 · 3 Winners", icon: "gift" },
    { n: "04", jp: "登録・応募の流れ", en: "How to Enter", icon: "phone" },
    { n: "05", jp: "転職ノウハウ", en: "Career Knowledge", icon: "book" },
    { n: "06", jp: "よくある質問", en: "Q &amp; A", icon: "faq" },
  ],
  info: [
    { n: "01", jp: "転職体験記", en: "Career Stories", icon: "book", primary: true },
    { n: "02", jp: "ご紹介の考え方", en: "Our Standards", icon: "check" },
    { n: "03", jp: "運営者について", en: "About", icon: "compass" },
    { n: "04", jp: "お問い合わせ", en: "Contact", icon: "coaching" },
    { n: "05", jp: "プライバシー・広告", en: "Privacy &amp; Disclosure", icon: "support" },
    { n: "06", jp: "30秒診断へ", en: "Start Diagnosis", icon: "matching" },
  ],
};

function richMenu(active) {
  const cells = RM_CELLS[active];
  const css = `
  .rm{width:2500px;height:1686px;position:relative;overflow:hidden;
    background:radial-gradient(1400px 800px at 85% 0%,rgba(201,165,103,.16),transparent 62%),radial-gradient(1200px 700px at 0% 100%,rgba(60,110,180,.18),transparent 60%),linear-gradient(160deg,#0A1729 0%,#11264A 100%)}
  .tabs{position:absolute;left:0;top:0;width:2500px;height:150px;display:flex;border-bottom:2px solid rgba(201,165,103,.55)}
  .tab{flex:1;display:flex;align-items:center;justify-content:center;gap:26px;color:#C9A567;border-right:2px solid rgba(201,165,103,.42)}
  .tab:last-child{border-right:none}
  .tab .tj{font:700 58px 'Noto Serif JP',serif;letter-spacing:3px}
  .tab .te{font:600 32px 'Cormorant Garamond',serif;letter-spacing:6px;text-transform:uppercase;opacity:.85}
  .tab.on{background:linear-gradient(135deg,#F3E2BC 0%,#D4AE6C 60%,#BF9752 100%);color:#0A1729}
  .tab.on .te{opacity:.8}
  .grid{position:absolute;left:0;top:150px;width:2500px;height:1536px;display:grid;grid-template-columns:833px 834px 833px;grid-template-rows:768px 768px}
  .cell{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#F7F1E3;border-right:2px solid rgba(201,165,103,.42);border-bottom:2px solid rgba(201,165,103,.42)}
  .cell:nth-child(3n){border-right:none}.cell:nth-child(n+4){border-bottom:none}
  .cell .no{position:absolute;top:44px;left:66px;font:600 44px 'Cormorant Garamond',serif;letter-spacing:6px;color:#C9A567}
  .cell svg{width:210px;height:210px;color:#E8D0A0;margin-bottom:38px;stroke-width:3;filter:drop-shadow(0 0 22px rgba(201,165,103,.25))}
  .cell .jp{font:700 88px 'Noto Serif JP',serif;letter-spacing:2px;white-space:nowrap}
  .cell .jp.long{font-size:72px;letter-spacing:0}
  .cell .en{font-family:'Cormorant Garamond',serif;font-weight:600;color:#C9A567;text-transform:uppercase;font-size:36px;margin-top:20px;letter-spacing:7px;white-space:nowrap}
  .cell.primary{background:linear-gradient(135deg,#F3E2BC 0%,#D4AE6C 55%,#BF9752 100%);color:#0A1729}
  .cell.primary .no{color:#0A1729}
  .cell.primary svg{color:#0A1729;filter:none}
  .cell.primary .en{color:#3A2E14}
  .cell .badge{position:absolute;top:44px;right:60px;padding:8px 26px;border:2px solid #0A1729;border-radius:40px;font:700 30px 'Cormorant Garamond',serif;letter-spacing:6px;color:#0A1729}
  `;
  const tabs = RM_TABS.map((tb) => `<div class="tab${tb.id === active ? " on" : ""}"><span class="tj">${tb.label}</span><span class="te">${tb.en}</span></div>`).join("");
  return wrap(css, `<div class="rm"><div class="tabs">${tabs}</div><div class="grid">${cells
    .map((c) => `<div class="cell${c.primary ? " primary" : ""}"><div class="no">${c.n}</div>${c.primary ? '<div class="badge">START</div>' : ""}${ICONS[c.icon]}<div class="jp${c.jp.length > 7 ? " long" : ""}">${c.jp}</div><div class="en">${c.en}</div></div>`)
    .join("")}</div></div>`);
}

// ---- LINEプロフィール用アイコン ----
function avatar() {
  const css = `
  .av{width:640px;height:640px;position:relative;overflow:hidden;background:radial-gradient(420px 420px at 70% 15%,rgba(201,165,103,.28),transparent 60%),linear-gradient(150deg,#0A1729,#14294A)}
  .ring{position:absolute;inset:44px;border-radius:50%;border:3px solid rgba(201,165,103,.85)}
  .ring2{position:absolute;inset:66px;border-radius:50%;border:1px solid rgba(201,165,103,.45)}
  .mono{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center}
  .mono .n{font:600 250px/1 'Cormorant Garamond',serif;color:transparent;background:linear-gradient(180deg,#F6E7C4,#C9A567);-webkit-background-clip:text;background-clip:text;margin-top:-16px}
  .mono .s{font:600 26px 'Cormorant Garamond',serif;letter-spacing:9px;color:#C9A567;margin-top:-6px}`;
  return wrap(css, `<div class="av"><div class="ring"></div><div class="ring2"></div><div class="mono"><div class="n">N</div><div class="s">CAREER GUIDE</div></div></div>`);
}

const browser = await chromium.launch({ executablePath: CHROME, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1200, height: 540 } });

async function render(html, w, h, file, opts = {}) {
  await page.setViewportSize({ width: w, height: h });
  await page.setContent(html, { waitUntil: "networkidle", timeout: 45000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(250);
  const type = file.endsWith(".png") ? "png" : "jpeg";
  await page.screenshot({ path: file, type, ...(type === "jpeg" ? { quality: opts.quality ?? 90 } : {}), clip: { x: 0, y: 0, width: w, height: h } });
  console.log(path.relative(ROOT, file), Math.round(fs.statSync(file).size / 1024) + "KB");
}

for (const [id, b] of Object.entries(BANNERS)) await render(banner(b), 1200, 540, path.join(OUT, `${id}.jpg`));
await render(stepsBanner(), 1200, 540, path.join(OUT, "steps.jpg"));
await render(richMenu("main"), 2500, 1686, path.join(ASSETS, "richmenu-main.jpg"), { quality: 88 });
await render(richMenu("info"), 2500, 1686, path.join(ASSETS, "richmenu-info.jpg"), { quality: 88 });
await render(avatar(), 640, 640, path.join(ASSETS, "avatar.png"));
await browser.close();

for (const f of ["richmenu-main.jpg", "richmenu-info.jpg"]) if (fs.statSync(path.join(ASSETS, f)).size > 1024 * 1024) { console.error(f + " が1MBを超えています"); process.exit(1); }
