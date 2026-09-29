// 診断の回答（state）を postback.data に載せて受け渡す。サーバー側は何も保存しない（ステートレス）。
import { SUBS } from "./labels.mjs";

const KEYS = ["j", "s", "g", "i", "p", "t", "r"];

/** {j:'med',s:'nurse'} → "j:med,s:nurse"（挿入順を保持） */
export function encode(state) {
  return Object.entries(state)
    .filter(([k, v]) => KEYS.includes(k) && v)
    .map(([k, v]) => `${k}:${v}`)
    .join(",");
}

/** "j:med,s:nurse" → {j:'med',s:'nurse'} */
export function decode(str) {
  const out = {};
  for (const pair of (str || "").split(",")) {
    const [k, v] = pair.split(":");
    if (KEYS.includes(k) && v) out[k] = v;
  }
  return out;
}

/** postback.data を {action, state} に分解。形式: "action|state" */
export function parseData(data = "") {
  const [action, rest = ""] = data.split("|");
  return { action, arg: rest };
}
export const makeData = (action, state) => (state && Object.keys(state).length ? `${action}|${encode(state)}` : action);

/** 職種に追加質問が必要か */
export const needsSub = (j) => Boolean(SUBS[j]);

/** 次に聞くべき質問キー。すべて回答済みなら null */
export function nextKey(a) {
  if (!a.j) return "j";
  if (needsSub(a.j) && !a.s) return "s";
  if (!a.g) return "g";
  if (!a.i) return "i";
  if (!a.p) return "p";
  if (!a.t) return "t";
  return null;
}

/** 進捗の段階（1〜5）。エリアの追加質問は5扱い */
export function stepNumber(key) {
  return { j: 1, s: 1, g: 2, i: 3, p: 4, t: 5, r: 5 }[key] ?? 1;
}

/** 1つ前の質問に戻るための state（最後の回答を1つ取り除く） */
export function previous(a) {
  const entries = Object.entries(a);
  entries.pop();
  return Object.fromEntries(entries);
}
