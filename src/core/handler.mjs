// LINE Webhook イベントの処理
import { brand } from "./content.mjs";
import { decode, parseData, nextKey } from "./state.mjs";
import { decide } from "./matcher.mjs";
import { questionMessage, nextQuestion, resultMessages, resultFallbackMessages, salaryAskMessage, salaryResultMessage } from "./diagnosis.mjs";
import {
  welcomeMessages, campaignMessage, stepsMessage, receiptMessages, taikenMessage, knowledgeMessage, faqMenuMessage, faqAnswerMessage,
  aboutMessage, policyMessage, privacyMessage, homeMessage, fallbackMessages, regMessages, subOnMessage,
} from "./messages.mjs";
import { recordDiagnosis, stopFollowup, stopAll } from "./followup.mjs";
import { tipsFlow, tipsPickerMessage, hasTips } from "./tips.mjs";
import { latestNotes, subRecord } from "./notefeed.mjs";
import { netAskMessage, netResultMessage, prepSheetMessage, planAskMessage, planResultMessage, shareMessage, consultMessage } from "./tools.mjs";
import { recordEntry, adminCommand } from "./lottery.mjs";
import { statsBatch } from "./stats.mjs";
import { buildReport } from "./report.mjs";
import { softStore } from "./store.mjs";

const text = (t) => ({ type: "text", text: t });
/** あいさつ文のA/Bテスト用。ユーザーIDから、いつも同じ側（a/b）に決まる（保存不要） */
export function variantOf(userId = "") {
  let h = 2166136261;
  for (const ch of String(userId)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  return h % 2 === 0 ? "a" : "b";
}
const PRESETS = [[/看護/, { j: "med", s: "nurse" }], [/介護/, { j: "med", s: "care" }], [/薬剤/, { j: "med", s: "pharm" }], [/保育/, { j: "med", s: "child" }], [/エンジニア|\bit\b/i, { j: "it" }], [/コンサル/, { j: "consul" }], [/m[&＆]a|エムアンドエー/i, { j: "ma" }], [/営業/, { j: "sales", s: "bizsales" }], [/製造|工場/, { j: "tech", s: "mfg" }]];
const TAG_RE = /【([A-Za-z0-9_-]{1,24})】/;
/** 流入経路つきの入口から診断を始める（職種が分かれば、その質問を飛ばす） */
async function startFromTag(ctx, userId, tag, raw) {
  const { store, base, stats } = ctx;
  stats.addTag(tag, "start");
  if (store && userId && !(await store.get(`u:${userId}`))) await store.put(`u:${userId}`, { tag }, 60 * 24 * 3600);
  stats.add("start");
  stats.add(`start_${variantOf(userId)}`);
  const preset = PRESETS.find(([re]) => re.test(raw))?.[1] ?? {};
  return [text("ご相談ありがとうございます。30秒診断を始めます。"), nextQuestion(preset, base)];
}
async function sourceOf(store, userId) { return store && userId ? (await store.get(`u:${userId}`))?.tag : undefined; }
const norm = (s) => s.normalize("NFKC").toLowerCase().replace(/\s+/g, "");

/** キーワード → 動作。上から順に判定する */
const KEYWORDS = [
  [/手取り|月収|手取/, "net"],
  [/管理人|直接相談|個別相談|チャット相談/, "contact"],
  [/スケジュール|いつまで|逆算/, "plan"],
  [/選考ポイント|見られる|聞くこと|確認すること|面談で聞|面接で聞|質問例|ポイント5つ/, "tips"],
  [/診断結果|^結果|結果を(見|み)|結果.*(もう一度|再度)/, "myres"],
  [/新着|note.*(配信|通知)|(配信|通知).*note/, "subon"],
  [/面談準備|準備シート|面接/, "prep"],
  [/シェア|紹介する|友だちに|友達に|教える/, "share"],
  [/コンサル/, "st-consul"],
  [/m&a|エムアンドエー/, "st-ma"],
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
    case "st-consul": return { messages: [text("コンサル転職のご相談ですね。ハイクラス向けの専門サービスを中心に、あなたに合うところをご案内します。"), nextQuestion({ j: "consul" }, base)], evt: "start" };
    case "st-ma": return { messages: [text("M&A業界へのご相談ですね。M&A・FAS領域に強いサービスを中心に、あなたに合うところをご案内します。"), nextQuestion({ j: "ma" }, base)], evt: "start" };
    case "d": {
      const key = nextKey(a);
      if (key) return { messages: [questionMessage(key, a, base)] };
      const res = decide(a);
      if (res.status === "need_area") return { messages: [questionMessage("r", a, base)] };
      return { messages: resultMessages(a, base), alt: resultFallbackMessages(a), evt: "done", record: a, key: res.key, picks: res.picks.map((p) => p.service.id) };
    }
    case "b": return { messages: [nextQuestion(a, base) ?? questionMessage("j", {}, base)] };
    case "rs": {
      const res = decide(a);
      return { messages: res.status === "ok" ? resultMessages(a, base) : [questionMessage("r", a, base)], alt: res.status === "ok" ? resultFallbackMessages(a) : undefined };
    }
    case "sal": return { messages: [a.i && a.i !== "ix" ? salaryResultMessage(a.i, base) : salaryAskMessage(base)] };
    case "camp": return { messages: [campaignMessage(base)] };
    case "steps": return { messages: [stepsMessage(base)] };
    case "faq": return { messages: [arg ? faqAnswerMessage(arg) : faqMenuMessage()] };
    case "know": return { messages: [knowledgeMessage(base)] };
    case "taiken": return { messages: [taikenMessage(base)] };
    case "tips": return { messages: tipsFlow(arg, base) };
    case "about": return { messages: [aboutMessage(base)] };
    case "policy": return { messages: [policyMessage(base)] };
    case "privacy": return { messages: [privacyMessage(base)] };
    case "contact": return { messages: [consultMessage(base)] };
    case "net": return { messages: [a.i && a.i !== "ix" ? netResultMessage(a.i, base) : netAskMessage(base)] };
    case "plan": return { messages: [a.t ? planResultMessage(a.t) : planAskMessage()] };
    case "prep": return { messages: [prepSheetMessage(base)] };
    case "share": return { messages: [shareMessage()] };
    case "home": return { messages: [homeMessage(base)] };
    // 古いボタンなど、未知の動作は「メッセージを受け取りました」ではなく、メニューを返す
    default: return { messages: [homeMessage(base)] };
  }
}

