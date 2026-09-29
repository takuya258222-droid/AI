// 職種別「面談で確認したい5つ／選考で見られやすいポイント5つ」のミニツール
import { tips } from "./content.mjs";
import { C, text, box, sep, spacer, postback, cta, ghost, linkBtn, eyebrow, stepRow, bubble, bodyBox, footerBox, flexMessage } from "./flex.mjs";

export const TIP_KEYS = Object.keys(tips.jobs);
export const hasTips = (key) => Object.prototype.hasOwnProperty.call(tips.jobs, key);

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

/** 職種ごとの5つのポイント */
export function tipsMessage(key) {
  const j = tips.jobs[key];
  if (!j) return tipsPickerMessage();
  const b = bubble({
    body: bodyBox([
      eyebrow("CHECK POINTS"),
      text(`${j.label}：${j.title}`, { size: "lg", weight: "bold", color: C.navy, margin: "sm" }),
      sep("md"),
      ...j.points.map((p, i) => stepRow(i + 1, p)),
      text(tips.note, { size: "xxs", color: C.muted, margin: "lg" }),
    ]),
    footer: footerBox([
      cta("30秒診断でサービスを探す", postback("30秒診断をスタート", "st", "30秒診断をスタート")),
      linkBtn("新着noteをLINEで受け取る", postback("新着noteを受け取る", `subon|${key}`, "新着noteを受け取る")),
      linkBtn("ほかの職種を見る", postback("ほかの職種", "tips", "ほかの職種を見る")),
    ]),
  });
  return flexMessage(`${j.label}：${j.title}`, b);
}
