// リッチメニュー（タブ付き2面）をLINEに作成する。何度実行しても同じ結果になる。
//   node --env-file-if-exists=.env scripts/setup-richmenu.mjs                   作成・画像アップ・エイリアス登録
//   ... --preview <userId>                                                      指定ユーザーだけに表示（動作確認用）
//   ... --activate                                                              全ユーザーのデフォルトに設定
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
if (!TOKEN) { console.error("LINE_CHANNEL_ACCESS_TOKEN が未設定です"); process.exit(1); }
const args = process.argv.slice(2);
const previewUser = args.includes("--preview") ? args[args.indexOf("--preview") + 1] : null;

async function api(method, p, body, { host = "https://api.line.me", raw, type } = {}) {
  const res = await fetch(host + p, {
    method,
    headers: { Authorization: `Bearer ${TOKEN}`, ...(raw ? { "Content-Type": type } : body ? { "Content-Type": "application/json" } : {}) },
    body: raw ?? (body ? JSON.stringify(body) : undefined),
  });
  const txt = await res.text();
  let data = txt; try { data = txt ? JSON.parse(txt) : {}; } catch {}
  if (!res.ok) throw new Error(`${method} ${p} -> ${res.status} ${typeof data === "string" ? data : JSON.stringify(data)}`);
  return data;
}

const W = 2500, H = 1686, TAB_H = 150, ROW_H = 768;
const colX = [0, 833, 1667], colW = [833, 834, 833];
const pb = (data, displayText) => ({ type: "postback", data, displayText });
const tabW = [833, 834, 833], tabX = [0, 833, 1667];
const ALIASES = ["nagi-main", "nagi-tools", "nagi-info"];
const tabs = () => ALIASES.map((alias, i) => ({ bounds: { x: tabX[i], y: 0, width: tabW[i], height: TAB_H }, action: { type: "richmenuswitch", richMenuAliasId: alias, data: `tab=${alias.slice(5)}` } }));
const cells = (actions) => actions.map((a, i) => ({ bounds: { x: colX[i % 3], y: TAB_H + Math.floor(i / 3) * ROW_H, width: colW[i % 3], height: ROW_H }, action: a }));

const MENUS = [
  { id: "main", alias: "nagi-main", image: "assets/richmenu-main.jpg", name: "nagi-main 診断・応募",
    areas: [...tabs(), ...cells([pb("st", "30秒転職診断"), pb("sal", "年収診断"), pb("camp", "抽選キャンペーン"), pb("steps", "登録・応募の流れ"), pb("know", "転職ノウハウ"), pb("faq", "よくある質問")])] },
  { id: "tools", alias: "nagi-tools", image: "assets/richmenu-tools.jpg", name: "nagi-tools 便利ツール",
    areas: [...tabs(), ...cells([pb("net", "手取り・月収の目安"), pb("prep", "面談準備シート"), pb("plan", "転職スケジュール"), pb("share", "友だちにシェア"), pb("know", "転職ノウハウ"), pb("contact", "管理人に相談")])] },
  { id: "info", alias: "nagi-info", image: "assets/richmenu-info.jpg", name: "nagi-info 体験記・安心",
    areas: [...tabs(), ...cells([pb("taiken", "転職体験記"), pb("policy", "ご紹介の考え方"), pb("about", "運営者について"), pb("contact", "管理人に相談"), pb("privacy", "プライバシー・広告表記"), pb("st", "30秒診断をスタート")])] },
];
const definition = (m) => ({ size: { width: W, height: H }, selected: true, name: m.name, chatBarText: "30秒診断はこちら", areas: m.areas });

// 1) 既存の nagi-* を掃除（エイリアス → メニューの順）
try {
  const { aliases = [] } = await api("GET", "/v2/bot/richmenu/alias/list");
  for (const a of aliases) if (a.richMenuAliasId.startsWith("nagi-")) { await api("DELETE", `/v2/bot/richmenu/alias/${a.richMenuAliasId}`); console.log("delete alias", a.richMenuAliasId); }
} catch (e) { console.log("alias list:", e.message.slice(0, 120)); }
const { richmenus = [] } = await api("GET", "/v2/bot/richmenu/list");
for (const r of richmenus) if (r.name.startsWith("nagi-")) { await api("DELETE", `/v2/bot/richmenu/${r.richMenuId}`); console.log("delete menu", r.richMenuId); }

// 2) 作成 → 画像 → エイリアス
const ids = {};
for (const m of MENUS) {
  await api("POST", "/v2/bot/richmenu/validate", definition(m));
  const { richMenuId } = await api("POST", "/v2/bot/richmenu", definition(m));
  const img = fs.readFileSync(path.join(ROOT, m.image));
  if (img.length > 1024 * 1024) throw new Error(m.image + " は1MBを超えています");
  await api("POST", `/v2/bot/richmenu/${richMenuId}/content`, null, { host: "https://api-data.line.me", raw: img, type: "image/jpeg" });
  await api("POST", "/v2/bot/richmenu/alias", { richMenuAliasId: m.alias, richMenuId });
  ids[m.id] = richMenuId;
  console.log(`created ${m.alias}: ${richMenuId} (image ${Math.round(img.length / 1024)}KB)`);
}

// 3) 表示設定
if (previewUser) {
  try { await api("POST", `/v2/bot/user/${previewUser}/richmenu/${ids.main}`); console.log("preview linked to", previewUser.slice(0, 6) + "…"); }
  catch (e) { console.log("preview failed:", e.message.slice(0, 160)); }
}
if (args.includes("--activate")) {
  await api("POST", `/v2/bot/user/all/richmenu/${ids.main}`);
  console.log("default rich menu = main (全ユーザーに表示)");
} else {
  console.log("※デフォルト表示は未設定です。Bot(Webhook)の公開後に --activate を付けて実行してください。");
}