/** KVなど非同期の処理が要る動作。それ以外は route に任せる */
async function routeAsync(action, arg, ctx, userId) {
  const { base, store } = ctx;
  switch (action) {
    case "myres": {
      const rec = userId && store ? await store.get(`d:${userId}`) : null;
      if (rec?.state) {
        const a = decode(rec.state);
        const res = decide(a);
        if (res.status === "ok") return { messages: resultMessages(a, base), alt: resultFallbackMessages(a), evt: "myres" };
        return { messages: [questionMessage("r", a, base)] };
      }
      return { messages: [text(`診断の記録が見つかりませんでした（診断から${brand.followup.retentionDays}日たつと、保存した内容は削除されます）。\nもう一度、30秒診断をどうぞ。`), questionMessage("j", {}, base)], evt: "start" };
    }
    case "taiken": return { messages: [taikenMessage(base, await latestNotes(ctx.env))], evt: "taiken" };
    case "tips": return { messages: tipsFlow(arg, base), evt: arg.includes(".") ? "tips" : "tips_pick" };
    case "regy": case "regm": case "regl": return { messages: regMessages(action.slice(3), arg), evt: `reg_${action.slice(3)}` };
    case "subon": {
      if (!arg) return { messages: [tipsPickerMessage("sub")] };
      if (arg !== "all" && !hasTips(arg)) return { messages: [tipsPickerMessage("sub")] };
      if (!store || !userId) return { messages: [text("ただいま、新着noteの配信をご利用いただけません。noteは、プロフィールからご覧いただけます。")] };
      const rec = subRecord(arg === "all" ? "" : arg, ctx.now ?? Date.now());
      await store.put(`sub:${userId}`, rec.value, 180 * 24 * 3600, rec.meta);
      return { messages: subOnMessage(arg), evt: "sub_on" };
    }
    default: return route(action, arg, ctx);
  }
}

