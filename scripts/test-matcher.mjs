// 振り分けロジックの総当たりテスト: node scripts/test-matcher.mjs [--show]
import { decide, keyOf, ALL_SERVICES, reasonFor } from "../src/core/matcher.mjs";
import { JOBS, SUBS, AGES, INCOMES, INCOME_UNKNOWN, PRIORITIES, TIMINGS, AREAS, incomeRank } from "../src/core/labels.mjs";

const SPECIALIST = {
  nurse: ["mc_nurse", "nursejj"],
  care: ["kaigobatake", "mc_kaigo"],
  pharm: ["mc_pharma", "phget"],
  child: ["hoikubatake"],
  dis: ["doda_challenge", "shogaisha_navi"],
};

let combos = 0, failures = [], count = {}, small = {}, noExplore = 0;
const byId = Object.fromEntries(ALL_SERVICES.map((s) => [s.id, s]));

function check(a, res) {
  const key = keyOf(a);
  const fail = (m) => failures.push(`${m} :: ${JSON.stringify(a)} -> ${res.picks?.map((p) => p.service.id)}`);
  if (res.status !== "ok") return fail("status");
  const ids = res.picks.map((p) => p.service.id);
  if (new Set(ids).size !== ids.length) fail("duplicate");
  const HIGH = key === "consul" || key === "ma";
  if (ids.length < 1 || ids.length > (HIGH ? 4 : 3)) fail("count");
  if (key === "child" && ids.length !== 1) fail("child must be 1");
  if (SPECIALIST[key]) {
    const okCount = key === "child" ? 1 : 2;
    if (ids.length !== okCount) fail("specialist count");
    if (ids.some((id) => !SPECIALIST[key].includes(id))) fail("specialist mismatch");
  }
  for (const p of res.picks) {
    const s = p.service;
    if (!s.enabled) fail("disabled " + s.id);
    if (!s.ages.includes(a.g)) fail("age " + s.id);
    const ex = s.requireExempt?.includes(key);
    if (!ex && s.require?.priorities && !s.require.priorities.includes(a.p)) fail("priority-require " + s.id);
    if (!ex && s.require?.incomeMin && incomeRank(a.i) < incomeRank(s.require.incomeMin)) fail("income-require " + s.id);
    if (s.areas && !s.areas.includes(a.r)) fail("area " + s.id);
    if (!reasonFor(p, a)) fail("reason " + s.id);
    // 専門特化サービスが他職種に出ていないか
    for (const [k, list] of Object.entries(SPECIALIST)) if (list.includes(s.id) && k !== key) fail("leak " + s.id);
    if (["factory_world", "toyota_kikan"].includes(s.id) && key !== "mfg") fail("leak " + s.id);
    if (["uzuzit", "midworks", "techgo", "techclips", "senavi", "projin"].includes(s.id) && !key.startsWith("it_") && !(s.id === "projin" || s.id === "techgo")) fail("it leak " + s.id);
    count[s.id] = (count[s.id] || 0) + 1;
  }
  if (ids.includes("workstaff_navi") && a.p !== "haken") fail("workstaff without haken");
  if (key === "const" && ["a20", "a25", "a30"].includes(a.g) && ids[0] !== "assign") fail("const must start with assign");
  if (a.p === "haken" && ["office", "logi", "retail"].includes(key) && !ids.includes("workstaff_navi")) fail("haken should show workstaff");
  // 直接雇用（正社員）寄せ: 物流・製造・技術・建築は、ASSIGN・第二新卒neoを案内する（派遣希望の人は除く）
  if (["logi", "mfg", "eng", "const"].includes(key) && a.p !== "haken") {
    if (a.g === "a30" && !ids.includes("assign")) fail("direct: assign missing (30s)");
    if (["a20", "a25"].includes(a.g)) {
      if (!ids.includes("daini_neo")) fail("direct: neo missing");
      if (ids.filter((id) => ["assign", "daini_neo", "uzuz"].includes(id)).length < 2) fail("direct: need 2 of assign/neo/uzuz");
    }
    if (["a20", "a25", "a30"].includes(a.g) && ids.slice(0, 2).includes("posiwill") && key !== "logi") fail("direct: posiwill in main");
    if (["a20", "a25"].includes(a.g) && ids.slice(0, 2).includes("posiwill")) fail("direct: posiwill in main (20s)");
  }
  if (key === "mfg" && !ids.some((id) => ["factory_world", "toyota_kikan"].includes(id))) fail("mfg must keep a factory site");
  if (a.p === "haken" && ["logi", "mfg"].includes(key) && !ids.includes("workstaff_navi")) fail("haken should keep workstaff");
  // 迷ったら3社まで案内する: 20代の非専門職は、必ず3社
  if (!SPECIALIST[key] && !HIGH && ["a20", "a25"].includes(a.g) && ids.length !== 3) fail("20s should get 3 links");
  // コンサル・M&A（ハイクラス）: 3〜4社。専門特化のサービスを先頭に
  if (HIGH) {
    if (!(a.g === "a35" && key === "ma") && ids.length < 3) fail("high-class needs 3+ links");
    if (key === "consul" && !["groovement", "myvision", "newma", "sxars"].includes(ids[0])) fail("consul: specialist first " + ids[0]);
    if (key === "ma" && !["newma", "samurai", "posiwill"].includes(ids[0])) fail("ma: specialist first " + ids[0]);
    if (key === "consul" && !ids.includes("myvision")) fail("consul: myvision missing");
    if (key === "ma" && a.g !== "a35" && !ids.includes("newma")) fail("ma: newma missing");
  }
  // コンサル・M&A用のサービスが他の職種に出ていないこと
  if (!HIGH && ids.includes("myvision")) fail("consul/ma leak " + ids);
  if (ids.length < 2 && key !== "child") small[key] = (small[key] || 0) + 1;
  if (key === "it_none" && a.g === "a35" && ids.some((i) => ["uzuzit", "projin"].includes(i))) fail("it_none 35+");
}

