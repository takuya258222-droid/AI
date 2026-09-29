// noteの最新記事（RSS）の取得と、カード・週次配信の組み立て。
// RSSはWorkersのキャッシュに30分置く（KVの書き込みを使わない）。取得に失敗したら、空で返して既存の表示にもどす。
import { brand } from "./content.mjs";
import { jstDate, jstHour } from "./stats.mjs";
import { C, text, box, uri, postback, ghost, eyebrow, bubble, heroImage, bodyBox, footerBox, flexMessage, carousel, clip } from "./flex.mjs";

const decode = (s) =>
  s.replace(/^<!\[CDATA\[|\]\]>$/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => { try { return String.fromCodePoint(+n); } catch { return ""; } });
const tag = (block, name) => block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`))?.[1]?.trim() ?? "";

/** RSS(XML文字列) → [{title, link, ts, thumb}]（新しい順） */
export function parseFeed(xml) {
  const out = [];
  for (const m of String(xml || "").matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const b = m[1];
    const title = decode(tag(b, "title"));
    const link = decode(tag(b, "link"));
    const ts = Date.parse(tag(b, "pubDate"));
    let thumb = decode(tag(b, "media:thumbnail"));
    if (!/^https:\/\//.test(thumb) || thumb.length > 900) thumb = "";
    if (!title || !/^https:\/\/note\.com\//.test(link) || link.length > 900 || !Number.isFinite(ts)) continue;
    out.push({ title, link, ts, thumb });
  }
  return out.sort((a, b) => b.ts - a.ts);
}

/** 最新のnote記事を取得（失敗時は空配列） */
export async function latestNotes(env = {}, { limit = 6 } = {}) {
  if (env.__noteFeed !== undefined) return parseFeed(env.__noteFeed).slice(0, limit); // テスト用
  const url = `${brand.note.profileUrl}/rss`;
  try {
    const cache = typeof caches !== "undefined" ? caches.default : null;
    const req = new Request(url);
    let res = cache ? await cache.match(req) : null;
    if (!res) {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 3500);
      try { res = await fetch(url, { signal: ctl.signal, headers: { "user-agent": "career-line-bot" } }); } finally { clearTimeout(timer); }
      if (!res.ok) return [];
      if (cache) {
        const body = await res.clone().text();
        await cache.put(req, new Response(body, { headers: { "content-type": "application/xml", "cache-control": "public, max-age=1800" } })).catch(() => {});
      }
    }
    return parseFeed(await res.text()).slice(0, limit);
  } catch (e) {
    console.log(JSON.stringify({ evt: "notefeed_error", msg: String(e).slice(0, 100) }));
    return [];
  }
}

const dateLabel = (ts) => { const d = new Date(ts + 9 * 3600 * 1000); return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`; };

export function latestNoteBubble(n) {
  return bubble({
    hero: n.thumb ? heroImage(n.thumb, "1.91:1") : undefined,
    body: bodyBox([eyebrow(`NEW｜${dateLabel(n.ts)}`), text(clip(n.title, 110), { size: "sm", weight: "bold", color: C.navy, margin: "sm", maxLines: 5 })], { paddingAll: "16px" }),
    footer: footerBox([ghost("noteで読む", uri("noteで読む", n.link), { size: "xs", padding: "9px" })]),
  });
}

// ---- 職種 → 記事タイトルの判定（タイトルの【看護師】などの見出しで判定）----
const JOB_RE = {
  nurse: /看護/, care: /介護/, pharm: /薬剤/, child: /保育/, medother: /リハビリ|理学療法|作業療法|言語聴覚|医療事務|医療/, dis: /障がい|障害/,
  it_none: /IT|エンジニア|SaaS|プログラ|開発/, it_jr: /IT|エンジニア|SaaS|プログラ|開発/, it_sr: /IT|エンジニア|SaaS|プログラ|開発/, it_free: /IT|エンジニア|SaaS|フリーランス|開発/,
  consul: /コンサル/, ma: /M&A|M＆A|FAS|VC|PE|ファンド/, bizsales: /営業/, retail: /販売|接客|アパレル/, office: /事務/,
  mfg: /製造|工場|メーカー/, eng: /技術|設計|メーカー|品質/, const: /建築|施工|設備|工事/, logi: /物流|ドライバー|運送/,
};
export const matchJob = (key, title) => JOB_RE[key]?.test(title) ?? false;

