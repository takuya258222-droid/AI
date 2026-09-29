// 診断後のフォロー配信（最大2回・日中のみ）。KVが無い環境では無効。
// 保存するのは userId・診断の回答(state)・送信段階のみ。「配信停止」・ブロック・スクショ送信で削除する。
import { brand, campaign } from "./content.mjs";
import { encode, decode } from "./state.mjs";
import { keyOf } from "./matcher.mjs";
import { tipsData } from "./tips.mjs";
import { jstHour, jstDate } from "./stats.mjs";
import {
  C, text, box, spacer, sep, postback, cta, ghost, linkBtn, eyebrow, bubble, bodyBox, footerBox, flexMessage, quickReply, panel, stepRow,
} from "./flex.mjs";

const HOUR = 3600 * 1000;
// 診断から、約1日後／約4日後／約7日後
export const STAGE_DELAY = [22 * HOUR, 96 * HOUR, 168 * HOUR];
const keyOfUser = (userId) => `d:${userId}`;
const retentionSec = () => brand.followup.retentionDays * 24 * 3600;
/** 保存期間は、診断の日から数える（更新のたびに延びないようにする） */
const ttlLeft = (rec, now) => Math.max(60, retentionSec() - Math.floor((now - rec.ts) / 1000));
const metaOf = (rec) => ({ ts: rec.ts, stage: rec.stage, rem: rec.remMonth ?? "" });

export async function recordDiagnosis(store, userId, state, now = Date.now()) {
  if (!store || !userId) return;
  const rec = { state: encode(state), ts: now, stage: 0 };
  await store.put(keyOfUser(userId), rec, retentionSec(), metaOf(rec));
}
export async function stopFollowup(store, userId) {
  if (!store || !userId) return;
  await store.delete(keyOfUser(userId));
}
/** 「配信停止」・ブロック時: 診断の保存データと、新着note配信の登録をすべて削除 */
export async function stopAll(store, userId) {
  if (!store || !userId) return;
  await store.delete(keyOfUser(userId));
  await store.delete(`sub:${userId}`);
}

/** 「登録した」「まだ迷ってる」を、カードの中に大きなボタンで並べる */
const intentRow = (stateStr) => box("horizontal", [
  ghost("登録した", postback("登録した", `regy|${stateStr}`, "登録した"), { size: "sm", padding: "10px" }),
  ghost("まだ迷ってる", postback("まだ迷ってる", `regm|${stateStr}`, "まだ迷ってる"), { size: "sm", padding: "10px" }),
], { spacing: "sm", margin: "sm" });

/** 診断結果を見直す・登録の意思を伝えるボタン（フォロー・リマインドの下に表示） */
const quick = (stateStr) => quickReply([
  ["登録した", `regy|${stateStr}`, "登録した"],
  ["まだ迷ってる", `regm|${stateStr}`, "まだ迷ってる"],
  ["結果をもう一度見る", `rs|${stateStr}`, "結果をもう一度見る"],
]);

