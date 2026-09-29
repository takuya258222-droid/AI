// 職種別「面談で確認したい5つ／選考で見られやすいポイント5つ」のミニツール
import { tips } from "./content.mjs";
import { AGES } from "./labels.mjs";
import { decide } from "./matcher.mjs";
import {
  C, text, box, sep, spacer, uri, postback, cta, ghost, linkBtn, eyebrow, badge, stepRow, panel, bubble, heroImage, bodyBox, footerBox,
  flexMessage, carousel, quickReply, imgUrl, buttonCard,
} from "./flex.mjs";

export const TIP_KEYS = Object.keys(tips.jobs);
export const hasTips = (key) => Object.prototype.hasOwnProperty.call(tips.jobs, key);
export const hasAge = (g) => AGES.some((x) => x.v === g);

/** 面談・選考ポイントの職種キー → 診断の回答（職種）。keyOf(TIP_STATE[key]) === key になる */
export const TIP_STATE = {
  nurse: { j: "med", s: "nurse" }, care: { j: "med", s: "care" }, pharm: { j: "med", s: "pharm" }, child: { j: "med", s: "child" }, medother: { j: "med", s: "medother" },
  dis: { j: "other", s: "dis" }, it_none: { j: "it", s: "it_none" }, it_jr: { j: "it", s: "it_jr" }, it_sr: { j: "it", s: "it_sr" }, it_free: { j: "it", s: "it_free" },
  consul: { j: "consul" }, ma: { j: "ma" }, bizsales: { j: "sales", s: "bizsales" }, retail: { j: "sales", s: "retail" }, office: { j: "office" },
  mfg: { j: "tech", s: "mfg" }, eng: { j: "tech", s: "eng" }, const: { j: "const" }, logi: { j: "logi" }, gen: { j: "other", s: "gen" },
};

/** 年代ごとの、選考で見られやすい傾向（一般的な傾向） */
const AGE_NOTE = {
  a20: "20代前半は、経験の量よりも、素直さ・学ぶ姿勢・続ける意欲が見られやすい年代です。「なぜこの仕事か」を、自分の言葉で話せるように準備しましょう。",
  a25: "20代後半は、これまでの実績と、それを次の職場でも再現できるかが見られやすい年代です。数字や具体例を用意しておきましょう。",
  a30: "30代前半は、即戦力としての専門性と、任された範囲の広さ（後輩の指導・チームのリード経験など）が見られやすい年代です。",
  a35: "35歳以上は、専門性の深さと、マネジメント・調整の経験、希望する年収・役割と経験との整合が見られやすい年代です。",
};

/** 診断の回答（state文字列）から、面談・選考ポイントを開くボタンのデータ（職種・年代つき） */
export function tipsData(key, age) {
  if (!hasTips(key)) return "tips";
  return hasAge(age) ? `tips|${key}.${age}` : `tips|${key}`;
}

const pickBox = (label, data) =>
  box("vertical", [text(label, { align: "center", weight: "bold", color: C.navy, size: "sm", gravity: "center" })], {
    flex: 1, paddingTop: "12px", paddingBottom: "12px", paddingStart: "6px", paddingEnd: "6px", cornerRadius: "10px",
    borderWidth: "1px", borderColor: C.border, backgroundColor: C.paper, justifyContent: "center",
    action: postback(label, data, label),
  });

/** 職種の選択画面（mode: "tips"=面談・選考のポイント／"sub"=新着note配信の登録） */
export function tipsPickerMessage(mode = "tips") {
  const prefix = mode === "sub" ? "subon" : "tips";
  const items = TIP_KEYS.map((k) => ({ label: tips.jobs[k].label, data: `${prefix}|${k}` }));
  if (mode === "sub") items.push({ label: "すべての新着", data: "subon|all" });
  const rows = [];
  for (let i = 0; i < items.length; i += 2) {
    const pair = items.slice(i, i + 2);
    // 長い名前は1行を使う
    if (pair.length === 1 || pair.some((p) => [...p.label].length > 9)) {
      for (const p of pair) rows.push(box("horizontal", [pickBox(p.label, p.data)], { margin: "sm" }));
    } else rows.push(box("horizontal", pair.map((p) => pickBox(p.label, p.data)), { margin: "sm", spacing: "sm" }));
  }
  const b = bubble({
    body: bodyBox([
      eyebrow(mode === "sub" ? "NOTE" : "CHECK POINTS"),
      text(mode === "sub" ? "新着noteの配信" : "職種別：面談・選考のポイント", { size: "lg", weight: "bold", color: C.navy, margin: "sm" }),
      text(mode === "sub"
        ? "読みたい職種をタップすると、その職種の新着noteだけを、週1回お届けします（新着があるときだけ）。止めるときは「配信停止」と送信してください。"
        : "近い職種をタップすると、面談で確認したいことや、選考で見られやすいポイントを5つにまとめてお見せします。", { size: "xs", color: C.muted, margin: "sm" }),
      spacer("sm"),
      ...rows,
    ]),
  });
  return flexMessage(mode === "sub" ? "新着noteの配信：職種を選んでください" : "職種別：面談・選考のポイント（職種を選んでください）", b);
}

