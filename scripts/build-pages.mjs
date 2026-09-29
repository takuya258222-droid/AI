// 規約ページ(legal.html)とトップページ(index.html)を、設定ファイルから生成する: node scripts/build-pages.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { brand, campaign } from "../src/core/content.mjs";
import { INCOME_SOURCE } from "../src/core/labels.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const clean = (s) => esc(s.replace(/★/g, ""));
const today = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
const LINE_URL = "https://line.me/R/ti/p/%40641thwzc";

const css = `
:root{--navy:#0A1729;--gold:#C9A567;--goldDeep:#9A7737;--ivory:#F7F1E3;--ink:#1B2430;--muted:#6B7480;--rule:#E6DFD0}
*{box-sizing:border-box}
body{margin:0;font-family:'Noto Sans JP',-apple-system,BlinkMacSystemFont,'Hiragino Sans',sans-serif;color:var(--ink);background:#fff;line-height:1.85}
header{background:linear-gradient(135deg,#0A1729,#12284A);color:#F7F1E3;padding:34px 20px 30px;text-align:center;border-bottom:3px solid var(--gold)}
header .en{font:600 13px 'Cormorant Garamond',serif;letter-spacing:6px;color:var(--gold);text-transform:uppercase}
header h1{font:700 26px/1.4 'Noto Serif JP',serif;margin:10px 0 0}
main{max-width:760px;margin:0 auto;padding:28px 20px 60px}
nav{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:26px}
nav a{font-size:13px;color:var(--navy);text-decoration:none;border:1px solid var(--gold);border-radius:20px;padding:5px 14px}
h2{font:700 20px 'Noto Serif JP',serif;color:var(--navy);border-left:4px solid var(--gold);padding-left:12px;margin:44px 0 14px}
h3{font-size:15px;color:var(--goldDeep);margin:22px 0 4px}
p,li{font-size:14.5px}ul{padding-left:1.3em}li{margin:4px 0}
.box{background:var(--ivory);border-radius:10px;padding:14px 18px;margin:14px 0}
.muted{color:var(--muted);font-size:12.5px}
.btn{display:inline-block;background:linear-gradient(90deg,#E9D39C,#C9A567);color:var(--navy);font-weight:700;padding:14px 34px;border-radius:30px;text-decoration:none}
footer{text-align:center;color:var(--muted);font-size:12px;padding:24px}
`;
const head = (title) => `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="index,follow"><title>${esc(title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@700&family=Noto+Sans+JP:wght@400;700&family=Cormorant+Garamond:wght@600&display=swap" rel="stylesheet"><style>${css}</style></head>`;

