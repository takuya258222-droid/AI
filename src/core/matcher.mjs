// 診断結果の振り分けロジック。
// 職種(+サブ)ごとに対応サービスを絞り、年代・年収・エリア・重視項目で並べ替える。
import services from "../../config/services.json" with { type: "json" };
import { incomeRank, jobShort, ageLabel, priorityLabel } from "./labels.mjs";

const SPECIALIST_KEYS = new Set(["nurse", "care", "pharm", "child", "dis"]);
const ROLE_LIMIT = { child: 1 }; // 保育は1社に厳選、それ以外は2社
const FACTORY_SITES = new Set(["factory_world", "toyota_kikan"]); // 工場・期間工系（製造では必ず1つは残す）

export const ALL_SERVICES = services.services;

/** 回答から「振り分けキー」を求める */
export function keyOf(a) {
  switch (a.j) {
    case "med":
    case "it":
      return a.s;
    case "sales":
      return a.s === "retail" ? "retail" : "bizsales";
    case "tech":
      return a.s === "eng" ? "eng" : "mfg";
    case "other":
      return a.s === "dis" ? "dis" : "gen";
    default:
      return a.j; // office / const / logi
  }
}

function fitOf(s, key) {
  if (s.exclude?.includes(key)) return 0;
  return s.fit?.[key] ?? s.fit?.any ?? 0;
}

/** サービスが回答に対して表示可能か（ハード条件） */
export function isEligible(s, a, key) {
  if (!s.enabled) return false;
  if (s.ages && !s.ages.includes(a.g)) return false;
  if (fitOf(s, key) <= 0) return false;
  const exempt = s.requireExempt?.includes(key);
  if (!exempt && s.require?.priorities && !s.require.priorities.includes(a.p)) return false;
  if (!exempt && s.require?.incomeMin) {
    if (incomeRank(a.i) < incomeRank(s.require.incomeMin)) return false; // ix(不明)は-1 → 対象外
  }
  if (s.areas && a.r && !s.areas.includes(a.r)) return false;
  return true;
}

function scoreOf(s, a, key) {
  let sc = fitOf(s, key) + (s.pri?.[a.p] ?? 0) + (s.priByKey?.[key]?.[a.p] ?? 0);
  if (s.areaSoft && a.r) sc += s.areaSoft[a.r] ?? 0;
  if (a.t === "info" && s.explore) sc += 10;
  return sc;
}

/** 補足メッセージ（専門特化の提携先がない場合などを正直に伝える） */
function notesFor(a, key, picks) {
  const notes = [];
  if (key === "medother") notes.push("リハビリ職・医療事務など、専門に特化した提携サービスは現在ありません。幅広く相談できるサービスをご案内します。");
  if (key === "const") notes.push("建築・施工・設備の専門特化サービスは現在ありません。年代・働き方に合わせて、幅広く相談できるサービスをご案内します。");
  if (key === "eng") notes.push("設計・開発・品質管理などの専門特化サービスは現在ありません。年代・働き方に合わせて、幅広く相談できるサービスをご案内します。");
  if (key === "it_none" && a.g === "a35") notes.push("35歳以上・未経験のIT転職に特化した提携サービスは現在ありません。まずは相性の良いサービスを紹介してもらう形をおすすめします。");
  if (key === "child") notes.push("保育士の方向けには、実績のあるこの1社に厳選しています。");
  if (picks.length < 2 && key !== "child") notes.push("現在の回答に合う提携サービスが限られているため、厳選してご案内しています。");
  return notes;
}

/**
 * 診断結果を決定する。
 * @returns {{status:'need_area'} | {status:'ok', key:string, picks:Array, notes:string[]}}
 */
export function decide(a) {
  const key = keyOf(a);
  const ranked = ALL_SERVICES.filter((s) => isEligible(s, a, key))
    .map((s, idx) => ({ s, idx, score: scoreOf(s, a, key) }))
    .sort((x, y) => y.score - x.score || x.idx - y.idx);

  const limit = ROLE_LIMIT[key] ?? 2;
  const main = ranked.filter((p) => !p.s.challenge).slice(0, limit);

  // エリア限定サービスが候補に入り、エリア未回答なら追加質問へ
  if (!a.r && main.some((p) => p.s.areas)) return { status: "need_area" };

  const picks = main.map((p, i) => ({ service: p.s, role: i === 0 ? "best" : "also", score: p.score }));

  // 製造は、正社員・直接雇用のエージェント（ASSIGN・第二新卒neo）を優先しつつ、工場系サービスも1つは案内する
  if (key === "mfg" && !picks.some((x) => FACTORY_SITES.has(x.service.id))) {
    const f = ranked.find((p) => FACTORY_SITES.has(p.s.id));
    if (f) picks.push({ service: f.s, role: "also", score: f.score });
  }

  // 3枠目（専門特化の職種・製造では出さない）
  //  - 情報収集の段階／自分に合う仕事探し → 「まず相談したい方」枠
  //  - それ以外で条件を満たす場合 → 「挑戦枠」（M&A・コンサルなど）
  if (!SPECIALIST_KEYS.has(key) && key !== "mfg" && picks.length >= 2) {
    const has = (id) => picks.some((x) => x.service.id === id);
    if (a.t === "info" || a.p === "fit") {
      const extra = ranked.find((p) => p.s.explore && !p.s.challenge && !has(p.s.id));
      if (extra) picks.push({ service: extra.s, role: "explore", score: extra.score });
    } else {
      const ch = ranked.find((p) => p.s.challenge && !has(p.s.id));
      if (ch) picks.push({ service: ch.s, role: "challenge", score: ch.score });
    }
  }

  return { status: "ok", key, picks, notes: notesFor(a, key, picks) };
}

/** 「あなたに合う理由」の文章を組み立てる */
export function reasonFor(pick, a) {
  const s = pick.service;
  const why = s.why?.[a.p] ?? s.why?.base ?? "";
  if (pick.role === "explore") {
    return `まずは相談から始めたい段階とのことなので、相談だけでも使えるサービスとして、${s.why?.base ?? why}ため、選択肢としておすすめです。`;
  }
  if (pick.role === "challenge") {
    return `${priorityLabel(a.p)}を重視されているので、これまでの経験を活かした挑戦の選択肢として、${why}ため、あわせてご紹介します。`;
  }
  const lead = `今回の回答（${jobShort(a)}／${ageLabel(a.g)}／重視：${priorityLabel(a.p)}）では、`;
  return `${lead}${why}ため、候補になります。`;
}
