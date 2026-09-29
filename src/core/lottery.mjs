// キャンペーンの応募記録と抽選（運営者専用コマンド）。応募者は「ユーザーID・応募月・回数」のみ保存する。
import { jstDate } from "./stats.mjs";
import { campaign } from "./content.mjs";

const TTL = 150 * 24 * 3600;
export const monthOf = (now) => jstDate(now).slice(0, 7);
export function prevMonth(now) {
  const [y, m] = monthOf(now).split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

export async function recordEntry(store, userId, now = Date.now()) {
  if (!store || !userId) return;
  const k = `e:${monthOf(now)}:${userId}`;
  const v = (await store.get(k)) ?? { n: 0, first: now };
  v.n += 1;
  v.last = now;
  await store.put(k, v, TTL);
}

export async function poolFor(store, month) {
  const out = [];
  for (const k of await store.list(`e:${month}:`)) {
    const v = await store.get(k);
    if (v) out.push({ userId: k.split(":").slice(2).join(":"), n: v.n });
  }
  return out;
}

const weight = (e) => Math.min(e.n, 3); // 複数サービス登録を想定し、最大3口

/** 一様乱数(暗号論的)。0以上max未満の整数 */
function randInt(max) {
  const buf = new Uint32Array(1);
  const limit = Math.floor(0x100000000 / max) * max;
  do crypto.getRandomValues(buf); while (buf[0] >= limit);
  return buf[0] % max;
}

/** 重み付きで重複なしに k 名を選ぶ */
export function pickWinners(pool, k) {
  const left = pool.map((e) => ({ ...e }));
  const winners = [];
  while (winners.length < k && left.length) {
    const total = left.reduce((s, e) => s + weight(e), 0);
    let r = randInt(total);
    const idx = left.findIndex((e) => (r -= weight(e)) < 0);
    winners.push(left.splice(idx, 1)[0]);
  }
  return winners;
}

const targetMonth = (arg, now) => (arg === "今月" ? monthOf(now) : arg && /^\d{4}-\d{2}$/.test(arg) ? arg : prevMonth(now));

async function nameOf(client, userId) {
  try { return (await client.profile(userId)).displayName; } catch { return "（取得できません）"; }
}

const HELP = [
  "運営者用コマンド",
  "・抽選 … 前月分の応募から3名を抽選",
  "・抽選今月 … 今月分で抽選（月末の確認用）",
  "・抽選2026-09 … 指定した月で抽選",
  "・抽選再 … 引き直し（例：抽選今月再）",
  "・当選連絡 … 直近の当選者に当選のご連絡を送信",
  "・応募者数 … 今月と前月の応募者数",
  "・統計 … 直近7日の集計",
].join("\n");

/** 運営者コマンドを処理。該当しなければ null */
export async function adminCommand(t, { store, client, now }) {
  if (/^(管理|ヘルプ|help)$/.test(t)) return HELP;
  if (!store && /^(抽選|当選連絡|応募者数)/.test(t)) return "この機能には Cloudflare KV（STORE）の設定が必要です。";

  if (t === "応募者数") {
    const cur = await poolFor(store, monthOf(now));
    const prev = await poolFor(store, prevMonth(now));
    return `応募者数\n今月（${monthOf(now)}）：${cur.length}名（のべ${cur.reduce((s, e) => s + e.n, 0)}件）\n前月（${prevMonth(now)}）：${prev.length}名（のべ${prev.reduce((s, e) => s + e.n, 0)}件）`;
  }

  let m = t.match(/^抽選(今月|前月|\d{4}-\d{2})?(再)?$/);
  if (m) {
    const month = targetMonth(m[1], now);
    const key = `draw:${month}`;
    const existing = await store.get(key);
    if (existing && !m[2]) {
      return `${month}分は抽選済みです（${existing.winners.length}名）。引き直す場合は「抽選${m[1] ?? ""}再」と送ってください。\n当選者への連絡は「当選連絡」です。`;
    }
    const pool = await poolFor(store, month);
    if (!pool.length) return `${month}分の応募はありません。`;
    const winners = pickWinners(pool, campaign.winners);
    await store.put(key, { ts: now, winners, pool: pool.length, notified: false }, TTL);
    await store.put("draw:latest", { month }, TTL);
    const lines = [];
    for (const [i, w] of winners.entries()) lines.push(`${i + 1}. ${await nameOf(client, w.userId)}さん（応募${w.n}回）`);
    return `🎯 抽選結果（${month}分）\n応募者${pool.length}名から${winners.length}名を抽選しました。\n\n${lines.join("\n")}\n\n※トークで応募画像を確認してから「当選連絡」を送ってください。無効な応募だった場合は「抽選${m[1] ?? ""}再」で引き直せます。`;
  }

  m = t.match(/^当選連絡(今月|前月|\d{4}-\d{2})?$/);
  if (m) {
    const latest = await store.get("draw:latest");
    const month = m[1] ? targetMonth(m[1], now) : latest?.month;
    const rec = month && (await store.get(`draw:${month}`));
    if (!rec) return "連絡する抽選結果がありません。先に「抽選」を実行してください。";
    if (rec.notified) return `${month}分の当選者には連絡済みです。`;
    let sent = 0;
    for (const w of rec.winners) {
      try { await client.push(w.userId, [{ type: "text", text: WINNER_MESSAGE }]); sent++; } catch { /* ブロック等 */ }
    }
    await store.put(`draw:${month}`, { ...rec, notified: true }, TTL);
    return `${month}分の当選者${sent}/${rec.winners.length}名に、当選のご連絡を送信しました。\n返信が来たら、トークでお渡し方法をご案内してください。`;
  }
  return null;
}

export const WINNER_MESSAGE = [
  "🎉 ご当選のお知らせ",
  "",
  `毎月抽選の「${campaign.prize}」キャンペーンに、当選されました。おめでとうございます！`,
  "",
  "賞品のお渡しについて、このトークで運営からご案内します。お手数ですが、このメッセージにご返信ください。",
  "",
  "※ご連絡から7日以内にご返信がない場合は、当選を無効とさせていただく場合があります。",
].join("\n");