export function followupMessage(stage, stateStr) {
  const again = postback("診断結果をもう一度見る", `rs|${stateStr}`, "診断結果をもう一度見る");
  const stop = text(`配信を止める場合は「${brand.followup.stopKeyword}」と送信してください。`, { size: "xxs", color: C.muted, align: "center", margin: "sm" });
  let msg;
  if (stage === 0) {
    const b = bubble({
      body: bodyBox([
        eyebrow("FOLLOW UP"),
        text("昨日の診断、いかがでしたか？", { size: "lg", weight: "bold", color: C.navy, margin: "sm" }),
        text("気になるサービスがあれば、まず1社だけ登録して、面談で話を聞いてみるのがおすすめです。診断結果は、ボタンからもう一度ご覧いただけます。", { size: "sm", margin: "md" }),
      ]),
      footer: footerBox([cta("診断結果をもう一度見る", again), intentRow(stateStr), linkBtn("転職体験記を読む", postback("転職体験記", "taiken", "転職体験記")), stop]),
    });
    msg = flexMessage("昨日の診断結果を、もう一度ご覧いただけます", b);
  } else if (stage === 1) {
    const b = bubble({
      body: bodyBox([
        eyebrow("FOLLOW UP"),
        text("登録はお済みですか？", { size: "lg", weight: "bold", color: C.navy, margin: "sm" }),
        text("登録完了画面のスクリーンショットをこのトークに送ると、毎月抽選（3名様）のキャンペーンに応募できます。", { size: "sm", margin: "md" }),
        text("※登録された方全員へのプレゼントではありません。", { size: "xxs", color: C.muted, margin: "sm" }),
      ]),
      footer: footerBox([cta("診断結果をもう一度見る", again), intentRow(stateStr), ghost("キャンペーン詳細", postback("キャンペーン", "camp", "キャンペーン詳細"), { size: "xs", padding: "9px" }), stop]),
    });
    msg = flexMessage("登録はお済みですか？ スクショを送ると抽選に応募できます", b);
  } else {
    const st = decode(stateStr);
    const tipsBtn = postback("面談・選考のポイント", tipsData(keyOf(st), st.g), "面談・選考のポイント");
    const b = bubble({
      body: bodyBox([
        eyebrow("FOLLOW UP"),
        text("迷っている方へ：選ぶときの3つの目安", { size: "lg", weight: "bold", color: C.navy, margin: "sm" }),
        stepRow(1, "対象条件が合っているか", "年代・職種・エリアなど、サービスの対象を確認"),
        stepRow(2, "担当者との相性", "求人の幅や話しやすさは、面談で確かめられます"),
        stepRow(3, "2〜3社を比べる", "1社に絞らず、比べてから決めるのがおすすめです"),
        text("合わなければ、断ったり、やめたりして大丈夫です。", { size: "xs", color: C.muted, margin: "md" }),
      ]),
      footer: footerBox([cta("診断結果をもう一度見る", again), intentRow(stateStr), linkBtn("面談・選考のポイントを見る", tipsBtn), stop]),
    });
    msg = flexMessage("迷っている方へ：サービスを選ぶときの3つの目安", b);
  }
  msg.quickReply = quick(stateStr);
  return msg;
}

/** 月末の応募締切前リマインド */
export function remindMessage(daysLeft, stateStr) {
  const head = daysLeft <= 0 ? "今日が、今月の応募締切です" : `今月の応募締切まで、あと${daysLeft}日です`;
  const b = bubble({
    body: bodyBox([
      eyebrow("CAMPAIGN"),
      text(head, { size: "lg", weight: "bold", color: C.navy, margin: "sm" }),
      text(`サービスに登録して、完了画面のスクリーンショットをこのトークに送ると、今月の抽選に応募できます（${campaign.title.replace("登録スクショで、", "")}）。`, { size: "sm", margin: "md" }),
      panel([text("※登録・応募された方全員へのプレゼントではありません。毎月末日で締め切り、締切後に抽選します。", { size: "xxs", color: C.muted })], { margin: "md" }),
    ]),
    footer: footerBox([
      cta("診断結果をもう一度見る", postback("診断結果をもう一度見る", `rs|${stateStr}`, "診断結果をもう一度見る")),
      intentRow(stateStr),
      ghost("応募のルール・キャンペーン詳細", postback("キャンペーン", "camp", "キャンペーン詳細"), { size: "xs", padding: "9px" }),
      text(`配信を止める場合は「${brand.followup.stopKeyword}」と送信してください。`, { size: "xxs", color: C.muted, align: "center", margin: "sm" }),
    ]),
  });
  const m = flexMessage(`${head}。登録完了画面のスクショで応募できます`, b);
  m.quickReply = quick(stateStr);
  return m;
}

const daysInMonth = (now) => { const [y, mo] = jstDate(now).split("-").map(Number); return new Date(Date.UTC(y, mo, 0)).getUTCDate(); };

