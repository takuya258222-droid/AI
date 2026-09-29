// 診断以外のメッセージ（あいさつ・キャンペーン・体験記・FAQ・信頼情報など）
import { brand, campaign, notes, tips } from "./content.mjs";
import { keyOf } from "./matcher.mjs";
import { decode } from "./state.mjs";
import { tipsData } from "./tips.mjs";
import { latestNoteBubble } from "./notefeed.mjs";
import { INCOME_SOURCE } from "./labels.mjs";
import {
  C, text, box, sep, spacer, uri, postback, cta, ghost, linkBtn, eyebrow, badge, checkRow, dotRow, stepRow, panel,
  bubble, heroImage, bodyBox, footerBox, flexMessage, carousel, imgUrl, clip, quickReply, buttonCard,
} from "./flex.mjs";

const START = () => postback("30秒診断をスタート", "st", "30秒診断をスタート");
const PR_LINE = () => text("PR｜紹介リンク経由の登録で、当アカウントが各社から報酬を受け取る場合があります", { size: "xxs", color: C.muted, align: "center", margin: "sm" });

// ------------------------------------------------------------------ あいさつ
const FEATURES = [
  ["30秒転職診断", "タップだけで、あなたに合うサービスを理由つきで2〜3社に厳選"],
  ["年収ポジション診断", "国税庁の公的データで、あなたの年収の現在地をチェック"],
  ["職種別に厳選", "看護・介護・薬剤師・保育・IT・コンサル・M&A・営業・製造・障がい者雇用ほか"],
  ["転職体験記", "note連載「転職の全記録」。動機・年収・後悔まで実例で読める"],
  ["抽選キャンペーン", "登録完了のスクショを送ると、毎月抽選で3名様にPayPay 500円分"],
  ["自動フォロー・相談", "診断の結果はあとから見直せます。お問い合わせはこのトークへ"],
];

export function welcomeMessages(base, name, { returning = false, variant = "a" } = {}) {
  const who = name ? `${clip(name, 12)}さん、` : "";
  const hello = returning
    ? `${who}おかえりなさい。\nまたお会いできて嬉しいです。\n\n診断は何度でも、無料でやり直せます。`
    : variant === "b"
    ? `${who}友だち追加ありがとうございます。\n運営のなぎです。\n\n転職サービス選びで、失敗しないために。\n30秒・タップだけで、あなたに合うサービスを、理由つきで2〜3社に絞ってお届けします（診断は無料）。\n\n👇 まずは、下のボタンから。`
    : `${who}友だち追加ありがとうございます。\n運営のなぎです。\n元転職エージェントで、営業9年・支援成約800名・相談8,000名超。今は人材紹介会社の立ち上げ支援をしています。\n\n「転職エージェントって、どこも同じでしょ？」\n実は、向き不向きがはっきり分かれます。合わないサービスに登録して時間を使うのは、もったいない。\n\nこのLINEは、あなたの職種・年代・年収帯に合うサービスだけを、選んだ理由つきで2〜3社に絞ってお届けします。`;
  const b = bubble({
    hero: heroImage(imgUrl(base, "welcome.jpg")),
    body: bodyBox([
      eyebrow("WHAT YOU CAN DO"),
      text("このLINEでできること", { size: "lg", weight: "bold", color: C.navy, margin: "sm" }),
      ...FEATURES.map(([title, desc], i) => stepRow(i + 1, title, desc)),
      sep("lg"),
      text("質問はすべてタップ・入力不要。診断は無料で、登録は任意です。", { size: "xs", weight: "bold", color: C.goldDeep, margin: "md" }),
      text(`運営：${brand.persona}｜${brand.bioShort}`, { size: "xxs", color: C.muted, margin: "md" }),
    ]),
    footer: footerBox([cta("👇 まずは30秒診断をスタート", START()), PR_LINE()]),
  });
  const card = flexMessage("このLINEでできること：30秒診断・年収診断・体験記・抽選キャンペーン", b);
  card.quickReply = quickReply([["年収診断", "sal", "年収診断"], ["転職体験記", "taiken", "転職体験記"], ["キャンペーン", "camp", "キャンペーン詳細"], ["よくある質問", "faq", "よくある質問"]]);
  return [{ type: "text", text: hello }, card];
}

