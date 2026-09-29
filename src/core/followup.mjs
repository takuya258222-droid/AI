// 診断後のフォロー配信（最大2回・日中のみ）。KVが無い環境では無効。
// 保存するのは userId・診断の回答(state)・送信段階のみ。「配信停止」・ブロック・スクショ送信で削除する。
import { brand } from "./content.mjs";
import { encode } from "./state.mjs";
import { jstHour } from "./stats.mjs";
import {
  C, text, spacer, postback, cta, ghost, linkBtn, eyebrow, bubble, bodyBox, footerBox, flexMessage,
} from "./flex.mjs";

const HOUR = 3600 * 1000;
export const STAGE_DELAY = [22 * HOUR, 96 * HOUR]; // 診断から約1日後／約4日後
const keyOf = (userId) => `d:${userId}`;

export async function recordDiagnosis(store, userId, state, now = Date.now()) {
  if (!store || !userId) return;
  await store.put(keyOf(userId), { state: encode(state), ts: now, stage: 0 }, brand.followup.retentionDays * 24 * 3600);
}
export async function stopFollowup(store, userId) {
  if (!store || !userId) return;
  await store.delete(keyOf(userId));
}

export function followupMessage(stage, stateStr) {
  const again = postback("診断結果をもう一度見る", `rs|${stateStr}`, "診断結果をもう一度見る");
  const stop = text(`配信を止める場合は「${brand.followup.stopKeyword}」と送信してください。`, { size: "xxs", color: C.muted, align: "center", margin: "sm" });
  if (stage === 0) {
    const b = bubble({
      body: bodyBox([
        eyebrow("FOLLOW UP"),
        text("昨日の診断、いかがでしたか？", { size: "lg", weight: "bold", color: C.navy, margin: "sm" }),
        text("気になるサービスがあれば、まず1社だけ登録して、面談で話を聞いてみるのがおすすめです。診断結果は、ボタンからもう一度ご覧いただけます。", { size: "sm", margin: "md" }),
      ]),
      footer: footerBox([cta("診断結果をもう一度見る", again), linkBtn("転職体験記を読む", postback("転職体験記", "taiken", "転職体験記")), stop]),
    });
    return flexMessage("昨日の診断結果を、もう一度ご覧いただけます", b);
  }
  const b = bubble({
    body: bodyBox([
      eyebrow("FOLLOW UP"),
      text("登録はお済みですか？", { size: "lg", weight: "bold", color: C.navy, margin: "sm" }),
      text("登録完了画面のスクリーンショットをこのトークに送ると、毎月抽選（3名様）のキャンペーンに応募できます。", { size: "sm", margin: "md" }),
      text("※登録された方全員へのプレゼントではありません。", { size: "xxs", color: C.muted, margin: "sm" }),
    ]),
    footer: footerBox([cta("診断結果をもう一度見る", again), ghost("キャンペーン詳細", postback("キャンペーン", "camp", "キャンペーン詳細"), { size: "xs", padding: "9px" }), stop]),
  });
  return flexMessage("登録はお済みですか？ スクショを送ると抽選に応募できます", b);
}

/** 期限が来た宛先へフォローを送る（Cron から毎時呼ぶ） */
export async function runFollowups({ store, client, now = Date.now() }) {
  if (!store) return { skipped: "no-store" };
  const hour = jstHour(now);
  if (hour < 9 || hour >= 21) return { skipped: "quiet-hours" };
  const result = { checked: 0, sent: 0, removed: 0, errors: 0 };
  const ttl = brand.followup.retentionDays * 24 * 3600;
  let keys = [];
  try { keys = await store.list("d:"); } catch (e) { console.log(JSON.stringify({ evt: "followup_list_error", msg: String(e).slice(0, 120) })); return { ...result, errors: 1 }; }
  for (const key of keys) {
    try {
      const rec = await store.get(key);
      result.checked++;
      if (!rec) continue;
      const userId = key.slice(2);
      const due = now - rec.ts >= STAGE_DELAY[rec.stage];
      if (!due) continue;
      // 先に「送信済み」に更新してから送る。保存が失敗したら送らない（毎時くり返し同じ人に届く二重送信を防ぐ）
      if (rec.stage >= 1) await store.delete(key); else await store.put(key, { ...rec, stage: 1 }, ttl);
      try {
        await client.push(userId, [followupMessage(rec.stage, rec.state)]);
        result.sent++;
        if (rec.stage >= 1) result.removed++;
      } catch (e) {
        console.log(JSON.stringify({ evt: "followup_error", status: e.status }));
        result.errors++;
        // ブロック済み・無効なIDなどは、そのまま削除。一時エラー・上限到達(429)は、元に戻して次回に再試行
        if (e.status && e.status >= 400 && e.status < 500 && e.status !== 429) { await store.delete(key); result.removed++; }
        else { await store.put(key, rec, ttl); if (e.status === 429) break; }
      }
    } catch (e) {
      result.errors++;
      console.log(JSON.stringify({ evt: "followup_store_error", msg: String(e).slice(0, 120) }));
    }
  }
  return result;
}
