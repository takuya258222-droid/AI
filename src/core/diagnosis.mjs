// 30秒診断：質問カード・年収診断・診断結果メッセージの組み立て
import {
  JOBS, SUBS, AGES, INCOMES, INCOME_UNKNOWN, INCOME_AVERAGE_NOTE, INCOME_SOURCE, PRIORITIES, TIMINGS, AREAS,
  jobShort, ageLabel, incomeLabel, priorityLabel, timingLabel, areaLabel,
} from "./labels.mjs";
import { decide, reasonFor } from "./matcher.mjs";
import { encode, makeData, nextKey, stepNumber, previous } from "./state.mjs";
import { brand, notes, getNote } from "./content.mjs";
import {
  C, text, box, sep, spacer, uri, postback, cta, ghost, linkBtn, eyebrow, badge, checkRow, dotRow, stepRow, kv, panel,
  bubble, heroImage, bodyBox, footerBox, flexMessage, carousel, progress, histogram, imgUrl, quickReply,
} from "./flex.mjs";
import { entryCard } from "./messages.mjs";

// ------------------------------------------------------------------ 質問カード
const QUESTIONS = {
  j: { title: "現在のお仕事は？", hint: "近いものをタップしてください", options: () => JOBS, cols: 2 },
  s: { title: (a) => SUBS[a.j].title, hint: "タップするだけで進みます", options: (a) => SUBS[a.j].options, cols: 1 },
  g: { title: "年代を教えてください", hint: "タップするだけで進みます", options: () => AGES, cols: 2 },
  i: {
    title: "現在の年収は？（額面・賞与込み）",
    hint: "目安でOK。診断結果で、年収ポジションもご確認いただけます",
    options: () => [...INCOMES, INCOME_UNKNOWN],
    cols: 2,
  },
  p: { title: "転職で、いちばん大切にしたいことは？", hint: "1つだけ選んでください", options: () => PRIORITIES, cols: 1 },
  t: { title: "転職の進み具合は？", hint: "いまの状況に近いものをタップ", options: () => TIMINGS, cols: 1 },
  r: {
    title: "お住まい（勤務希望）のエリアは？",
    hint: "あと1問だけ。エリアが限られるサービスを、正しくご案内するために伺います",
    options: () => AREAS,
    cols: 1,
  },
};

function optionBox(label, action, o = {}) {
  return box("vertical", [text(label, { align: "center", weight: "bold", color: C.navy, size: o.size ?? "sm", gravity: "center" })], {
    flex: 1,
    paddingTop: "13px",
    paddingBottom: "13px",
    paddingStart: "8px",
    paddingEnd: "8px",
    cornerRadius: "10px",
    borderWidth: "1px",
    borderColor: C.border,
    backgroundColor: C.paper,
    justifyContent: "center",
    action,
  });
}

function optionGrid(items, cols) {
  const rows = [];
  if (cols === 1) {
    for (const it of items) rows.push(box("horizontal", [optionBox(it.label, it.action)], { margin: "sm" }));
  } else {
    for (let i = 0; i < items.length; i += 2) {
      const pair = items.slice(i, i + 2);
      // 長い選択肢（末尾の「答えたくない」など）は1行を占有
      if (pair.length === 1 || pair.some((p) => p.label.length > 9)) {
        for (const p of pair) rows.push(box("horizontal", [optionBox(p.label, p.action)], { margin: "sm" }));
        continue;
      }
      rows.push(box("horizontal", pair.map((p) => optionBox(p.label, p.action)), { margin: "sm", spacing: "sm" }));
    }
  }
  return rows;
}