// ------------------------------------------------------------------ 登録→スクショ→抽選
const TIMING_LINE = {
  now: "すぐに動きたい方は、まず1社の面談予約から始めるのがおすすめです。",
  m3: "3か月以内に動くなら、2社に登録して担当者を比べるのがおすすめです。",
  m6: "時間に余裕があるうちに、情報収集がてら担当者と話してみるのがおすすめです。",
  info: "情報収集だけでもOK。まずは相談だけの利用もできます。",
};

/** 登録手順とキャンペーンの案内（診断結果の3通目） */
export function entryCard(a, base) {
  const b = bubble({
    hero: heroImage(imgUrl(base, "steps.jpg")),
    body: bodyBox([
      eyebrow("HOW TO ENTER"),
      text("登録したら、スクショを送るだけ", { size: "lg", weight: "bold", color: C.navy, margin: "sm" }),
      stepRow(1, "指定のリンクから無料登録", "前のカードのボタンからお進みください"),
      stepRow(2, "登録完了画面をスクリーンショット"),
      stepRow(3, "このトークに、その画像を送信"),
      panel(
        [
          text(`毎月抽選で${campaign.winners}名様に ${campaign.prize}`, { size: "sm", weight: "bold", color: C.navy }),
          text("※登録された方全員へのプレゼントではありません", { size: "xxs", color: C.muted, margin: "xs" }),
        ],
        { margin: "lg", border: true }
      ),
      ...(a?.t && TIMING_LINE[a.t] ? [text(TIMING_LINE[a.t], { size: "xs", color: C.goldDeep, weight: "bold", margin: "lg" })] : []),
    ]),
    footer: footerBox([cta("キャンペーン詳細を見る", postback("キャンペーン詳細", "camp", "キャンペーン詳細"))]),
  });
  return flexMessage("登録後は、完了画面のスクショをこのトークに送るだけ", b);
}

/** 「登録・応募の流れ」（メニュー） */
export function stepsMessage(base) {
  return entryCard(null, base);
}

/** キャンペーン詳細（2枚のカルーセル） */
export function campaignMessage(base) {
  const c = campaign;
  const first = bubble({
    hero: heroImage(imgUrl(base, "campaign.jpg")),
    body: bodyBox([
      eyebrow("PRESENT CAMPAIGN"),
      text(`毎月抽選で${c.winners}名様に\n${c.prize}`, { size: "xl", weight: "bold", color: C.navy, margin: "sm" }),
      text("登録された方全員へのプレゼントではなく、抽選で当選された方が対象です。", { size: "xs", color: "#8A5A2B", margin: "md", weight: "bold" }),
      sep("lg"),
      text("応募方法", { size: "sm", weight: "bold", color: C.navy, margin: "lg" }),
      ...c.steps.map((s, i) => stepRow(i + 1, s)),
      sep("lg"),
      text("応募条件", { size: "sm", weight: "bold", color: C.navy, margin: "lg" }),
      text(c.entryRule, { size: "xs", color: C.ink, margin: "sm" }),
    ]),
    footer: footerBox([cta("診断で、登録先を探す", START()), linkBtn("スクショの送り方を見る", postback("送り方", "steps", "登録後の流れ"))]),
  });
  const second = bubble({
    body: bodyBox([
      eyebrow("RULES"),
      text("抽選・当選連絡・注意事項", { size: "md", weight: "bold", color: C.navy, margin: "sm" }),
      sep("md"),
      text("応募口数", { size: "xs", weight: "bold", color: C.goldDeep, margin: "md" }),
      text(c.entries.replace(/★/g, ""), { size: "xs", margin: "xs" }),
      text("抽選", { size: "xs", weight: "bold", color: C.goldDeep, margin: "md" }),
      text(c.drawTiming.replace(/★/g, ""), { size: "xs", margin: "xs" }),
      text("当選のご連絡", { size: "xs", weight: "bold", color: C.goldDeep, margin: "md" }),
      text(c.notify.replace(/★/g, ""), { size: "xs", margin: "xs" }),
      text("賞品のお渡し", { size: "xs", weight: "bold", color: C.goldDeep, margin: "md" }),
      text(c.delivery.replace(/★/g, ""), { size: "xs", margin: "xs" }),
      sep("md"),
      text("ご注意", { size: "xs", weight: "bold", color: C.goldDeep, margin: "md" }),
      ...c.notes.map((n) => dotRow(n, { size: "xxs" })),
    ]),
    footer: footerBox([ghost("詳しい応募規約（Webページ）", uri("応募規約", `${base}${brand.legalPath}#campaign`), { size: "xs", padding: "10px" })]),
  });
  return flexMessage("PayPay抽選キャンペーンの詳細", carousel([first, second]));
}