async function safeReply(ctx, replyToken, messages, alt) {
  if (!replyToken) return;
  try {
    await ctx.client.reply(replyToken, messages);
    console.log(JSON.stringify({ evt: "reply_ok", n: messages.length }));
  } catch (e) {
    console.log(JSON.stringify({ evt: "reply_error", status: e.status, body: JSON.stringify(e.body ?? String(e)).slice(0, 300) }));
    // 返信トークンが無効（使用済み・期限切れ）なら、二重送信になるので何もしない
    if (e.status !== 400 || /reply token/i.test(JSON.stringify(e.body ?? ""))) return;
    // 表示（Flex）に失敗した場合は、文字だけの版（紹介リンク入り）で確実に届ける
    for (const fb of [alt, [text("申し訳ありません、表示に失敗しました。「診断」と送ると、もう一度やり直せます。")]]) {
      if (!fb) continue;
      try { await ctx.client.reply(replyToken, fb); console.log(JSON.stringify({ evt: "reply_fallback_ok" })); return; } catch { /* 次へ */ }
    }
  }
}

/** 自由入力のメッセージ（相談）が届いたことを運営者に通知（同じ人からは6時間に1回まで） */
async function notifyAdmin(ctx, userId, raw) {
  const { env, client, store } = ctx;
  if (!env.ADMIN_USER_ID || userId === env.ADMIN_USER_ID) return;
  try {
    if (store) {
      const k = `n:${userId}`;
      if (await store.get(k)) return;
      await store.put(k, { t: 1 }, 6 * 3600);
    }
    await client.push(env.ADMIN_USER_ID, [text(`💬 新しいメッセージが届きました。\n「${raw.slice(0, 60)}」\nトークをご確認ください。`)]);
  } catch { /* 通知は任意 */ }
}

export async function handleEvent(event, rawCtx) {
  const now = rawCtx.now ?? Date.now();
  // 保存（KV）が一時的に失敗しても、返信は必ず送る。集計は1イベント1回の書き込みにまとめる
  const store = softStore(rawCtx.store);
  const stats = statsBatch(store, now);
  const ctx = { ...rawCtx, store, stats };
  try {
    return await dispatch(event, ctx, rawCtx);
  } catch (e) {
    console.log(JSON.stringify({ evt: "dispatch_error", type: event?.type, msg: String(e).slice(0, 200) }));
    if (event?.replyToken) await safeReply(ctx, event.replyToken, [text("申し訳ありません、うまく処理できませんでした。「診断」と送ると、もう一度はじめからできます。")]);
  } finally {
    await stats.flush();
  }
}

