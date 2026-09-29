// Flex Message の共通パーツ（紺×ゴールドのデザインシステム）

export const C = {
  navy: "#0A1729",
  navy2: "#132A47",
  gold: "#C9A567",
  goldDeep: "#9A7737",
  goldSoft: "#F3E7CC",
  ivory: "#F7F1E3",
  paper: "#FBF8F1",
  ink: "#1B2430",
  muted: "#6B7480",
  rule: "#E6DFD0",
  border: "#D9CBA8",
  white: "#FFFFFF",
};

export const clip = (s, n) => (s.length > n ? s.slice(0, n - 1) + "…" : s);
export const imgUrl = (base, path) => `${base}/img/${path}`;

// ---- 基本要素 ----
export const text = (t, o = {}) => ({ type: "text", text: t, wrap: true, size: "sm", color: C.ink, ...o });
export const box = (layout, contents, o = {}) => ({ type: "box", layout, contents, ...o });
export const sep = (margin = "md") => ({ type: "separator", margin, color: C.rule });
export const spacer = (size = "md") => box("vertical", [], { height: size === "sm" ? "6px" : size === "lg" ? "18px" : "12px" });

// ---- アクション ----
export const uri = (label, url) => ({ type: "uri", label: clip(label, 20), uri: url });
export const postback = (label, data, displayText) => ({
  type: "postback",
  label: clip(label, 20),
  data,
  ...(displayText ? { displayText: clip(displayText, 300) } : {}),
});

// ---- ボタン ----
/** ゴールドのCTAボタン */
export function cta(label, action, o = {}) {
  return box("vertical", [text(label, { align: "center", weight: "bold", color: C.navy, size: o.size ?? "md" })], {
    paddingAll: o.padding ?? "14px",
    cornerRadius: "28px",
    background: { type: "linearGradient", angle: "90deg", startColor: "#E9D39C", endColor: "#C9A567" },
    action,
  });
}
/** 枠線のボタン */
export function ghost(label, action, o = {}) {
  return box("vertical", [text(label, { align: "center", weight: "bold", color: C.navy, size: o.size ?? "sm" })], {
    paddingAll: o.padding ?? "11px",
    cornerRadius: "28px",
    borderWidth: "1px",
    borderColor: C.gold,
    action,
  });
}
/** テキストリンク風の小さなボタン */
export const linkBtn = (label, action) => ({ type: "button", style: "link", height: "sm", color: C.goldDeep, action: { ...action, label: clip(label, 20) } });

// ---- 部品 ----
/** 小さなラベル（ゴールド） */
export const eyebrow = (t) => text(t, { size: "xxs", weight: "bold", color: C.goldDeep });

/** 角丸の小さなバッジ */
export function badge(t, o = {}) {
  return box(
    "horizontal",
    [
      box("vertical", [text(t, { size: "xxs", weight: "bold", color: o.color ?? C.gold, wrap: false })], {
        flex: 0,
        paddingTop: "3px",
        paddingBottom: "3px",
        paddingStart: "10px",
        paddingEnd: "10px",
        cornerRadius: "12px",
        backgroundColor: o.bg ?? C.navy,
      }),
      box("vertical", [], { flex: 1 }),
    ],
    {}
  );
}

/** ✓ 付きの箇条書き */
export function checkRow(t, o = {}) {
  return box(
    "horizontal",
    [
      text("✓", { size: o.size ?? "sm", color: C.goldDeep, weight: "bold", flex: 0, wrap: false }),
      text(t, { size: o.size ?? "sm", color: o.color ?? C.ink, flex: 1, margin: "sm" }),
    ],
    { margin: o.margin ?? "sm" }
  );
}
/** ・付きの小さな箇条書き */
export function dotRow(t, o = {}) {
  return box(
    "horizontal",
    [text("・", { size: o.size ?? "xs", color: C.muted, flex: 0, wrap: false }), text(t, { size: o.size ?? "xs", color: o.color ?? C.muted, flex: 1 })],
    { margin: o.margin ?? "xs" }
  );
}
/** 番号付きステップ行 */
export function stepRow(n, t, sub) {
  return box(
    "horizontal",
    [
      box("vertical", [text(String(n), { size: "xs", weight: "bold", color: C.navy, align: "center", wrap: false })], {
        flex: 0,
        width: "24px",
        height: "24px",
        cornerRadius: "12px",
        backgroundColor: C.gold,
        justifyContent: "center",
      }),
      box("vertical", [text(t, { size: "sm", weight: "bold" }), ...(sub ? [text(sub, { size: "xs", color: C.muted, margin: "xs" })] : [])], { flex: 1, margin: "md" }),
    ],
    { margin: "md", alignItems: "flex-start" }
  );
}
/** 見出し + 本文の行 */
export const kv = (k, v) =>
  box("horizontal", [text(k, { size: "xs", color: C.muted, flex: 3 }), text(v, { size: "sm", weight: "bold", flex: 6 })], { margin: "sm" });

/** ivory色のパネル */
export const panel = (contents, o = {}) =>
  box("vertical", contents, { backgroundColor: C.ivory, cornerRadius: "10px", paddingAll: o.padding ?? "12px", margin: o.margin ?? "md", ...(o.border ? { borderWidth: "1px", borderColor: C.border } : {}) });

// ---- バブル ----
export function bubble({ hero, body, footer, size = "mega" }) {
  return {
    type: "bubble",
    size,
    ...(hero ? { hero } : {}),
    ...(body ? { body } : {}),
    ...(footer ? { footer } : {}),
    styles: { body: { backgroundColor: C.white }, footer: { backgroundColor: C.white } },
  };
}
export const heroImage = (url, ratio = "20:9") => ({ type: "image", url, size: "full", aspectRatio: ratio, aspectMode: "cover" });
export const bodyBox = (contents, o = {}) => box("vertical", contents, { paddingAll: "18px", spacing: "none", ...o });
export const footerBox = (contents, o = {}) => box("vertical", contents, { paddingTop: "4px", paddingBottom: "16px", paddingStart: "18px", paddingEnd: "18px", spacing: "sm", ...o });
export const flexMessage = (altText, contents) => ({ type: "flex", altText: clip(altText, 380), contents });
export const carousel = (bubbles) => ({ type: "carousel", contents: bubbles });

/** 5段階の進捗バー */
export function progress(step, total = 5) {
  const segs = Array.from({ length: total }, (_, i) => box("vertical", [], { flex: 1, height: "4px", cornerRadius: "2px", backgroundColor: i < step ? C.gold : C.rule }));
  return box("horizontal", segs, { spacing: "xs", margin: "md" });
}

/** 縦棒の分布グラフ。bars=[{label,pct,active}] */
export function histogram(bars, maxPct) {
  const cols = bars.map((b) => {
    const h = Math.max(6, Math.round((b.pct / maxPct) * 100));
    return box(
      "vertical",
      [
        box(
          "vertical",
          [box("vertical", [], { flex: 100 - h }), box("vertical", [], { flex: h, backgroundColor: b.active ? C.gold : "#E4DAC0", cornerRadius: "3px" })],
          { height: "76px" }
        ),
        text(b.label, { size: "xxs", align: "center", color: b.active ? C.goldDeep : C.muted, weight: b.active ? "bold" : "regular", margin: "sm", wrap: false }),
        text(`${b.pct}%`, { size: "xxs", align: "center", color: b.active ? C.navy : C.muted, weight: b.active ? "bold" : "regular", wrap: false }),
      ],
      { flex: 1 }
    );
  });
  return box("horizontal", cols, { spacing: "sm", margin: "md" });
}