/** スクショ受信後の自動返信 */
export function receiptMessages(base) {
  const c = campaign;
  const b = bubble({
    hero: heroImage(imgUrl(base, "received.jpg")),
    body: bodyBox([
      text("✅ スクリーンショットを受け取りました", { size: "md", weight: "bold", color: C.navy }),
      text("キャンペーンへの応募を受け付けました。この画面が表示されていれば、応募は完了しています。追加の操作は不要です。", { size: "sm", margin: "md" }),
      sep("lg"),
      panel(
        [
          text(`毎月抽選で${c.winners}名様に ${c.prize}`, { size: "sm", weight: "bold", color: C.navy }),
          text("登録された方全員へのプレゼントではありません。", { size: "xxs", color: C.muted, margin: "xs" }),
        ],
        { margin: "lg", border: true }
      ),
      text("当選のご連絡", { size: "xs", weight: "bold", color: C.goldDeep, margin: "lg" }),
      text(c.notify.replace(/★/g, ""), { size: "xs", margin: "xs" }),
      text("ご確認ください", { size: "xs", weight: "bold", color: C.goldDeep, margin: "lg" }),
      dotRow("登録完了が確認できない画像は、対象外となる場合があります。", { size: "xs" }),
      dotRow("複数のサービスに登録された場合は、それぞれの完了画面をそのまま送ってください。", { size: "xs" }),
    ]),
    footer: footerBox([ghost("キャンペーンの詳細を見る", postback("キャンペーン詳細", "camp", "キャンペーン詳細"))]),
  });
  const msg = flexMessage("スクリーンショットを受け取りました。キャンペーンへの応募を受け付けました", b);
  msg.quickReply = quickReply([["キャンペーン詳細", "camp", "キャンペーン詳細"], ["転職体験記", "taiken", "転職体験記"], ["30秒診断", "st", "30秒転職診断"]]);
  return [msg];
}

// ------------------------------------------------------------------ 転職体験記（noteマガジン）
function caseBubble(n, base) {
  return bubble({
    hero: heroImage(imgUrl(base, `notes/${n.id}.jpg`), "1.91:1"),
    body: bodyBox([eyebrow(n.label), text(n.headline, { size: "sm", weight: "bold", color: C.navy, margin: "sm", maxLines: 4 })], { paddingAll: "16px" }),
    footer: footerBox([ghost("この体験記を読む", uri("この体験記を読む", n.url), { size: "xs", padding: "9px" })]),
  });
}