/** 質問カード（Flex）を作る */
export function questionMessage(key, a, base) {
  const q = QUESTIONS[key];
  const title = typeof q.title === "function" ? q.title(a) : q.title;
  const step = stepNumber(key);
  const items = q.options(a).map((o) => ({
    label: o.label,
    action: postback(o.label, makeData("d", { ...a, [key]: o.v }), o.label),
  }));

  const head = [
    box("horizontal", [
      text(key === "r" ? "ADDITIONAL" : `STEP ${step} / 5`, { size: "xxs", weight: "bold", color: C.goldDeep, flex: 1 }),
      text("30秒転職診断", { size: "xxs", color: C.muted, align: "end", flex: 1 }),
    ]),
    progress(key === "r" ? 5 : step),
    text(title, { size: "lg", weight: "bold", color: C.navy, margin: "lg" }),
    text(q.hint, { size: "xs", color: C.muted, margin: "sm" }),
  ];
  if (key === "j" && !Object.keys(a).length) head.push(text("所要時間は約30秒。入力は不要です。", { size: "xs", color: C.goldDeep, margin: "sm", weight: "bold" }));

  const footerLinks = [];
  if (Object.keys(a).length) footerLinks.push(linkBtn("◀ 前に戻る", postback("前に戻る", makeData("b", previous(a)), "前に戻る")));
  footerLinks.push(linkBtn("最初からやり直す", postback("やり直す", "st", "最初からやり直す")));

  const b = bubble({
    body: bodyBox([...head, spacer("sm"), ...optionGrid(items, q.cols)]),
    footer: footerBox([box("horizontal", footerLinks, { spacing: "sm", justifyContent: "center" })], { paddingTop: "0px", paddingBottom: "8px" }),
  });
  return flexMessage(`Q. ${title}`, b);
}

/** 現在の state から次の質問（なければ null） */
export function nextQuestion(a, base) {
  const key = nextKey(a);
  return key ? questionMessage(key, a, base) : null;
}

// ------------------------------------------------------------------ 年収ポジション
export function salaryContents(iv) {
  const cur = INCOMES.find((x) => x.v === iv);
  const bars = INCOMES.map((x) => ({ label: x.label.replace("万円", "").replace("〜", "〜"), pct: x.pct, active: x.v === iv }));
  const maxPct = Math.max(...INCOMES.map((x) => x.pct));
  return [
    eyebrow("SALARY POSITION"),
    text("あなたの年収ポジション", { size: "md", weight: "bold", color: C.navy, margin: "sm" }),
    text(`現在の年収：${cur.label}`, { size: "sm", margin: "sm" }),
    histogram(bars, maxPct),
    text(cur.position, { size: "sm", weight: "bold", color: C.navy, margin: "md" }),
    text(INCOME_AVERAGE_NOTE, { size: "xs", color: C.muted, margin: "sm" }),
    text(INCOME_SOURCE, { size: "xxs", color: C.muted, margin: "sm" }),
    text("※パート・アルバイトを含む給与所得者全体の統計です。年代・職種・企業規模・働き方で水準は大きく異なるため、参考値としてご覧ください。", { size: "xxs", color: C.muted, margin: "xs" }),
  ];
}

/** 年収診断（単体）: 質問 */
export function salaryAskMessage(base) {
  const items = [...INCOMES, INCOME_UNKNOWN].filter((x) => x.v !== "ix").map((o) => ({ label: o.label, action: postback(o.label, `sal|i:${o.v}`, o.label) }));
  const b = bubble({
    hero: heroImage(imgUrl(base, "salary.jpg")),
    body: bodyBox([
      eyebrow("SALARY CHECK"),
      text("年収ポジション診断", { size: "lg", weight: "bold", color: C.navy, margin: "sm" }),
      text("現在の年収（額面・賞与込み）をタップしてください。国税庁の公的データと比べた、あなたの立ち位置をお見せします。", { size: "xs", color: C.muted, margin: "sm" }),
      spacer("sm"),
      ...optionGrid(items, 2),
    ]),
  });
  return flexMessage("年収ポジション診断：現在の年収を選んでください", b);
}

/** 年収診断（単体）: 結果 */
export function salaryResultMessage(iv, base) {
  const b = bubble({
    hero: heroImage(imgUrl(base, "salary.jpg")),
    body: bodyBox([
      ...salaryContents(iv),
      sep("lg"),
      text("年収を上げたいときの考え方", { size: "sm", weight: "bold", color: C.navy, margin: "lg" }),
      checkRow("今より上のレンジの求人を扱うサービスも含めて、2〜3社で比べる", { size: "xs" }),
      checkRow("面談では、現年収と希望年収の「根拠（実績）」をセットで伝える", { size: "xs" }),
      checkRow("額面だけでなく、賞与・手当・残業代込みで比べる", { size: "xs" }),
    ]),
    footer: footerBox([
      cta("30秒診断をはじめる", postback("30秒診断をはじめる", "st", "30秒診断をはじめる")),
      linkBtn("キャンペーン詳細を見る", postback("キャンペーン", "camp", "キャンペーン詳細")),
    ]),
  });
  return flexMessage("年収ポジション診断の結果", b);
}

