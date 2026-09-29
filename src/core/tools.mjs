// 便利ツール：手取り目安・面談準備シート・転職スケジュール逆算・友だちにシェア・管理人に相談
import { brand } from "./content.mjs";
import { INCOMES } from "./labels.mjs";
import {
  C, text, box, sep, spacer, uri, postback, cta, ghost, linkBtn, eyebrow, checkRow, dotRow, stepRow, panel,
  bubble, heroImage, bodyBox, footerBox, flexMessage, imgUrl, quickReply,
} from "./flex.mjs";

const START = () => postback("30秒診断をスタート", "st", "30秒診断をスタート");
const enc = encodeURIComponent;

/** 公式アカウントのトーク画面を、文面を入力済みの状態で開く（送信はユーザーが行う） */
export const prefilledChatUrl = (msg) => `https://line.me/R/oaMessage/${enc(brand.line.basicId)}/?${enc(msg)}`;
export const addFriendUrl = () => `https://line.me/R/ti/p/${enc(brand.line.basicId)}`;

const CONSULT_TEMPLATE = "【相談】\n職種：\n年代：\n現在の年収：\nお悩み・聞きたいこと：\n";
const PREP_TEMPLATE = "【面談準備の相談】\nこれまでの仕事内容・実績：\n転職を考えた理由：\n譲れない条件（3つまで）：\n";

// ------------------------------------------------------------------ 手取り・月収の目安
// 独身・扶養なし・賞与込みの年収ベースの概算（手取り率はおおむね75〜80%）
const NET = {
  i0: { gross: "月25万円以下", net: "約225〜240万円", monthly: "約19〜20万円" },
  i3: { gross: "月25〜33万円", net: "約240〜320万円", monthly: "約20〜27万円" },
  i4: { gross: "月33〜42万円", net: "約320〜395万円", monthly: "約27〜33万円" },
  i5: { gross: "月42〜58万円", net: "約395〜540万円", monthly: "約33〜45万円" },
  i7: { gross: "月58万円以上", net: "約540万円以上", monthly: "約45万円以上" },
};

export function netAskMessage(base) {
  const rows = INCOMES.map((o) =>
    box("horizontal", [
      box("vertical", [text(o.label, { align: "center", weight: "bold", color: C.navy })], {
        flex: 1, paddingTop: "13px", paddingBottom: "13px", cornerRadius: "10px", borderWidth: "1px", borderColor: C.border, backgroundColor: C.paper, justifyContent: "center",
        action: postback(o.label, `net|i:${o.v}`, o.label),
      }),
    ], { margin: "sm" })
  );
  const b = bubble({
    hero: heroImage(imgUrl(base, "salary.jpg")),
    body: bodyBox([
      eyebrow("TAKE-HOME CALCULATOR"),
      text("手取り・月収の目安", { size: "lg", weight: "bold", color: C.navy, margin: "sm" }),
      text("現在（または希望）の年収をタップすると、手取りの目安をお見せします。", { size: "xs", color: C.muted, margin: "sm" }),
      spacer("sm"),
      ...rows,
    ]),
  });
  return flexMessage("手取り・月収の目安：年収を選んでください", b);
}

export function netResultMessage(iv, base) {
  const cur = INCOMES.find((x) => x.v === iv);
  const n = NET[iv];
  const b = bubble({
    hero: heroImage(imgUrl(base, "salary.jpg")),
    body: bodyBox([
      eyebrow("TAKE-HOME ESTIMATE"),
      text(`年収 ${cur.label} の場合`, { size: "lg", weight: "bold", color: C.navy, margin: "sm" }),
      panel([
        text("手取り年収の目安", { size: "xs", color: C.muted }),
        text(n.net, { size: "xl", weight: "bold", color: C.navy, margin: "xs" }),
        text("手取り月額の目安（12等分）", { size: "xs", color: C.muted, margin: "md" }),
        text(n.monthly, { size: "lg", weight: "bold", color: C.navy, margin: "xs" }),
        text(`額面月収の目安：${n.gross}`, { size: "xxs", color: C.muted, margin: "md" }),
      ], { margin: "lg", border: true }),
      text("転職で年収が上がったとき", { size: "sm", weight: "bold", color: C.navy, margin: "lg" }),
      text("上がった分の手取りは、おおむね6〜7割です（税金・社会保険料も増えるため）。例：年収+50万円 → 手取り+30〜35万円ほど。", { size: "xs", margin: "sm" }),
      text("※独身・扶養なし・賞与込みの年収をもとにした概算です。お住まい・家族構成・保険の種類・控除で変わります。正確な金額は、給与明細・源泉徴収票でご確認ください。", { size: "xxs", color: C.muted, margin: "md" }),
    ]),
    footer: footerBox([cta("30秒診断をはじめる", START()), linkBtn("年収ポジションも見る", postback("年収診断", "sal", "年収診断"))]),
  });
  return flexMessage(`手取りの目安：年収${cur.label}`, b);
}