/** 年代の選択画面（職種を選んだあと） */
export function tipsAgePickerMessage(key) {
  const j = tips.jobs[key];
  if (!j) return tipsPickerMessage("tips");
  const rows = [];
  for (let i = 0; i < AGES.length; i += 2) rows.push(box("horizontal", AGES.slice(i, i + 2).map((a) => pickBox(a.label, `tips|${key}.${a.v}`)), { margin: "sm", spacing: "sm" }));
  const b = bubble({
    body: bodyBox([
      eyebrow("CHECK POINTS"),
      text(`${j.label}：年代を教えてください`, { size: "lg", weight: "bold", color: C.navy, margin: "sm" }),
      text("年代に合わせて、面談・選考のポイントと、その職種・年代の方に合うエージェントをご案内します。", { size: "xs", color: C.muted, margin: "sm" }),
      spacer("sm"),
      ...rows,
    ]),
    footer: footerBox([linkBtn("職種を選びなおす", postback("職種を選びなおす", "tips", "職種を選びなおす"))]),
  });
  return flexMessage(`${j.label}：年代を選んでください`, b);
}

/** 職種×年代の5つのポイント */
export function tipsMessage(key, age) {
  const j = tips.jobs[key];
  if (!j) return tipsPickerMessage("tips");
  const ageLabel = AGES.find((a) => a.v === age)?.label;
  const b = bubble({
    body: bodyBox([
      eyebrow("CHECK POINTS"),
      text(`${j.label}${ageLabel ? `（${ageLabel}）` : ""}：${j.title}`, { size: "lg", weight: "bold", color: C.navy, margin: "sm" }),
      sep("md"),
      ...j.points.map((p, i) => stepRow(i + 1, p)),
      ...(AGE_NOTE[age] ? [panel([text("この年代で意識したいこと", { size: "xs", weight: "bold", color: C.goldDeep }), text(AGE_NOTE[age], { size: "xs", margin: "xs" })], { margin: "lg" })] : []),
      text(tips.note, { size: "xxs", color: C.muted, margin: "lg" }),
    ]),
    footer: footerBox([text("▼ 次に、この職種・年代の方に合うエージェントをご案内します", { size: "xs", color: C.goldDeep, align: "center", weight: "bold" })], { paddingTop: "0px" }),
  });
  return flexMessage(`${j.label}${ageLabel ? `（${ageLabel}）` : ""}：${j.title}`, b);
}

const SUPPORT_RE = /面接|選考|書類|模擬|履歴|職務経歴|添削|対策/;

/** エージェントの1枚。選考サポートの記載があるサービスは、その内容を表示する（記載のないサービスには、書かない） */
function tipsAgentBubble(pick, base) {
  const sv = pick.service;
  const support = sv.features.find((f) => SUPPORT_RE.test(f));
  return bubble({
    hero: heroImage(imgUrl(base, `${sv.category}.jpg`)),
    body: bodyBox([
      badge(pick.role === "best" ? "いちばんのおすすめ" : "あわせておすすめ", { color: pick.role === "best" ? C.navy : C.gold, bg: pick.role === "best" ? C.gold : C.navy }),
      text(sv.name, { size: "xl", weight: "bold", color: C.navy, margin: "md" }),
      text(sv.tagline, { size: "xs", color: C.muted, margin: "xs" }),
      sep("lg"),
      eyebrow(support ? "選考のサポート" : "特徴"),
      text(support ?? sv.features[0], { size: "sm", margin: "sm" }),
      { ...eyebrow("こんな人におすすめ"), margin: "lg" },
      text(sv.forWho, { size: "sm", margin: "sm" }),
      text(sv.eligibility, { size: "xxs", color: C.muted, margin: "md" }),
    ]),
    footer: footerBox([
      cta(sv.cta ?? "無料で求人を見てみる", uri("無料で求人を見てみる", sv.url)),
      text("PR｜紹介リンク経由の登録で、当アカウントが報酬を受け取る場合があります", { size: "xxs", color: C.muted, align: "center", margin: "sm" }),
    ]),
  });
}

/** 職種×年代に合うエージェント（診断と同じ振り分けロジック。年収・重視項目は聞かないので、条件つきのサービスは出しません） */
export function tipsAgentsMessages(key, age, base) {
  const a = { ...TIP_STATE[key], g: age, i: "ix", p: "car", t: "m3", r: "other" };
  const res = decide(a);
  if (res.status !== "ok" || !res.picks.length) return [];
  const msgs = [];
  if (res.notes.length) msgs.push({ type: "text", text: res.notes.join("\n") });
  msgs.push(flexMessage(`この職種・年代に合うエージェント：${res.picks.map((p) => p.service.name).join("／")}`, carousel(res.picks.map((p) => tipsAgentBubble(p, base)))));
  // カルーセルの下に、押しやすい大きなボタン
  const next = buttonCard({
    eyebrowText: "NEXT STEP",
    title: "次は、どうしますか？",
    buttons: [
      ["🔎 30秒診断で、さらに絞り込む", postback("30秒診断をスタート", "st", "30秒診断をスタート"), "cta"],
      ["📋 別の職種・年代を見る", postback("別の職種・年代を見る", "tips", "別の職種・年代を見る"), "ghost"],
      ["📰 新着noteをLINEで受け取る", postback("新着noteを受け取る", `subon|${key}`, "新着noteを受け取る"), "ghost"],
    ],
    links: [["抽選キャンペーン", postback("キャンペーン詳細", "camp", "キャンペーン詳細")]],
  });
  next.quickReply = quickReply([["30秒診断で絞り込む", "st", "30秒診断をスタート"], ["別の職種・年代を見る", "tips", "別の職種・年代を見る"]]);
  msgs.push(next);
  return msgs;
}

/** 「tips|職種.年代」の返信一式。職種だけなら年代を聞き、何もなければ職種を聞く */
export function tipsFlow(arg, base) {
  const [key, age] = String(arg || "").split(".");
  if (!hasTips(key)) return [tipsPickerMessage("tips")];
  if (!hasAge(age)) return [tipsAgePickerMessage(key)];
  const agents = tipsAgentsMessages(key, age, base);
  const msgs = [tipsMessage(key, age), ...agents];
  return msgs.slice(0, 5);
}