const show = process.argv.includes("--show");
for (const job of JOBS) {
  const subs = SUBS[job.v] ? SUBS[job.v].options.map((o) => o.v) : [undefined];
  for (const s of subs)
    for (const g of AGES)
      for (const i of [...INCOMES, INCOME_UNKNOWN])
        for (const p of PRIORITIES)
          for (const t of TIMINGS) {
            const a = { j: job.v, s, g: g.v, i: i.v, p: p.v, t: t.v };
            let res = decide(a);
            if (res.status === "need_area") {
              for (const r of AREAS) {
                const b = { ...a, r: r.v };
                const rr = decide(b);
                combos++; check(b, rr);
              }
              continue;
            }
            combos++; check(a, res);
          }
}

console.log(`combos=${combos} failures=${failures.length}`);
failures.slice(0, 15).forEach((f) => console.log("  FAIL", f));
console.log("\n[picks per service]");
Object.entries(count).sort((x, y) => y[1] - x[1]).forEach(([id, n]) => console.log(`  ${id.padEnd(16)} ${n}`));
const never = ALL_SERVICES.filter((s) => s.enabled && !count[s.id]).map((s) => s.id);
console.log("never shown:", never.join(", ") || "-");
console.log("picks<2 by key:", JSON.stringify(small));

if (show) {
  const samples = [
    { j: "med", s: "nurse", g: "a30", i: "i5", p: "wl", t: "m3" },
    { j: "med", s: "care", g: "a25", i: "i3", p: "new", t: "now" },
    { j: "med", s: "child", g: "a25", i: "i3", p: "fit", t: "info" },
    { j: "it", s: "it_none", g: "a25", i: "i3", p: "new", t: "now", r: "kanto" },
    { j: "it", s: "it_sr", g: "a30", i: "i7", p: "up", t: "m3" },
    { j: "sales", s: "bizsales", g: "a25", i: "i4", p: "up", t: "m3" },
    { j: "sales", s: "bizsales", g: "a35", i: "i5", p: "car", t: "m6" },
    { j: "office", g: "a30", i: "i3", p: "wl", t: "info" },
    { j: "tech", s: "mfg", g: "a25", i: "i3", p: "up", t: "now" },
    { j: "logi", g: "a35", i: "i3", p: "wl", t: "m6" },
    { j: "other", s: "dis", g: "a30", i: "ix", p: "wl", t: "m3" },
    { j: "const", g: "a25", i: "i4", p: "up", t: "m3" },
  ];
  for (const a of samples) {
    const r = decide(a);
    console.log("\n", JSON.stringify(a));
    if (r.status !== "ok") { console.log("  ->", r.status); continue; }
    r.picks.forEach((p) => console.log(`   ${p.role.padEnd(8)} ${p.service.name} (${p.score})\n      ${reasonFor(p, a)}`));
    r.notes.forEach((n) => console.log("   note:", n));
  }
}
process.exit(failures.length ? 1 : 0);