// ------------------------------------------------------------------ 面談準備シート
export function prepSheetMessage(base) {
  const item = (n, title, lines) => [
    stepRow(n, title),
    ...lines.map((l) => dotRow(l, { size: "xs" })),
  ];
  const b = bubble({
    body: bodyBox([
      eyebrow("INTERVIEW PREP"),
      text("面談準備シート", { size: "lg", weight: "bold", color: C.navy, margin: "sm" }),
      text("面談の前に、この3つをメモしておくと、話がスムーズに進みます。", { size: "xs", color: C.muted, margin: "sm" }),
      ...item(1, "これまでの仕事と実績", ["担当業務・期間・役割", "実績は、できるだけ数字で（件数・金額・人数・改善率）"]),
      ...item(2, "転職を考えた理由", ["不満だけでなく「こうなりたい」に言い換える", "例：残業が多い → 家族との時間を確保しながら成長したい"]),
      ...item(3, "譲れない条件（3つまで）", ["年収・勤務地・休日・働き方・仕事内容から、優先順に", "「あれば嬉しい条件」は分けて考える"]),
      sep("lg"),
      text("よく聞かれる質問", { size: "sm", weight: "bold", color: C.navy, margin: "lg" }),
      checkRow("なぜ転職を考えたのですか？", { size: "xs" }),
      checkRow("あなたの強みは何ですか？", { size: "xs" }),
      checkRow("入社後、どんな仕事をしたいですか？", { size: "xs" }),
      checkRow("希望の年収と、その根拠は？", { size: "xs" }),
    ]),
    footer: footerBox([
      cta("この内容を、管理人に相談する", uri("管理人に相談", prefilledChatUrl(PREP_TEMPLATE))),
      linkBtn("30秒診断をはじめる", START()),
    ]),
  });
  return flexMessage("面談準備シート：伝える3つのこと", b);
}

// ------------------------------------------------------------------ 転職スケジュール逆算
const PLAN = {
  m3: ["3か月以内に入社したい", "今すぐ動く", [["今週", "サービスに登録し、面談を予約"], ["1か月目", "求人紹介を受けて、応募を開始"], ["2か月目", "書類・面接（同時に2〜3社を進める）"], ["3か月目", "内定・条件確認・退職の申し出"]]],
  m6: ["半年以内に入社したい", "まず情報収集から", [["今月", "情報収集・自己分析、面談でざっくり相場を知る"], ["2〜3か月後", "応募を開始（気になる求人から）"], ["4〜5か月後", "選考・内定"], ["6か月目", "退職交渉・引き継ぎ・入社"]]],
  y1: ["1年以内に検討したい", "準備を始める", [["今〜3か月", "年収・条件の整理、体験記やノウハウで情報収集"], ["4〜8か月後", "登録・面談を始め、求人を見比べる"], ["9〜11か月後", "応募・選考"], ["1年後", "内定・退職・入社"]]],
};

export function planAskMessage() {
  const items = Object.entries(PLAN).map(([k, [label]]) => ({ k, label }));
  const b = bubble({
    body: bodyBox([
      eyebrow("SCHEDULE PLANNER"),
      text("転職スケジュール逆算", { size: "lg", weight: "bold", color: C.navy, margin: "sm" }),
      text("いつ頃までに転職したいですか？「いつ・何をするか」の目安をお見せします。", { size: "xs", color: C.muted, margin: "sm" }),
      spacer("sm"),
      ...items.map((it) =>
        box("horizontal", [
          box("vertical", [text(it.label, { align: "center", weight: "bold", color: C.navy })], {
            flex: 1, paddingTop: "13px", paddingBottom: "13px", cornerRadius: "10px", borderWidth: "1px", borderColor: C.border, backgroundColor: C.paper, justifyContent: "center",
            action: postback(it.label, `plan|t:${it.k}`, it.label),
          }),
        ], { margin: "sm" })
      ),
    ]),
  });
  return flexMessage("転職スケジュール逆算：希望時期を選んでください", b);
}