/** 購読者に送る記事を選ぶ。職種が決まっている人には、その職種の新着だけ（なければ送らない） */
export function pickFor(key, items, since) {
  const fresh = items.filter((n) => n.ts > since);
  const list = JOB_RE[key] ? fresh.filter((n) => matchJob(key, n.title)) : fresh;
  return list.slice(0, 3);
}

export function digestMessage(list) {
  const last = bubble({
    body: bodyBox([
      eyebrow("NOTE"),
      text("今週の新着noteです", { size: "md", weight: "bold", color: C.navy, margin: "sm" }),
      text(`配信を止めるときは、「${brand.followup.stopKeyword}」と送信してください。`, { size: "xs", color: C.muted, margin: "md" }),
      text("※note内に、紹介リンク（PR）を含む場合があります。", { size: "xxs", color: C.muted, margin: "sm" }),
    ], { justifyContent: "center" }),
    footer: footerBox([ghost("転職体験記の一覧", postback("転職体験記", "taiken", "転職体験記"), { size: "xs", padding: "9px" })]),
  });
  return flexMessage(`今週の新着note：${clip(list[0].title, 60)}`, carousel([...list.map(latestNoteBubble), last]));
}

const WEEK = 7 * 24 * 3600 * 1000;

/** 新着noteの購読の記録（メタデータに職種・配信済みの日付を持たせ、値を読まずに判定する） */
export const subRecord = (k, ts, dg = "") => ({ value: { k, ts }, meta: { k, ts, dg } });

/**
 * 毎週土曜 日本時間10〜15時の間に、購読者へ新着noteを配信（Cronから毎時呼ぶ。1週1回まで）。
 * 1回のCronで送る人数には上限（max）があり、残りは次の時間に送る（無料プランのCPU時間の制限のため）。
 */
export async function runDigest({ store, client, env = {}, now = Date.now(), budget, max = 6 }) {
  if (!store) return { skipped: "no-store" };
  const jst = new Date(now + 9 * 3600 * 1000);
  const hour = jstHour(now);
  if (jst.getUTCDay() !== 6 || hour < 10 || hour > 15) return { skipped: "not-saturday-10-15" };
  const today = jstDate(now);
  const mark = `nd:${today}`;
  let st = await store.get(mark);
  if (!st) {
    // その週の最初の実行: 「前回の配信」以降を新着として扱い、次の週の起点をいまに更新する
    st = { since: (await store.get("nd:last"))?.t ?? now - WEEK };
    await store.put(mark, st, 14 * 24 * 3600);
    await store.put("nd:last", { t: now }, 30 * 24 * 3600);
  }
  const items = await latestNotes(env, { limit: 25 });
  if (!items.some((n) => n.ts > st.since)) return { skipped: "no-new-notes" };
  const res = { subs: 0, sent: 0, skippedNoMatch: 0, skippedBudget: 0, skippedCap: 0, removed: 0 };
  const metas = store.listMeta ? await store.listMeta("sub:") : (await store.list("sub:")).map((name) => ({ name, metadata: null }));
  for (const { name, metadata } of metas) {
    let meta = metadata;
    if (!meta || meta.k === undefined) { const r = await store.get(name); if (!r) continue; meta = { k: r.k ?? "", ts: r.ts ?? now, dg: "" }; }
    if (meta.dg === today) continue; // 今日、送信済み
    res.subs++;
    const list = pickFor(meta.k, items, st.since);
    if (!list.length) { res.skippedNoMatch++; continue; }
    if (res.sent >= max) { res.skippedCap++; continue; }
    if (budget && !budget.take(1)) { res.skippedBudget++; continue; }
    // 先に「今日は送信済み」に更新してから送る（保存に失敗したら送らない）
    const rec = subRecord(meta.k, meta.ts, today);
    try { await store.put(name, rec.value, 180 * 24 * 3600, rec.meta); } catch { budget?.refund(1); continue; }
    try {
      await client.push(name.slice(4), [digestMessage(list)]);
      res.sent++;
    } catch (e) {
      budget?.refund(1);
      if (e.status && e.status >= 400 && e.status < 500 && e.status !== 429) { await store.delete(name); res.removed++; }
      else { const back = subRecord(meta.k, meta.ts, ""); await store.put(name, back.value, 180 * 24 * 3600, back.meta); }
      if (e.status === 429) break;
    }
  }
  return res;
}