export function taikenMessage(base, latest = []) {
  const m = notes.magazine;
  const first = bubble({
    hero: heroImage(imgUrl(base, "taiken.jpg")),
    body: bodyBox([
      eyebrow("CAREER STORIES"),
      text(`『${m.title}』`, { size: "xl", weight: "bold", color: C.navy, margin: "sm" }),
      text(m.subtitle, { size: "xs", color: C.muted, margin: "xs" }),
      sep("lg"),
      text(m.description, { size: "sm", margin: "lg" }),
      checkRow("医療福祉：介護・看護・薬剤師・リハビリ", { size: "xs" }),
      checkRow("M&A・コンサル・IT・SaaS・VC・PE・メーカー・工場・物流など", { size: "xs" }),
      checkRow("動機・選考・年収・後悔・その後まで", { size: "xs" }),
      checkRow("noteで毎日発信中", { size: "xs" }),
    ]),
    footer: footerBox([
      cta("マガジンをまとめて読む", uri("マガジンを読む", m.url)),
      linkBtn("運営者のnoteを見る", uri("運営者のnote", brand.note.profileUrl)),
      linkBtn("新着noteをLINEで受け取る", postback("新着noteを受け取る", "subon|all", "新着noteを受け取る")),
    ]),
  });
  const last = bubble({
    body: bodyBox(
      [
        eyebrow("NEXT"),
        text("あなたの場合は？", { size: "lg", weight: "bold", color: C.navy, margin: "sm" }),
        text("30秒診断で、職種・年代・年収帯に合うサービスを見つけましょう。", { size: "xs", color: C.muted, margin: "md" }),
        spacer("lg"),
        cta("30秒診断をスタート", START()),
      ],
      { justifyContent: "center" }
    ),
  });
  // 最新のnote記事（RSS）があれば先に並べる。なければ従来の事例カードのみ
  const fresh = latest.slice(0, 5).map(latestNoteBubble);
  const cases = notes.cases.slice(0, fresh.length ? 5 : 10).map((n) => caseBubble(n, base));
  return flexMessage("転職体験記・最新のnote", carousel([first, ...fresh, ...cases, last]));
}

// ------------------------------------------------------------------ 転職ノウハウ
const KNOWHOW = [
  ["01", "転職エージェントの仕組み", ["求職者は無料。採用が決まった企業が、紹介手数料を支払う仕組みです", "担当者は企業側の情報にも詳しい一方、企業から報酬を得る立場でもあります", "だからこそ、2〜3社を併用して比べるのがおすすめです"]],
  ["02", "面談前に整理する3つのこと", ["これまでの仕事内容と実績（数字があれば）", "転職を考えた理由", "譲れない条件を3つまで（年収・勤務地・休日など）"]],
  ["03", "年収交渉の基本", ["現年収と、希望年収の「根拠」をセットで準備する", "交渉は、エージェント経由で進めるのが一般的です", "額面だけでなく、賞与・手当・残業代込みで比べる"]],
  ["04", "退職までの流れ", ["内定後は、労働条件通知書の内容をよく確認する", "就業規則で、退職を申し出る時期を確認（1〜2か月前が多い）", "引き継ぎと有給の消化を、早めに計画する"]],
];

export function knowledgeMessage(base) {
  const cards = KNOWHOW.map(([no, title, points]) =>
    bubble({
      body: bodyBox([
        text(no, { size: "3xl", weight: "bold", color: C.gold }),
        text(title, { size: "md", weight: "bold", color: C.navy, margin: "sm" }),
        sep("md"),
        ...points.map((p) => checkRow(p, { size: "sm", margin: "md" })),
        text("※一般的な内容です。個別の状況は、各サービスの担当者にご相談ください。", { size: "xxs", color: C.muted, margin: "lg" }),
      ]),
    })
  );
  const more = bubble({
    hero: heroImage(imgUrl(base, "knowledge.jpg")),
    body: bodyBox([
      eyebrow("MORE"),
      text("「当たり」エージェントの見分け方", { size: "md", weight: "bold", color: C.navy, margin: "sm" }),
      text("使い倒し方まで、noteで詳しく解説しています。", { size: "xs", color: C.muted, margin: "sm" }),
    ]),
    footer: footerBox([ghost("noteで読む", uri("noteで読む", "https://note.com/wise_ivy1277/n/n60524bf5edbe"), { size: "xs", padding: "10px" }), linkBtn("30秒診断をはじめる", START())]),
  });
  return flexMessage("転職ノウハウ：転職を成功させる4つの基本", carousel([...cards, more]));
}

