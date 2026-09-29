// LINE Webhook イベントの処理
import { brand } from "./content.mjs";
import { decode, parseData, nextKey } from "./state.mjs";
import { decide } from "./matcher.mjs";
import { questionMessage, nextQuestion, resultMessages, salaryAskMessage, salaryResultMessage } from "./diagnosis.mjs";
import {
  welcomeMessages, campaignMessage, stepsMessage, receiptMessages, taikenMessage, knowledgeMessage, faqMenuMessage, faqAnswerMessage,
  aboutMessage, policyMessage, privacyMessage, contactMessage, homeMessage, fallbackMessages,
} from "./messages.mjs";
import { recordDiagnosis, stopFollowup } from "./followup.mjs";
import { bump, report } from "./stats.mjs";

const text = (t) => ({ type: "text", text: t });
const norm = (s) => s.normalize("NFKC").toLowerCase().replace(/\s+/g, "");

/** キーワード → 動作。上から順に判定する */
const KEYWORDS = [
  [/年収/, "sal"],
  [/キャンペーン|paypay|ぺいぺい|ペイペイ|抽選|プレゼント/, "camp"],
  [/スクショ|スクリーンショット|登録|応募/, "steps"],
  [/体験記|事例|note|ノート/, "taiken"],
  [/ノウハウ|コツ|使い方/, "know"],
  [/運営|プロフィール|なぎ/, "about"],
  [/選定|基準|考え方|なぜ|理由/, "policy"],
  [/プライバシー|個人情報|広告|ステマ|^pr$/, "privacy"],
  [/問い合わせ|問合せ|連絡/, "contact"],
  [/質問|faq|よくある|料金|無料/, "faq"],
  [/診断|スタート|start|はじめ|始め/, "st"],
  [/求人|転職|エージェント|おすすめ|相談/, "st-intro"],
  [/メニュー|ホーム|menu|home/, "home"],
];

/** 動作名 → 返信メッセージ */
function route(action, arg, ctx) {
  const { base } = ctx;
  const a = decode(arg);
  switch (action) {
    case "st": return { messages: [questionMessage("j", {}, base)], evt: "start" };
    case "st-intro": return { messages: [text("転職のご相談は、30秒診断がいちばんの近道です。\nタップだけで、あなたに合うサービスをご案内します。"), questionMessage("j", {}, base)], evt: "start" };
    case "d": {
      const key = nextKey(a);
      if (key) return { messages: [questionMessage(key, a, base)] };
      const res = decide(a);
      if (res.status === "need_area") return { messages: [questionMessage("r", a, base)] };
      return { messages: resultMessages(a, base), evt: "done", record: a, key: res.key, picks: res.picks.map((p) => p.service.id) };
    }
    case "b": return { messages: [nextQuestion(a, base) ?? questionMessage("j", {}, base)] };
    case "rs": {
      const res = decide(a);
      return { messages: res.status === "ok" ? resultMessages(a, base) : [questionMessage("r", a, base)] };
    }
    case "sal": return { messages: [a.i && a.i !== "ix" ? salaryResultMessage(a.i, base) : salaryAskMessage(base)] };
    case "camp": return { messages: [campaignMessage(base)] };
    case "steps": return { messages: [stepsMessage(base)] };
    case "faq": return { messages: [arg ? faqAnswerMessage(arg) : faqMenuMessage()] };
    case "know": return { messages: [knowledgeMessage(base)] };
    case "taiken": return { messages: [taikenMessage(base)] };
    case "about": return { messages: [aboutMessage(base)] };
    case "policy": return { messages: [policyMessage(base)] };
    case "privacy": return { messages: [privacyMessage(base)] };
    case "contact": return { messages: [contactMessage()] };
    case "home": return { messages: [homeMessage(base)] };
    default: return { messages: fallbackMessages(base) };
  }
}

async function safeReply(ctx, replyToken, messages) {
  try {
    await ctx.client.reply(replyToken, messages);
    console.log(JSON.stringify({ evt: "reply_ok", n: messages.length }));
  } catch (e) {
    console.log(JSON.stringify({ evt: "reply_error", status: e.status, body: JSON.stringify(e.body ?? "").slice(0, 300) }));
    if (e.status === 400) {
      try { await ctx.client.reply(replyToken, [text("申し訳ありません、表示に失敗しました。もう一度お試しください。")]); } catch { /* 無視 */ }
    }
  }
}

export async function handleEvent(event, ctx) {
  const { client, store, env } = ctx;
  const now = ctx.now ?? Date.now();
  const userId = event.source?.userId;

  switch (event.type) {
    case "follow": {
      let name;
      try { name = (await client.profile(userId)).displayName; } catch { /* 取得できなくてもOK */ }
      await bump(store, "follow", now);
      return safeReply(ctx, event.replyToken, welcomeMessages(ctx.base, name, { returning: event.follow?.isUnblocked === true }));
    }
    case "unfollow":
      return stopFollowup(store, userId);
    case "postback": {
      const { action, arg } = parseData(event.postback?.data);
      const r = route(action, arg, ctx);
      if (r.evt) await bump(store, r.evt, now);
      if (r.record) {
        await recordDiagnosis(store, userId, r.record, now);
        console.log(JSON.stringify({ evt: "diag_done", key: r.key, picks: r.picks, priority: r.record.p }));
      }
      return safeReply(ctx, event.replyToken, r.messages);
    }
    case "message": {
      const m = event.message;
      if (m.type === "image") {
        await bump(store, "shot", now);
        await stopFollowup(store, userId); // 応募済みの方へのフォローは停止
        if (env.ADMIN_USER_ID) {
          try { await client.push(env.ADMIN_USER_ID, [text("📥 キャンペーンのスクショが届きました。トークをご確認ください。")]); } catch { /* 通知は任意 */ }
        }
        return safeReply(ctx, event.replyToken, receiptMessages(ctx.base));
      }
      if (m.type !== "text") return safeReply(ctx, event.replyToken, fallbackMessages(ctx.base));

      const raw = m.text.trim();
      const t = norm(raw);
      if (env.ADMIN_USER_ID && userId === env.ADMIN_USER_ID && /^(統計|stats)$/.test(t)) {
        return safeReply(ctx, event.replyToken, [text(await report(store, 7, now))]);
      }
      if (t === norm(brand.followup.stopKeyword)) {
        await stopFollowup(store, userId);
        return safeReply(ctx, event.replyToken, [text("フォローのメッセージの配信を停止し、保存していた情報を削除しました。\nまた診断したくなったら、いつでもメニューからどうぞ。")]);
      }
      const hit = KEYWORDS.find(([re]) => re.test(t));
      if (!hit) return safeReply(ctx, event.replyToken, fallbackMessages(ctx.base));
      const r = route(hit[1], "", ctx);
      if (r.evt) await bump(store, r.evt, now);
      return safeReply(ctx, event.replyToken, r.messages);
    }
    default:
      return null;
  }
}