// ------------------------------------------------------------------ 診断結果
const ROLE_LABEL = {
  best: ["いちばんのおすすめ", C.gold],
  also: ["あわせておすすめ", C.gold],
  explore: ["まず相談したい方へ", C.gold],
  challenge: ["挑戦したい方へ", C.gold],
};

function serviceBubble(pick, a, base) {
  const s = pick.service;
  const [roleLabel] = ROLE_LABEL[pick.role] ?? ROLE_LABEL.also;
  const body = [
    badge(roleLabel, { color: pick.role === "best" ? C.navy : C.gold, bg: pick.role === "best" ? C.gold : C.navy }),
    text(s.name, { size: "xl", weight: "bold", color: C.navy, margin: "md" }),
    text(s.tagline, { size: "xs", color: C.muted, margin: "xs" }),
    sep("lg"),
    eyebrow("こんな人におすすめ"),
    text(s.forWho, { size: "sm", margin: "sm" }),
    box("vertical", [eyebrow("特徴")], { margin: "lg" }),
    ...s.features.map((f) => checkRow(f, { size: "sm" })),
    box("vertical", [eyebrow("あなたに合う理由"), text(reasonFor(pick, a), { size: "sm", margin: "sm" })], {
      margin: "lg",
      backgroundColor: C.ivory,
      cornerRadius: "10px",
      paddingAll: "12px",
    }),
    text(s.eligibility, { size: "xxs", color: C.muted, margin: "md" }),
    ...(s.note ? [text(`※${s.note}`, { size: "xxs", color: "#8A5A2B", margin: "xs" })] : []),
  ].filter(Boolean);

  return bubble({
    hero: heroImage(imgUrl(base, `${s.category}.jpg`)),
    body: bodyBox(body),
    footer: footerBox([
      cta(s.cta ?? "無料で求人を見てみる", uri("無料で求人を見てみる", s.url)),
      linkBtn("登録後の流れ・キャンペーン", postback("登録後の流れ", "steps", "登録後の流れ")),
      text("PR｜紹介リンク経由の登録で、当アカウントが報酬を受け取る場合があります", { size: "xxs", color: C.muted, align: "center", margin: "sm" }),
    ]),
  });
}

function menuBubble() {
  return bubble({
    body: bodyBox(
      [
        eyebrow("NEXT ACTION"),
        text("ほかにも、こんなことができます", { size: "md", weight: "bold", color: C.navy, margin: "sm" }),
        text("診断のやり直しや、年収・体験記のチェックはこちらから。", { size: "xs", color: C.muted, margin: "sm" }),
        spacer("lg"),
        ghost("診断をやり直す", postback("診断をやり直す", "st", "診断をやり直す")),
        spacer("sm"),
        ghost("年収ポジション診断", postback("年収診断", "sal", "年収診断")),
        spacer("sm"),
        ghost("転職体験記を読む", postback("転職体験記", "taiken", "転職体験記")),
        spacer("sm"),
        ghost("管理人に直接相談", postback("管理人に相談", "contact", "管理人に相談")),
        spacer("sm"),
        ghost("友だちにも教える", postback("シェア", "share", "友だちにシェア")),
      ],
      { justifyContent: "center" }
    ),
  });
}

function summaryBubble(a, res, base) {
  const rows = [
    kv("職種", jobShort(a)),
    kv("年代", ageLabel(a.g)),
    kv("現在の年収", incomeLabel(a.i)),
    kv("重視すること", priorityLabel(a.p)),
    kv("進み具合", timingLabel(a.t)),
    ...(a.r ? [kv("エリア", areaLabel(a.r).replace(/（.*）/, ""))] : []),
  ];
  const body = [
    eyebrow("DIAGNOSIS RESULT"),
    text("あなたの診断結果", { size: "xl", weight: "bold", color: C.navy, margin: "sm" }),
    text("ご回答内容から、次の条件でサービスを選定しました。", { size: "xs", color: C.muted, margin: "sm" }),
    box("vertical", rows, { margin: "md" }),
  ];
  if (a.i && a.i !== "ix") body.push(sep("lg"), box("vertical", salaryContents(a.i), { margin: "lg" }));
  if (res.notes.length) body.push(panel(res.notes.map((n) => text(n, { size: "xs", color: C.ink })), { margin: "lg", border: true }));
  return bubble({
    hero: heroImage(imgUrl(base, "result.jpg")),
    body: bodyBox(body),
    footer: footerBox([text("▼ 次に、あなたに合うサービスをご案内します", { size: "xs", color: C.goldDeep, align: "center", weight: "bold" })], { paddingTop: "0px" }),
  });
}