// ------------------------------------------------------------------ FAQ
export const FAQ = {
  free: ["診断や紹介は本当に無料？", "はい。診断も、ご紹介するサービスの利用も、求職者の方は無料です。転職エージェントは、採用が決まった企業側から報酬を受け取る仕組みのためです。※サービスごとに条件が異なる場合は、各サービスの公式サイトでご確認ください。"],
  contact: ["電話やメールは来る？", "面談日程の調整などで、登録したサービスから電話・メール・LINEなどで連絡が入ることがあります。連絡手段や頻度の希望は、登録時や担当者にお伝えいただけます。"],
  multi: ["複数のサービスに登録してもいい？", "はい。2〜3社に登録して、求人や担当者との相性を比べることもできます。それぞれの面談日程は、余裕をもって調整するのがおすすめです。"],
  soon: ["今すぐ転職しなくても大丈夫？", "大丈夫です。情報収集の段階でも、相談だけの利用ができるサービスがあります。診断で「まずは情報収集から」を選ぶと、そうした選択肢もご案内します。"],
  how: ["診断結果は、どう決まっている？", "ご回答（職種・年代・年収帯・重視すること）と、各サービスの公開情報（対象職種・対象年代・エリア・雇用形態など）との適合度で選んでいます。対象外の方には表示しません。詳しくは「選定基準」をご覧ください。"],
  working: ["在職中でも登録できる？", "はい。在職中の方も多く利用しています。面談の日程は、平日の夜・土日・オンラインなど、調整できるサービスが多いです（詳しくは各サービスへご相談ください）。退職の時期は、内定が出てから決められます。"],
  decline: ["面談のあと、断ってもいい？", "はい。紹介された求人に応募するかどうかは、ご自身で決められます。合わないと感じたら、断ったり、利用をやめたりして大丈夫です。"],
  resume: ["履歴書や職務経歴書は、先に必要？", "登録・面談の時点では、なくても相談できることが多いです（サービスにより異なります）。応募が決まる段階で、担当者と一緒に整えていくのが一般的です。"],
  data: ["個人情報は、どう扱われる？", "診断の回答は、結果の表示にのみ使います。トークの内容（画像を含む）は、お問い合わせ対応とキャンペーンの確認・当選連絡のために運営が確認します。詳しくは「プライバシー・広告表記」をご覧ください。"],
};

export function faqMenuMessage() {
  const btns = Object.entries(FAQ).map(([k, [q]]) => ghost(q, postback(q, `faq|${k}`, q), { size: "xs", padding: "11px" }));
  const b = bubble({
    body: bodyBox([
      eyebrow("Q & A"),
      text("よくあるご質問", { size: "lg", weight: "bold", color: C.navy, margin: "sm" }),
      text("気になる項目をタップしてください。", { size: "xs", color: C.muted, margin: "sm" }),
      spacer("md"),
      ...btns.flatMap((x) => [x, spacer("sm")]),
    ]),
    footer: footerBox([linkBtn("キャンペーンについて", postback("キャンペーン", "camp", "キャンペーン詳細")), linkBtn("お問い合わせ", postback("お問い合わせ", "contact", "お問い合わせ"))]),
  });
  return flexMessage("よくあるご質問", b);
}

