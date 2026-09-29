// 運営者向けレポート（「統計」コマンドと、毎週月曜の自動送信で共有）
import { jstDate, jstHour, tagTotals, jobTotals, counterTotals } from "./stats.mjs";
import { poolFor, monthOf } from "./lottery.mjs";

const DAY = 24 * 3600 * 1000;
const JOB_LABEL = { nurse: "看護師", care: "介護職", pharm: "薬剤師", child: "保育士", medother: "医療・福祉その他", it_none: "IT未経験", it_jr: "IT経験3年未満", it_sr: "IT経験3年以上", it_free: "IT・フリーランス", bizsales: "営業", retail: "販売・接客", office: "事務・管理", mfg: "製造", eng: "技術職", const: "建築・施工・設備", logi: "物流・ドライバー", gen: "その他", dis: "障がい者雇用", consul: "コンサル", ma: "M&A" };
const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : "―");

export async function buildReport(store, days = 7, now = Date.now(), { weekly = false } = {}) {
  if (!store) return "集計を使うには、Cloudflare KV（STORE）の設定が必要です。";
  const ct = await counterTotals(store, days, now);
  const { follow = 0, start = 0, done = 0, shot = 0 } = ct;
  const tags = await tagTotals(store, days, now);
  const jobs = await jobTotals(store, days, now);
  const pool = await poolFor(store, monthOf(now));
  const from = jstDate(now - (days - 1) * DAY).slice(5);
  const to = jstDate(now).slice(5);

  const L = [];
  L.push(`📊 ${weekly ? "週次レポート" : "集計"}（${from}〜${to}）`);
  L.push(`友だち追加 ${follow}｜診断開始 ${start}｜診断完了 ${done}｜スクショ ${shot}`);
  L.push(`診断開始率 ${pct(start, follow)}／診断完了率 ${pct(done, start)}／応募率 ${pct(shot, done)}`);

  const tagRows = Object.entries(tags).sort((a, b) => b[1].click + b[1].start - (a[1].click + a[1].start));
  if (tagRows.length) {
    L.push("", "▼流入経路別（クリック→開始→完了→スクショ）");
    for (const [t, v] of tagRows.slice(0, 8)) L.push(`${t}：${v.click}→${v.start}→${v.done}→${v.shot}`);
  }
  const jobRows = Object.entries(jobs).sort((a, b) => b[1] - a[1]).slice(0, 3);
  if (jobRows.length) L.push("", `▼診断が多かった職種：${jobRows.map(([k, n]) => `${JOB_LABEL[k] ?? k} ${n}`).join("／")}`);
  L.push("", `今月の抽選応募：${pool.length}名`);

  if (weekly) {
    const hints = [];
    if (follow >= 5 && start / follow < 0.5) hints.push("診断開始率が低め → あいさつの訴求や、1通目の文面を見直しましょう。");
    if (start >= 5 && done / start < 0.6) hints.push("診断の完了率が低め → 質問の数・順番、途中離脱の多い質問を見直しましょう。");
    if (done >= 5 && shot / done < 0.1) hints.push("応募率が低め → 結果カードのボタンと、キャンペーンの見せ方を強化しましょう。");
    if (!tagRows.length) hints.push("流入経路のリンク（/l/経路名）を、noteやThreadsに使うと、効く投稿が分かります。");
    L.push("", "💡 今週のヒント", ...(hints.length ? hints.map((h) => "・" + h) : ["・数字は順調です。効いた流入経路の投稿を増やしましょう。"]));
  }
  return L.join("\n");
}

/** 毎週月曜 日本時間9時台に、運営者へ週次レポートを送る（Cronから毎時呼ぶ。1週1回だけ） */
export async function runWeekly({ store, client, env, now = Date.now() }) {
  if (!store || !env.ADMIN_USER_ID) return { skipped: "no-store-or-admin" };
  const jst = new Date(now + 9 * 3600 * 1000);
  if (jst.getUTCDay() !== 1 || jstHour(now) !== 9) return { skipped: "not-monday-9" };
  const key = `w:${jstDate(now)}`;
  if (await store.get(key)) return { skipped: "already-sent" };
  await store.put(key, { t: now }, 14 * DAY / 1000);
  try {
    await client.push(env.ADMIN_USER_ID, [{ type: "text", text: await buildReport(store, 7, now, { weekly: true }) }]);
    return { sent: true };
  } catch (e) {
    return { error: e.status };
  }
}