// ---- 職種に近い体験記・解説 ----
function relatedNoteIds(a, key) {
  const ids = [...(notes.related[key] ?? [])];
  if (a.p === "haken") ids.unshift(...notes.relatedHaken);
  if (!ids.length) {
    ids.push(...(["a20", "a25"].includes(a.g) ? notes.relatedYoung : []), ...notes.relatedDefault);
  }
  return [...new Set(ids)].slice(0, 2);
}

export function noteBubble(n, base) {
  return bubble({
    hero: heroImage(imgUrl(base, `notes/${n.id}.jpg`), "1.91:1"),
    body: bodyBox([eyebrow(n.label), text(n.headline, { size: "sm", weight: "bold", color: C.navy, margin: "sm", maxLines: 4 })], { paddingAll: "16px" }),
    footer: footerBox([ghost("noteで読む", uri("noteで読む", n.url), { size: "xs", padding: "9px" })]),
  });
}

function relatedNotesMessage(a, key, base) {
  const list = relatedNoteIds(a, key).map(getNote).filter(Boolean);
  if (!list.length) return null;
  const intro = bubble({
    body: bodyBox(
      [
        eyebrow("REAL STORIES"),
        text("同じ職種の人は、実際どう動いた？", { size: "lg", weight: "bold", color: C.navy, margin: "sm" }),
        text("動機・選考・年収・後悔まで書いた、体験記と解説です。登録前の判断材料にどうぞ。", { size: "xs", color: C.muted, margin: "md" }),
        spacer("lg"),
        cta("体験記マガジンを読む", uri("マガジンを読む", brand.note.magazineUrl), { size: "sm", padding: "12px" }),
      ],
      { justifyContent: "center" }
    ),
  });
  return flexMessage("同じ職種の人の転職体験記・解説", carousel([intro, ...list.map((n) => noteBubble(n, base))]));
}

/**
 * 診断結果メッセージ一式を作る。
 * @returns {object[]} LINEに返信するメッセージ配列（最大5件）／エリア追加質問が必要なら質問カード1件
 */
export function resultMessages(a, base) {
  const res = decide(a);
  if (res.status === "need_area") return [questionMessage("r", a, base)];

  const cards = res.picks.map((p) => serviceBubble(p, a, base));
  cards.push(menuBubble());
  // 並び：診断結果 → 同じ職種の体験記 → 登録案内 → 紹介リンクのカード（最後）
  const msgs = [flexMessage("診断結果：あなたに合う転職サービスはこちら", summaryBubble(a, res, base))];
  const rel = relatedNotesMessage(a, res.key, base);
  if (rel) msgs.push(rel);
  msgs.push(entryCard(a, base));
  msgs.push(flexMessage("あなたに合う転職サービスはこちら（" + res.picks.map((p) => p.service.name).join("／") + "）", carousel(cards)));
  // 最後の吹き出し（紹介リンク）の下に、次の行動へのショートカットを表示
  msgs[msgs.length - 1].quickReply = quickReply([
    ["キャンペーン詳細", "camp", "キャンペーン詳細"],
    ["年収診断", "sal", "年収診断"],
    ["転職体験記", "taiken", "転職体験記"],
    ["診断をやり直す", "st", "診断をやり直す"],
  ]);
  return msgs;
}

/**
 * Flexの表示に失敗したとき用の、文字だけの診断結果（紹介リンク入り）。
 * 診断結果とリンクは、どんな不具合があっても届くようにするための保険。
 */
export function resultFallbackMessages(a) {
  const res = decide(a);
  if (res.status !== "ok" || !res.picks.length) return null;
  const lines = ["診断結果：あなたに合うサービスはこちらです。", ""];
  res.picks.forEach((p, i) => {
    lines.push(`${i + 1}. ${p.service.name}`, p.service.tagline, p.service.url, "");
  });
  lines.push("PR｜紹介リンク経由の登録で、当アカウントが報酬を受け取る場合があります。", "登録後は、完了画面のスクショをこのトークに送ってください。");
  return [{ type: "text", text: lines.join("\n") }];
}

export { encode };
