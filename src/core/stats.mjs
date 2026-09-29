// 個人を特定しない日次カウンター（KVが無い環境では何もしない）
const DAY = 24 * 3600 * 1000;
export const jstDate = (now) => new Date(now + 9 * 3600 * 1000).toISOString().slice(0, 10);
export const jstHour = (now) => new Date(now + 9 * 3600 * 1000).getUTCHours();

export async function bump(store, name, now = Date.now()) {
  if (!store) return;
  try {
    const k = `s:${jstDate(now)}:${name}`;
    const v = (await store.get(k)) ?? { n: 0 };
    v.n += 1;
    await store.put(k, v, 90 * 24 * 3600);
  } catch (e) {
    console.log(JSON.stringify({ evt: "stats_error", msg: String(e).slice(0, 120) }));
  }
}

const LABELS = [["follow", "友だち追加"], ["start", "診断開始"], ["done", "診断完了"], ["shot", "スクショ受信"]];

export async function report(store, days = 7, now = Date.now()) {
  if (!store) return "集計を使うには、Cloudflare KV（STORE）の設定が必要です。";
  const lines = [`直近${days}日の集計（日本時間）`, `日付｜${LABELS.map((l) => l[1]).join("｜")}`];
  const total = Object.fromEntries(LABELS.map(([k]) => [k, 0]));
  for (let i = 0; i < days; i++) {
    const d = jstDate(now - i * DAY);
    const row = [];
    for (const [k] of LABELS) {
      const v = (await store.get(`s:${d}:${k}`))?.n ?? 0;
      total[k] += v;
      row.push(v);
    }
    lines.push(`${d.slice(5)}｜${row.join("｜")}`);
  }
  lines.push(`合計｜${LABELS.map(([k]) => total[k]).join("｜")}`);
  const rate = total.start ? Math.round((total.done / total.start) * 100) : 0;
  lines.push(`診断完了率：${rate}%`);
  return lines.join("\n");
}

// ---- 流入経路別のカウンター（t:日付:経路:指標）。ユーザーは特定しない ----
export async function bumpTag(store, tag, metric, now = Date.now()) {
  if (!store || !tag) return;
  try {
    const k = `t:${jstDate(now)}:${tag}:${metric}`;
    const v = (await store.get(k)) ?? { n: 0 };
    v.n += 1;
    await store.put(k, v, 120 * 24 * 3600);
  } catch (e) {
    console.log(JSON.stringify({ evt: "stats_error", msg: String(e).slice(0, 120) }));
  }
}

/** 経路別の合計 {tag:{click,start,done,shot}} */
export async function tagTotals(store, days = 7, now = Date.now()) {
  const from = jstDate(now - (days - 1) * DAY);
  const out = {};
  for (const k of await store.list("t:")) {
    const [, date, tag, metric] = k.split(":");
    if (date < from) continue;
    const n = (await store.get(k))?.n ?? 0;
    (out[tag] ??= { click: 0, start: 0, done: 0, shot: 0 })[metric] += n;
  }
  return out;
}

/** 職種別の診断完了数 {key:n} */
export async function jobTotals(store, days = 7, now = Date.now()) {
  const from = jstDate(now - (days - 1) * DAY);
  const out = {};
  for (const k of await store.list("s:")) {
    const [, date, name] = k.split(":");
    if (date < from || !name.startsWith("job_")) continue;
    out[name.slice(4)] = (out[name.slice(4)] ?? 0) + ((await store.get(k))?.n ?? 0);
  }
  return out;
}