export function faqAnswerMessage(topic) {
  const item = FAQ[topic];
  if (!item) return faqMenuMessage();
  const b = bubble({
    body: bodyBox([eyebrow("Q"), text(item[0], { size: "md", weight: "bold", color: C.navy, margin: "sm" }), sep("md"), eyebrow("A"), text(item[1], { size: "sm", margin: "sm" })]),
    footer: footerBox([ghost("ほかの質問を見る", postback("ほかの質問", "faq", "よくある質問"), { size: "xs", padding: "10px" }), linkBtn("30秒診断をはじめる", START())]),
  });
  return flexMessage(item[0], b);
}

// ------------------------------------------------------------------ 信頼情報（運営者・選定基準・プライバシー・お問い合わせ）
export function aboutMessage(base) {
  const b = bubble({
    hero: heroImage(imgUrl(base, "about.jpg")),
    body: bodyBox([
      eyebrow("ABOUT"),
      text(`運営：${brand.persona}`, { size: "xl", weight: "bold", color: C.navy, margin: "sm" }),
      text(brand.role, { size: "xs", color: C.muted, margin: "xs" }),
      box("horizontal", brand.stats.map((s) => box("vertical", [text(s.value, { size: "lg", weight: "bold", color: C.navy, align: "center" }), text(s.label, { size: "xxs", color: C.muted, align: "center", margin: "xs" })], { flex: 1 })), { margin: "lg", backgroundColor: C.ivory, cornerRadius: "10px", paddingAll: "12px" }),
      text(brand.bio, { size: "sm", margin: "lg" }),
      text(`※${brand.bioSource}`, { size: "xxs", color: C.muted, margin: "sm" }),
      panel([text("noteでは、職種別の転職体験記を公開しています。", { size: "xs" })], { margin: "lg" }),
    ]),
    footer: footerBox([
      cta("noteを見る", uri("noteを見る", brand.note.profileUrl)),
      linkBtn("ご紹介の考え方（選定基準）", postback("選定基準", "policy", "ご紹介の考え方")),
    ]),
  });
  return flexMessage("運営者について", b);
}

export function policyMessage(base) {
  const b = bubble({
    hero: heroImage(imgUrl(base, "policy.jpg")),
    body: bodyBox([
      eyebrow("OUR STANDARDS"),
      text("ご紹介の考え方", { size: "xl", weight: "bold", color: C.navy, margin: "sm" }),
      stepRow(1, "回答との適合度で選びます", "職種・年代・年収帯・重視すること、と各サービスの対象条件を照らし合わせます"),
      stepRow(2, "対象外の方には表示しません", "対象年齢・エリア・条件が合わないサービスは、ご紹介しません"),
      stepRow(3, "専門外の職種は、正直にお伝えします", "専門特化の提携先がない職種は、その旨を明記して案内します"),
      stepRow(4, "広告であることを明示します", "紹介リンク経由の登録で、当アカウントが報酬を受け取る場合があります"),
      stepRow(5, "最新情報は公式サイトで", "掲載内容は公開情報をもとにしています。条件は各サービスでご確認ください"),
    ]),
    footer: footerBox([cta("30秒診断をスタート", START()), linkBtn("プライバシー・広告表記", postback("プライバシー", "privacy", "プライバシー・広告表記"))]),
  });
  return flexMessage("ご紹介の考え方（選定基準）", b);
}

