// 質問・選択肢・ラベル定義（診断フローの単一の情報源）

export const JOBS = [
  { v: "sales", label: "営業・販売", short: "営業・販売" },
  { v: "office", label: "事務・管理", short: "事務・管理" },
  { v: "it", label: "IT・Web", short: "IT・Web" },
  { v: "med", label: "医療・福祉", short: "医療・福祉" },
  { v: "tech", label: "技術・製造", short: "技術・製造" },
  { v: "const", label: "建築・施工・設備", short: "建築・施工・設備" },
  { v: "logi", label: "物流・ドライバー", short: "物流・ドライバー" },
  { v: "other", label: "その他", short: "その他" },
];

// 職種ごとの追加質問（サービスの選定に必要なものだけ）
export const SUBS = {
  sales: {
    title: "近いお仕事は、どちらですか？",
    options: [
      { v: "bizsales", label: "営業（法人・個人）", short: "営業" },
      { v: "retail", label: "販売・接客", short: "販売・接客" },
    ],
  },
  med: {
    title: "医療・福祉の中で、近いお仕事は？",
    options: [
      { v: "nurse", label: "看護師", short: "看護師" },
      { v: "care", label: "介護職", short: "介護職" },
      { v: "pharm", label: "薬剤師", short: "薬剤師" },
      { v: "child", label: "保育士", short: "保育士" },
      { v: "medother", label: "リハビリ職・医療事務・その他", short: "医療・福祉（その他）" },
    ],
  },
  it: {
    title: "ITのご経験を教えてください",
    options: [
      { v: "it_none", label: "未経験・これから目指す", short: "IT（未経験）" },
      { v: "it_jr", label: "経験3年未満", short: "IT（経験3年未満）" },
      { v: "it_sr", label: "経験3年以上", short: "IT（経験3年以上）" },
      { v: "it_free", label: "フリーランス希望", short: "IT（フリーランス希望）" },
    ],
  },
  tech: {
    title: "近いお仕事は、どちらですか？",
    options: [
      { v: "mfg", label: "工場・製造ライン", short: "製造" },
      { v: "eng", label: "設計・開発・品質管理など", short: "技術職" },
    ],
  },
  other: {
    title: "近いものをお選びください",
    options: [
      { v: "gen", label: "上記以外", short: "その他" },
      { v: "dis", label: "障がい者雇用で探したい", short: "その他（障がい者雇用）" },
    ],
  },
};

export const AGES = [
  { v: "a20", label: "20〜24歳" },
  { v: "a25", label: "25〜29歳" },
  { v: "a30", label: "30〜34歳" },
  { v: "a35", label: "35歳以上" },
];

// 現在の年収（額面・賞与込み）。分布は国税庁「令和6年分 民間給与実態統計調査」（男女計）。
// pct=その区分に属する割合(%)、below=その区分より下の累計(%)
export const INCOMES = [
  { v: "i0", label: "〜300万円", rank: 0, pct: 32.0, below: 0, position: "全体の約3割（約32%）が属するゾーンです。" },
  { v: "i3", label: "300〜400万円", rank: 1, pct: 16.1, below: 32.0, position: "全体の約16%が属するゾーン。下から数えて約32〜48%の位置です。" },
  { v: "i4", label: "400〜500万円", rank: 2, pct: 15.3, below: 48.1, position: "全体の約15%が属するゾーン。全体の中央値に近い、下から約48〜63%の位置です。" },
  { v: "i5", label: "500〜700万円", rank: 3, pct: 19.4, below: 63.4, position: "全体の約19%が属するゾーン。下から約63〜83%の位置です。" },
  { v: "i7", label: "700万円〜", rank: 4, pct: 17.3, below: 82.8, position: "全体の上位約17%に入るゾーンです。" },
];
export const INCOME_UNKNOWN = { v: "ix", label: "答えたくない・わからない" };
export const INCOME_AVERAGE_NOTE = "給与所得者全体の平均は478万円（令和6年分）";
export const INCOME_SOURCE = "出典：国税庁「令和6年分 民間給与実態統計調査」（1年を通じて勤務した給与所得者・男女計）";

export const PRIORITIES = [
  { v: "up", label: "年収アップ" },
  { v: "wl", label: "土日休み・働き方" },
  { v: "car", label: "キャリアアップ" },
  { v: "new", label: "未経験の仕事に挑戦" },
  { v: "fit", label: "自分に合う仕事探し" },
  { v: "haken", label: "派遣で働きたい" },
];

// 「転職時期」と「現在の活動状況」を1問にまとめる
export const TIMINGS = [
  { v: "now", label: "すでに応募中・すぐ動きたい", short: "すぐ動きたい" },
  { v: "m3", label: "3か月以内に動きたい", short: "3か月以内" },
  { v: "m6", label: "半年〜1年以内に検討", short: "半年〜1年以内" },
  { v: "info", label: "まずは情報収集から", short: "情報収集から" },
];

export const AREAS = [
  { v: "kanto", label: "首都圏（東京・神奈川・千葉・埼玉）" },
  { v: "kansai", label: "関西（大阪・京都・兵庫など）" },
  { v: "aichi", label: "東海（愛知・岐阜・三重）" },
  { v: "other", label: "その他の地域" },
];

const find = (list, v) => list.find((x) => x.v === v);
export const jobLabel = (v) => find(JOBS, v)?.label ?? "";
export const ageLabel = (v) => find(AGES, v)?.label ?? "";
export const incomeLabel = (v) => (v === "ix" ? INCOME_UNKNOWN.label : find(INCOMES, v)?.label ?? "");
export const priorityLabel = (v) => find(PRIORITIES, v)?.label ?? "";
export const timingLabel = (v) => find(TIMINGS, v)?.label ?? "";
export const timingShort = (v) => find(TIMINGS, v)?.short ?? "";
export const areaLabel = (v) => find(AREAS, v)?.label ?? "";
export const subOf = (a) => (a.j && SUBS[a.j] ? find(SUBS[a.j].options, a.s) : undefined);
/** 理由文・サマリー用の職種表記（サブ選択があればそちらを優先） */
export function jobShort(a) {
  const sub = subOf(a);
  return sub?.short ?? find(JOBS, a.j)?.short ?? "";
}
export const incomeRank = (v) => find(INCOMES, v)?.rank ?? -1;
