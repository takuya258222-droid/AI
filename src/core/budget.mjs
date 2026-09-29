// 月のプッシュ配信数の管理。LINE公式アカウントの無料プランは、月200通までのため、
// 上限に達して配信が失敗する（または有料になる）ことがないよう、Cronからの配信数を自分で数えて止める。
// 返信（reply）は上限に含まれない。運営者への通知・週次レポート用に、reserve通は常に残しておく。
import { jstDate } from "./stats.mjs";

const monthKey = (now) => `pb:${jstDate(now).slice(0, 7)}`;

/**
 * @param env.PUSH_MONTHLY_LIMIT 月の上限（既定200＝無料プラン）。有料プランなら増やす
 * @param env.PUSH_RESERVE 運営者通知用に残す通数（既定30）
 */
export async function loadBudget(store, env = {}, now = Date.now()) {
  const limit = Number(env.PUSH_MONTHLY_LIMIT ?? 200);
  const reserve = Number(env.PUSH_RESERVE ?? 30);
  let used = 0;
  if (store) {
    try { used = (await store.get(monthKey(now)))?.n ?? 0; } catch { /* 読めなければ0扱い */ }
  }
  let pending = 0;
  const room = () => limit - reserve - used - pending;
  return {
    limit, reserve,
    left: () => Math.max(0, room()),
    used: () => used + pending,
    /** n通ぶんの枠を確保する。足りなければ false */
    take(n = 1) { if (room() < n) return false; pending += n; return true; },
    /** 送信に失敗したぶんを戻す */
    refund(n = 1) { pending = Math.max(0, pending - n); },
    /** 確定して保存（Cronの最後に1回だけ） */
    async commit() {
      if (!store || !pending) return;
      used += pending; pending = 0;
      try { await store.put(monthKey(now), { n: used }, 70 * 24 * 3600); } catch (e) { console.log(JSON.stringify({ evt: "budget_error", msg: String(e).slice(0, 100) })); }
    },
  };
}