export function planResultMessage(k) {
  const p = PLAN[k];
  if (!p) return planAskMessage();
  const b = bubble({
    body: bodyBox([
      eyebrow("YOUR SCHEDULE"),
      text(p[0], { size: "lg", weight: "bold", color: C.navy, margin: "sm" }),
      text(`おすすめ：${p[1]}`, { size: "xs", weight: "bold", color: C.goldDeep, margin: "sm" }),
      ...p[2].flatMap(([when, what], i) => [stepRow(i + 1, when, what)]),
      text("※一般的な目安です。転職活動から入社までは、3〜6か月ほどかかることが多いとされています。退職の申し出時期は、就業規則で確認してください。", { size: "xxs", color: C.muted, margin: "lg" }),
    ]),
    footer: footerBox([cta("30秒診断をはじめる", START()), linkBtn("面談準備シートを見る", postback("面談準備シート", "prep", "面談準備シート"))]),
  });
  return flexMessage(`転職スケジュール：${p[0]}`, b);
}

// ------------------------------------------------------------------ 友だちにシェア
export function shareMessage() {
  const msg = `転職サービス選びで迷っている人へ。\n職種・年代・年収帯に合うサービスを、30秒・タップだけで診断してくれるLINEです（診断は無料）。\n\n${addFriendUrl()}`;
  const b = bubble({
    body: bodyBox([
      eyebrow("SHARE"),
      text("友だちにも教える", { size: "lg", weight: "bold", color: C.navy, margin: "sm" }),
      text("転職で迷っている友だちがいたら、このLINEを紹介してください。ボタンを押すと、LINEの共有画面が開きます。", { size: "sm", margin: "md" }),
    ]),
    footer: footerBox([cta("LINEで友だちに送る", uri("友だちに送る", `https://line.me/R/share?text=${enc(msg)}`))]),
  });
  return flexMessage("友だちにも教える", b);
}

// ------------------------------------------------------------------ 管理人に直接相談
export function consultMessage(base) {
  const b = bubble({
    hero: heroImage(imgUrl(base, "consult.jpg")),
    body: bodyBox([
      eyebrow("PRIVATE CONSULT"),
      text("管理人に、直接相談", { size: "xl", weight: "bold", color: C.navy, margin: "sm" }),
      text(`${brand.persona}が、このトークで直接お答えします。診断だけでは決めきれないことも、お気軽にどうぞ。`, { size: "sm", margin: "md" }),
      text("こんな相談ができます", { size: "sm", weight: "bold", color: C.navy, margin: "lg" }),
      checkRow("診断結果の見方、どのサービスに登録するか", { size: "sm" }),
      checkRow("サービスごとの違い・向き不向き", { size: "sm" }),
      checkRow("面談前の準備・伝え方", { size: "sm" }),
      checkRow("年収交渉・退職の進め方（一般的な考え方）", { size: "sm" }),
      text("相談のしかた", { size: "sm", weight: "bold", color: C.navy, margin: "lg" }),
      stepRow(1, "下のボタンで、相談用のメモを開く"),
      stepRow(2, "職種・年代・お悩みを書いて、送信"),
      stepRow(3, "運営が内容を確認して、返信します"),
      panel([
        text(brand.contact.reply, { size: "xs" }),
        text("電話番号・住所・パスワードなどの個人情報は、書かないでください。", { size: "xxs", color: "#8A5A2B", margin: "sm" }),
      ], { margin: "lg" }),
      text(brand.contact.note, { size: "xxs", color: C.muted, margin: "md" }),
    ]),
    footer: footerBox([
      cta("相談メッセージを書く", uri("相談を書く", prefilledChatUrl(CONSULT_TEMPLATE))),
      linkBtn("よくある質問を見る", postback("よくある質問", "faq", "よくある質問")),
    ]),
  });
  const m = flexMessage("管理人に直接相談", b);
  m.quickReply = quickReply([["面談準備シート", "prep", "面談準備シート"], ["30秒診断", "st", "30秒転職診断"], ["よくある質問", "faq", "よくある質問"]]);
  return m;
}