/**
 * 期限が来た宛先へ、フォローとリマインドを送る（Cron から毎時呼ぶ）。
 * 月末の最後の3日間（日本時間12〜20時）は、まだ応募していない人に「締切リマインド」を優先して送る。
 * @param budget 月の配信数の管理（loadBudget）。枠が足りなければ、送らずに次回へ
 * @param max 1回のCronで送る人数の上限
 */
export async function runFollowups({ store, client, now = Date.now(), budget, max = 6 }) {
  if (!store) return { skipped: "no-store" };
  const hour = jstHour(now);
  if (hour < 9 || hour >= 21) return { skipped: "quiet-hours" };
  const result = { checked: 0, sent: 0, reminded: 0, removed: 0, errors: 0, skippedBudget: 0, skippedCap: 0 };
  let metas = [];
  try { metas = store.listMeta ? await store.listMeta("d:") : (await store.list("d:")).map((name) => ({ name, metadata: null })); } catch (e) { console.log(JSON.stringify({ evt: "followup_list_error", msg: String(e).slice(0, 120) })); return { ...result, errors: 1 }; }

  const month = jstDate(now).slice(0, 7);
  const daysLeft = daysInMonth(now) - Number(jstDate(now).slice(8));
  const inRemindWindow = daysLeft <= 2 && hour >= 12;

  // 値を1件ずつ読まずに、メタデータで「送る必要があるか」を判定する（メタデータの無い古い記録は読んで判定）
  const todo = [];
  for (const { name, metadata } of metas) {
    result.checked++;
    let meta = metadata;
    if (!meta || meta.ts === undefined) {
      try { const r = await store.get(name); if (!r) continue; meta = metaOf(r); } catch { result.errors++; continue; }
    }
    if (inRemindWindow && meta.rem !== month && now - meta.ts >= 20 * HOUR) todo.push({ name, kind: "remind", ts: meta.ts });
    else if (meta.stage < STAGE_DELAY.length && now - meta.ts >= STAGE_DELAY[meta.stage]) todo.push({ name, kind: "stage", ts: meta.ts });
  }
  // リマインド（月末だけの機会）を先に。同じ種類の中では、古い人から
  todo.sort((a, b) => (a.kind === b.kind ? a.ts - b.ts : a.kind === "remind" ? -1 : 1));

  for (const t of todo) {
    // 1回のCronで送る人数には上限がある（無料プランのCPU時間の制限のため）。残りは次の時間に送る
    if (result.sent + result.reminded >= max) { result.skippedCap++; continue; }
    try {
      const rec = await store.get(t.name);
      if (!rec) continue;
      if (budget && !budget.take(1)) { result.skippedBudget++; continue; }
      const userId = t.name.slice(2);
      // 先に「送信済み」に更新してから送る。保存が失敗したら送らない（毎時くり返し同じ人に届く二重送信を防ぐ）
      const next = t.kind === "remind" ? { ...rec, remMonth: month } : { ...rec, stage: rec.stage + 1 };
      try { await store.put(t.name, next, ttlLeft(rec, now), metaOf(next)); } catch (e) { budget?.refund(1); throw e; }
      try {
        const msg = t.kind === "remind" ? remindMessage(daysLeft, rec.state) : followupMessage(rec.stage, rec.state);
        await client.push(userId, [msg]);
        if (t.kind === "remind") result.reminded++; else result.sent++;
      } catch (e) {
        budget?.refund(1);
        console.log(JSON.stringify({ evt: "followup_error", status: e.status, kind: t.kind }));
        result.errors++;
        // ブロック済み・無効なIDなどは、そのまま削除。一時エラー・上限到達(429)は、元に戻して次回に再試行
        if (e.status && e.status >= 400 && e.status < 500 && e.status !== 429) { await store.delete(t.name); result.removed++; }
        else { await store.put(t.name, rec, ttlLeft(rec, now), metaOf(rec)); if (e.status === 429) break; }
      }
    } catch (e) {
      result.errors++;
      console.log(JSON.stringify({ evt: "followup_store_error", msg: String(e).slice(0, 120) }));
    }
  }
  return result;
}
