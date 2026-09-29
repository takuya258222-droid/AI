// 個人を特定しない日次カウンター（KVが無い環境では何もしない）。
// 1日1ドキュメント（s:YYYY-MM-DD）に全カウンターをまとめ、1回のイベントにつき書き込みは最大1回。
// （Cloudflare無料プランのKVは書き込み1日1,000回までなので、回数を抑える設計）
const DAY = 24 * 3600 * 1000;
const TTL = 90 * 24 * 3600;
export const jstDate = (now) => new Date(now + 9 * 3600 * 1000).toISOString().slice(0, 10);
export const jstHour = (now) => new Date(now + 9 * 3600 * 1000).getUTCHours();

/** 複数のカウントを1回の書き込みで加算する */
export async function bumpMany(store, names, now = Date.now()) {
  const list = (names ?? []).filter(Boolean);
  if (!store || !list.length) return;
  try {
    const k = `s:${jstDate(now)}`;
    const v = (await store.get(k)) ?? {};
    for (const n of list) v[n] = (v[n] ?? 0) + 1;
    await store.put(k, v, TTL);
  } catch (e) {
    console.log(JSON.stringify({ evt: "stats_error", msg: String(e).slice(0, 120) }));
  }
}

export const bump = (store, name, now = Date.now()) => bumpMany(store, [name], now);
const tagName = (tag, metric) => (tag ? `tag:${tag}:${metric}` : null);
export const bumpTag = (store, tag, metric, now = Date.now()) => bumpMany(store, [tagName(tag, metric)], now);

/** 1回のイベント内のカウントをためておき、最後に1回だけ書き込む */
export function statsBatch(store, now = Date.now()) {
  const names = [];
  return {
    add: (name) => { if (name) names.push(name); },
    addTag: (tag, metric) => { const n = tagName(tag, metric); if (n) names.push(n); },
    flush: () => bumpMany(store, names.splice(0), now),
  };
}

const LABELS = [["follow", "友だち追加"], ["start", "診断開始"], ["done", "診断完了"], ["shot", "スクショ受信"]];

export async function readDays(store, days, now) {
  const out = [];
  for (let i = 0; i < days; i++) {
    const d = jstDate(now - i * DAY);
    let v = null;
    try { v = await store.get(`s:${d}`); } catch { /* 読めない日は0扱い */ }
    out.push([d, v ?? {}]);
  }
  return out;
}

export async function report(store, days = 7, now = Date.now()) {
  if (!store) return "集計を使うには、Cloudflare KV（STORE）の設定が必要です。";
  const lines = [`直近${days}日の集計（日本時間）`, `日付｜${LABELS.map((l) => l[1]).join("｜")}`];
  const total = Object.fromEntries(LABELS.map(([k]) => [k, 0]));
  for (const [d, v] of await readDays(store, days, now)) {
    const row = LABELS.map(([k]) => { total[k] += v[k] ?? 0; return v[k] ?? 0; });
    lines.push(`${d.slice(5)}｜${row.join("｜")}`);
  }
  lines.push(`合計｜${LABELS.map(([k]) => total[k]).join("｜")}`);
  const rate = total.start ? Math.round((total.done / total.start) * 100) : 0;
  lines.push(`診断完了率：${rate}%`);
  return lines.join("\n");
}

/** 経路別の合計 {tag:{click,start,done,shot}} */
export async function tagTotals(store, days = 7, now = Date.now()) {
  const out = {};
  for (const [, v] of await readDays(store, days, now)) {
    for (const [name, n] of Object.entries(v)) {
      if (!name.startsWith("tag:")) continue;
      const [, tag, metric] = name.split(":");
      (out[tag] ??= { click: 0, start: 0, done: 0, shot: 0 })[metric] += n;
    }
  }
  return out;
}

/** 職種別の診断完了数 {key:n} */
export async function jobTotals(store, days = 7, now = Date.now()) {
  const out = {};
  for (const [, v] of await readDays(store, days, now)) {
    for (const [name, n] of Object.entries(v)) if (name.startsWith("job_")) out[name.slice(4)] = (out[name.slice(4)] ?? 0) + n;
  }
  return out;
}

/** 直近days日の全カウンターの合計 {name:n} */
export async function counterTotals(store, days = 7, now = Date.now()) {
  const out = {};
  for (const [, v] of await readDays(store, days, now)) for (const [name, n] of Object.entries(v)) out[name] = (out[name] ?? 0) + n;
  return out;
}