async function dispatch(event, ctx, rawCtx) {
  const { client, store, env, stats, now = Date.now() } = ctx;
  const userId = event.source?.userId;

  switch (event.type) {
    case "follow": {
      let name;
      try { name = (await client.profile(userId)).displayName; } catch { /* 取得できなくてもOK */ }
      const variant = variantOf(userId);
      stats.add("follow");
      stats.add(`follow_${variant}`);
      return safeReply(ctx, event.replyToken, welcomeMessages(ctx.base, name, { returning: event.follow?.isUnblocked === true, variant }));
    }
    case "unfollow":
      return stopAll(store, userId);
    case "postback": {
      // リッチメニューのタブ切り替え（data=「tab=…」）は、画面が切り替わるだけ。返信は不要
      if (/^tab=/.test(event.postback?.data ?? "")) return null;
      const { action, arg } = parseData(event.postback?.data);
      let r;
      try { r = await routeAsync(action, arg, ctx, userId); } catch (e) {
        console.log(JSON.stringify({ evt: "route_error", action, msg: String(e).slice(0, 200) }));
        r = { messages: fallbackMessages(ctx.base) };
      }
      // 先に返信（診断結果・紹介リンクを確実に届ける）。集計・保存はそのあと
      await safeReply(ctx, event.replyToken, r.messages, r.alt);
      if (r.evt) { stats.add(r.evt); if (["start", "done"].includes(r.evt)) stats.add(`${r.evt}_${variantOf(userId)}`); }
      if (r.record) {
        stats.add(`job_${r.key}`);
        stats.addTag(await sourceOf(store, userId), "done");
        await recordDiagnosis(store, userId, r.record, now);
        console.log(JSON.stringify({ evt: "diag_done", key: r.key, picks: r.picks, priority: r.record.p }));
      }
      return;
    }
    case "message": {
      const m = event.message ?? {};
      if (m.type === "image") {
        await safeReply(ctx, event.replyToken, receiptMessages(ctx.base));
        stats.add("shot");
        stats.add(`shot_${variantOf(userId)}`);
        await recordEntry(store, userId, now);
        stats.addTag(await sourceOf(store, userId), "shot");
        await stopFollowup(store, userId); // 応募済みの方へのフォローは停止
        if (env.ADMIN_USER_ID) {
          try { await client.push(env.ADMIN_USER_ID, [text("📥 キャンペーンのスクショが届きました。トークをご確認ください。")]); } catch { /* 通知は任意 */ }
        }
        return;
      }
      if (m.type !== "text" || typeof m.text !== "string") return safeReply(ctx, event.replyToken, fallbackMessages(ctx.base));

      const raw = m.text.trim();
      const t = norm(raw);
      const isAdmin = Boolean(env.ADMIN_USER_ID && userId === env.ADMIN_USER_ID);
      if (isAdmin && /^(統計|stats)(30)?$/.test(t)) {
        return safeReply(ctx, event.replyToken, [text(await buildReport(rawCtx.store, t.endsWith("30") ? 30 : 7, now, { env }).catch((e) => `集計を読み込めませんでした：${String(e).slice(0, 80)}`))]);
      }
      if (isAdmin && /^経路(リンク)?$/.test(t)) {
        return safeReply(ctx, event.replyToken, [text(`流入経路つきのリンク\n${ctx.base}/l/経路名\n職種つき：${ctx.base}/l/経路名?job=nurse\n（job：nurse / care / pharm / child / it / sales / mfg）\n\n例）noteの記事1 → ${ctx.base}/l/note1\n例）Threadsのプロフィール → ${ctx.base}/l/threads\n※経路名は英数字・ハイフン・アンダースコア（24字まで）`)]);
      }
      if (isAdmin) {
        let out = null;
        try { out = await adminCommand(t, { store: rawCtx.store, client, now }); } catch (e) { out = `運営者コマンドでエラーが起きました：${String(e).slice(0, 120)}\n（Cloudflare KVの上限やエラーの可能性があります）`; }
        if (out) return safeReply(ctx, event.replyToken, [text(out)]);
      }
      const tagMatch = raw.match(TAG_RE);
      if (tagMatch) return safeReply(ctx, event.replyToken, await startFromTag(ctx, userId, tagMatch[1], raw));
      if (t === norm(brand.followup.stopKeyword)) {
        await stopAll(store, userId);
        return safeReply(ctx, event.replyToken, [text("フォローのメッセージや、新着noteの配信を停止し、保存していた情報を削除しました。\nまた診断したくなったら、いつでもメニューからどうぞ。")]);
      }
      const hit = KEYWORDS.find(([re]) => re.test(t));
      if (!hit) {
        await notifyAdmin(ctx, userId, raw);
        return safeReply(ctx, event.replyToken, fallbackMessages(ctx.base));
      }
      let r;
      try { r = await routeAsync(hit[1], "", ctx, userId); } catch (e) {
        console.log(JSON.stringify({ evt: "route_error", action: hit[1], msg: String(e).slice(0, 200) }));
        r = { messages: fallbackMessages(ctx.base) };
      }
      if (r.evt) { stats.add(r.evt); if (["start", "done"].includes(r.evt)) stats.add(`${r.evt}_${variantOf(userId)}`); }
      return safeReply(ctx, event.replyToken, r.messages);
    }
    default:
      return null;
  }
}