const legal = `${head(`プライバシーポリシー・広告表記｜${brand.accountName}`)}<body>
<header><div class="en">Legal &amp; Policy</div><h1>プライバシーポリシー・広告表記<br>キャンペーン規約</h1></header>
<main>
<nav><a href="#operator">運営者情報</a><a href="#ad">広告表記</a><a href="#policy">ご紹介の考え方</a><a href="#privacy">プライバシー</a><a href="#campaign">キャンペーン規約</a><a href="#disclaimer">免責事項</a></nav>

<h2 id="operator">運営者情報</h2>
<ul><li>アカウント名：${esc(brand.accountName)}</li><li>運営者：${esc(brand.persona)}（${esc(brand.role)}）</li>
<li>お問い合わせ：LINE公式アカウントのトークからご連絡ください</li>
<li>運営者のnote：<a href="${brand.note.profileUrl}">${brand.note.profileUrl}</a></li></ul>
<div class="box">${esc(brand.bio)}<br><span class="muted">※${esc(brand.bioSource)}</span></div>
<p class="muted">当アカウントは、転職サービスの情報提供・紹介を行うものであり、求職者の方に有償のサービスを販売するものではありません。</p>

<h2 id="ad">広告表記（PR）</h2>
<p>${esc(brand.disclosure)}</p>
<p>紹介リンクを経由して登録・面談等が行われた場合に、当アカウントが成果報酬を受け取ることがあります。ご利用者さまに追加の費用が発生することはありません。</p>

<h2 id="policy">ご紹介の考え方（選定基準）</h2>
<ul><li>診断の回答（職種・年代・現在の年収帯・重視すること・転職の進み具合・エリア）と、各サービスの公開情報（対象職種・対象年代・対応エリア・雇用形態など）との適合度で選定しています。</li>
<li>対象年齢・エリア・条件が合わないサービスは、ご紹介しません。</li>
<li>専門特化した提携先がない職種は、その旨を明記し、幅広く相談できるサービスをご案内します。</li>
<li>掲載内容は公開情報をもとにしたもので、最新の条件は各サービスの公式サイトでご確認ください。</li>
<li>年収ポジションの比較には、公的統計を使用しています。${esc(INCOME_SOURCE)}</li></ul>

<h2 id="privacy">プライバシーポリシー</h2>
<h3>1. 取得する情報</h3>
<p>LINEの友だち追加により、LINEのユーザーID、表示名、トークの内容（送信いただいた画像を含む）を取得します。</p>
<h3>2. 利用目的</h3>
<ul><li>診断結果の表示（診断の回答は、結果の表示のためにのみ使用します）</li><li>お問い合わせへの対応</li><li>キャンペーンの応募内容の確認、抽選、当選のご連絡（応募の記録として、ユーザーID・応募月・応募回数を保存し、抽選に使用します）</li><li>診断後のフォローメッセージ（お役立ち情報）・キャンペーン締切のご案内の配信、および診断結果の再表示</li><li>新着noteのお知らせ（ご希望の方のみ）</li></ul>
<h3>3. 保存期間・削除</h3>
<p>フォローメッセージ・キャンペーン締切のご案内の配信と、診断結果の再表示のために、ユーザーIDと診断の区分（回答の組み合わせ）を最大${brand.followup.retentionDays}日間保存します。新着noteのお知らせをご希望の方については、ユーザーIDと希望の職種区分を、配信を停止するまで（最長180日間）保存し、週1回まで配信します。キャンペーンの応募記録（ユーザーID・応募月・応募回数）は、抽選と当選連絡のために最長150日間保存します。自由入力でお送りいただいたメッセージは、運営者に通知される場合があります。「${esc(brand.followup.stopKeyword)}」とメッセージを送信いただくと、配信を停止し、保存した情報を削除します。また、LINEアカウントをブロックした場合も、保存した情報を削除します。アクセス状況は、個人を特定しない日別の件数のみを集計しています。</p>
<h3>4. 第三者への提供</h3>
<p>取得した個人情報を、ご本人の同意なく第三者に提供することはありません（法令に基づく場合を除きます）。</p>
<h3>5. 外部サービス</h3>
<p>当アカウントは、LINE、note、および各紹介先サービス、ホスティング（Cloudflare）を利用します。紹介先サービスに登録された情報は、各社のプライバシーポリシーに従って取り扱われます。</p>
<h3>6. 改定</h3>
<p>本ポリシーは、必要に応じて改定することがあります。制定・最終更新：${today}</p>

<h2 id="campaign">キャンペーン規約</h2>
<div class="box"><b>${esc(campaign.title)}</b></div>
<h3>応募方法</h3><ol>${campaign.steps.map((s) => `<li>${esc(s)}</li>`).join("")}</ol>
<h3>応募条件</h3><p>${esc(campaign.entryRule)}</p>
<h3>応募口数</h3><p>${clean(campaign.entries)}</p>
<h3>抽選</h3><p>${clean(campaign.drawTiming)}</p>
<h3>当選のご連絡</h3><p>${clean(campaign.notify)}</p>
<h3>賞品のお渡し</h3><p>${clean(campaign.delivery)}</p>
<h3>ご注意</h3><ul>${campaign.notes.map((n) => `<li>${esc(n)}</li>`).join("")}</ul>

<h2 id="disclaimer">免責事項</h2>
<ul><li>掲載する各サービスの情報は、公開情報をもとに作成した時点のものです。最新の内容・条件は各サービスの公式サイトでご確認ください。</li>
<li>各サービスの利用、転職・就業の結果について、当アカウントは保証するものではありません。</li>
<li>年収に関する統計は、国の統計に基づく一般的な水準の目安であり、個人の年収を保証・査定するものではありません。</li></ul>
</main><footer>© ${new Date().getFullYear()} ${esc(brand.persona)}｜<a href="/">トップへ</a></footer></body></html>`;

const index = `${head(`${brand.accountName}｜${brand.tagline}`)}<body>
<header><div class="en">Career Diagnosis</div><h1>${esc(brand.tagline)}</h1></header>
<main style="text-align:center">
<p>職種・年代・年収帯に合わせて、あなたに合う転職サービスを厳選してご案内します。<br>質問はすべてタップだけ。診断は無料・登録不要です。</p>
<p style="margin:30px 0"><a class="btn" href="${LINE_URL}">LINEで友だち追加</a></p>
<div class="box" style="text-align:left"><b>運営：${esc(brand.persona)}</b><br>${esc(brand.bio)}<br><span class="muted">※${esc(brand.bioSource)}</span></div>
<p><a href="${brand.note.magazineUrl}">転職体験記マガジン（note）</a> ｜ <a href="/legal.html">プライバシー・広告表記・規約</a></p>
<p class="muted">${esc(brand.disclosure)}</p>
</main><footer>© ${new Date().getFullYear()} ${esc(brand.persona)}</footer></body></html>`;

fs.writeFileSync(path.join(ROOT, "public/legal.html"), legal);
fs.writeFileSync(path.join(ROOT, "public/index.html"), index);
console.log("public/legal.html, public/index.html を生成しました");