export function privacyMessage(base) {
  const b = bubble({
    body: bodyBox([
      eyebrow("PRIVACY & DISCLOSURE"),
      text("プライバシー・広告表記", { size: "lg", weight: "bold", color: C.navy, margin: "sm" }),
      sep("md"),
      text("広告表記", { size: "xs", weight: "bold", color: C.goldDeep, margin: "md" }),
      text(brand.disclosure, { size: "xs", margin: "xs" }),
      text("診断の回答", { size: "xs", weight: "bold", color: C.goldDeep, margin: "md" }),
      text("結果を表示するためにのみ使用します。", { size: "xs", margin: "xs" }),
      text("トークの内容・画像", { size: "xs", weight: "bold", color: C.goldDeep, margin: "md" }),
      text("お問い合わせ対応と、キャンペーンの確認・当選連絡のために運営が確認します。第三者へは提供しません（法令に基づく場合を除く）。", { size: "xs", margin: "xs" }),
      text("キャンペーンの応募記録", { size: "xs", weight: "bold", color: C.goldDeep, margin: "md" }),
      text("抽選と当選のご連絡のために、ユーザーID・応募月・応募回数を、最長150日間保存します。", { size: "xs", margin: "xs" }),
      text("フォローのメッセージ", { size: "xs", weight: "bold", color: C.goldDeep, margin: "md" }),
      text(`診断後に、お役立ち情報や、キャンペーンの締切のご案内をお送りする場合があります。このために、ユーザーIDと診断の区分を最大${brand.followup.retentionDays}日間保存し、「診断結果をもう一度見る」にも使います。`, { size: "xs", margin: "xs" }),
      text("新着noteの配信", { size: "xs", weight: "bold", color: C.goldDeep, margin: "md" }),
      text("ご希望の方に限り、ユーザーIDと希望の職種区分を保存し、週1回まで新着noteをお送りします。", { size: "xs", margin: "xs" }),
      text(`「${brand.followup.stopKeyword}」と送信すると、これらの配信をすべて停止し、保存した情報も削除します。`, { size: "xs", margin: "xs" }),
    ]),
    footer: footerBox([ghost("詳しい内容（Webページ）", uri("詳しい内容", `${base}${brand.legalPath}`), { size: "xs", padding: "10px" })]),
  });
  return flexMessage("プライバシー・広告表記", b);
}

export function contactMessage() {
  const b = bubble({
    body: bodyBox([
      eyebrow("CONTACT"),
      text("お問い合わせ", { size: "lg", weight: "bold", color: C.navy, margin: "sm" }),
      sep("md"),
      text(brand.contact.how, { size: "sm", margin: "md" }),
      text(brand.contact.reply, { size: "xs", color: C.muted, margin: "md" }),
      panel([text(brand.contact.note, { size: "xs" })], { margin: "lg" }),
    ]),
    footer: footerBox([ghost("よくある質問を見る", postback("よくある質問", "faq", "よくある質問"), { size: "xs", padding: "10px" })]),
  });
  return flexMessage("お問い合わせ", b);
}

// ------------------------------------------------------------------ その他
export function homeMessage(base) {
  const b = bubble({
    body: bodyBox([
      eyebrow("MENU"),
      text("何をお探しですか？", { size: "lg", weight: "bold", color: C.navy, margin: "sm" }),
      spacer("md"),
      cta("30秒転職診断", START()),
      spacer("sm"),
      ghost("年収ポジション診断", postback("年収診断", "sal", "年収診断")),
      spacer("sm"),
      ghost("抽選キャンペーン", postback("キャンペーン", "camp", "キャンペーン詳細")),
      spacer("sm"),
      ghost("診断結果をもう一度見る", postback("診断結果", "myres", "診断結果をもう一度見る")),
      spacer("sm"),
      ghost("職種別：面談・選考のポイント", postback("面談・選考のポイント", "tips", "面談・選考のポイント")),
      spacer("sm"),
      ghost("転職体験記・最新のnote", postback("転職体験記", "taiken", "転職体験記")),
      spacer("sm"),
      ghost("手取り・月収の目安", postback("手取り", "net", "手取り・月収の目安")),
      spacer("sm"),
      ghost("管理人に直接相談", postback("管理人に相談", "contact", "管理人に相談")),
    ]),
  });
  return flexMessage("メニュー", b);
}

export function fallbackMessages(base) {
  // 小さなボタン（クイックリプライ）ではなく、目立つメニューカードを添える
  return [
    { type: "text", text: "メッセージを受け取りました。運営が内容を確認して、順次ご返信します。\n\n診断やメニューは、下のボタンからも使えます。" },
    homeMessage(base),
  ];
}

// ------------------------------------------------------------------ 登録の意思ボタン／新着note配信
/** 「登録した／まだ迷ってる／あとで登録する」を押したときの返信（テキスト＋押しやすい大きなボタン） */
export function regMessages(kind, stateStr) {
  const st = decode(stateStr);
  const tipsBtn = tipsData(keyOf(st), st.g);
  const P = (label, data, dt = label) => postback(label, data, dt);
  const T = (t, card, qr) => { card.quickReply = quickReply(qr); return [{ type: "text", text: t }, card]; };
  if (kind === "y") {
    return T(
      "登録おつかれさまです！\n最後に、登録完了画面のスクリーンショットを、このトークに送ってください。毎月の抽選（3名様に PayPay 500円分）に応募できます。\n\n※お名前・電話番号・メールアドレスが写る場合は、その部分を隠してお送りください。\n※登録・応募された方全員へのプレゼントではありません。",
      buttonCard({ eyebrowText: "NEXT STEP", title: "スクショを送ったら応募完了です", buttons: [["📷 登録・応募の流れを見る", P("登録・応募の流れ", "steps", "登録後の流れ"), "cta"], ["🎁 キャンペーン詳細", P("キャンペーン詳細", "camp"), "ghost"], ["🔁 診断結果をもう一度見る", P("結果をもう一度見る", `rs|${stateStr}`), "ghost"]] }),
      [["登録・応募の流れ", "steps", "登録後の流れ"], ["キャンペーン詳細", "camp", "キャンペーン詳細"]]
    );
  }
  if (kind === "m") {
    return T(
      "迷うのは、自然なことです。\nまずは1社だけ、話を聞いてみる形でも大丈夫です。合わなければ、断ったり、やめたりしても構いません（利用は無料です）。\n\n気になる点があれば、下のボタンからどうぞ。",
      buttonCard({ eyebrowText: "NEXT STEP", title: "気になることは、どれですか？", buttons: [["❓ よくある不安（Q&A）を見る", P("よくある質問", "faq", "よくある質問"), "cta"], ["📋 面談・選考のポイントを見る", P("面談・選考のポイント", tipsBtn), "ghost"], ["🔁 診断結果をもう一度見る", P("結果をもう一度見る", `rs|${stateStr}`), "ghost"], ["💬 管理人に直接相談", P("管理人に相談", "contact"), "ghost"]] }),
      [["よくある不安", "faq", "よくある質問"], ["結果をもう一度見る", `rs|${stateStr}`, "結果をもう一度見る"]]
    );
  }
  return T(
    "了解です。登録できたら、完了画面のスクリーンショットを送ってください。\nいつでも、下のボタンから診断結果と紹介リンクをもう一度お見せします。",
    buttonCard({ eyebrowText: "NEXT STEP", title: "登録の準備はここから", buttons: [["🔁 診断結果をもう一度見る", P("結果をもう一度見る", `rs|${stateStr}`), "cta"], ["📷 登録・応募の流れを見る", P("登録・応募の流れ", "steps", "登録後の流れ"), "ghost"], ["📋 面談・選考のポイントを見る", P("面談・選考のポイント", tipsBtn), "ghost"]] }),
    [["結果をもう一度見る", `rs|${stateStr}`, "結果をもう一度見る"], ["登録・応募の流れ", "steps", "登録後の流れ"]]
  );
}

/** 新着note配信の登録完了 */
export function subOnMessage(key) {
  const label = tips.jobs[key]?.label;
  const what = label ? `「${label}」の新着` : "新着";
  return [{ type: "text", text: `新着noteの配信を登録しました。\n週1回（土曜の朝10時ごろ）、${what}があるときだけ、お届けします。\n\n止めるときは「${brand.followup.stopKeyword}」と送信してください。\n※note内に、紹介リンク（PR）を含む場合があります。` }];
}

export { INCOME_SOURCE };
