// LINE Flex Message をHTMLに描画する共通関数（開発用の簡易プレビュー。LINE実機とは細部が異なります）
import fs from "node:fs";

const KW = { none: 0, xs: 2, sm: 4, md: 8, lg: 12, xl: 16, xxl: 20 };
const px = (v, d = 0) => (v == null ? d : typeof v === "number" ? v : KW[v] ?? parseFloat(v));
const FS = { xxs: 10, xs: 12, sm: 14, md: 16, lg: 19, xl: 22, xxl: 25, "3xl": 30 };
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/\n/g, "<br>");
const W = { nano: 120, micro: 160, kilo: 260, mega: 300, giga: 340 };

function styleBox(n, parent) {
  const s = [];
  if (n.flex != null) s.push(`flex:${n.flex} ${n.flex === 0 ? 0 : 1} ${n.flex === 0 ? "auto" : "0"}`);
  else if (parent?.layout === "horizontal") s.push("flex:1 1 0");
  if (n.width) s.push(`width:${n.width}`);
  if (n.height) s.push(`height:${n.height}`);
  if (n.margin) s.push(`margin-${parent?.layout === "horizontal" ? "left" : "top"}:${px(n.margin)}px`);
  for (const k of ["paddingAll", "paddingTop", "paddingBottom", "paddingStart", "paddingEnd"]) {
    if (n[k] != null) s.push(`${{ paddingAll: "padding", paddingTop: "padding-top", paddingBottom: "padding-bottom", paddingStart: "padding-left", paddingEnd: "padding-right" }[k]}:${px(n[k])}px`);
  }
  if (n.backgroundColor) s.push(`background:${n.backgroundColor}`);
  if (n.background?.type === "linearGradient") s.push(`background:linear-gradient(${n.background.angle},${n.background.startColor},${n.background.endColor})`);
  if (n.cornerRadius) s.push(`border-radius:${px(n.cornerRadius)}px`);
  if (n.borderWidth) s.push(`border:${px(n.borderWidth, 1)}px solid ${n.borderColor || "#ccc"}`);
  if (n.justifyContent) s.push(`justify-content:${{ "flex-start": "flex-start", center: "center", "flex-end": "flex-end", "space-between": "space-between" }[n.justifyContent] || "flex-start"}`);
  if (n.alignItems) s.push(`align-items:${n.alignItems}`);
  return s.join(";");
}

export function node(n, parent) {
  switch (n.type) {
    case "box": {
      const gap = n.spacing ? px(n.spacing) : 0;
      const kids = n.contents.map((c) => node(c, n)).join("");
      return `<div style="display:flex;flex-direction:${n.layout === "horizontal" ? "row" : "column"};${gap ? `gap:${gap}px;` : ""}box-sizing:border-box;min-width:0;${styleBox(n, parent)}">${kids}</div>`;
    }
    case "text": {
      const st = [`font-size:${FS[n.size || "md"]}px`, `color:${n.color || "#111"}`, `font-weight:${n.weight === "bold" ? 700 : 400}`, `text-align:${{ start: "left", end: "right", center: "center" }[n.align] || "left"}`, "line-height:1.45", "min-width:0"];
      if (n.flex != null) st.push(`flex:${n.flex} ${n.flex === 0 ? 0 : 1} ${n.flex === 0 ? "auto" : "0"}`);
      else if (parent?.layout === "horizontal") st.push("flex:1 1 0");
      if (n.margin) st.push(`margin-${parent?.layout === "horizontal" ? "left" : "top"}:${px(n.margin)}px`);
      if (n.wrap === false) st.push("white-space:nowrap");
      if (n.maxLines) st.push(`display:-webkit-box;-webkit-line-clamp:${n.maxLines};-webkit-box-orient:vertical;overflow:hidden`);
      return `<div style="${st.join(";")}">${esc(n.text)}</div>`;
    }
    case "separator":
      return `<div style="height:1px;background:${n.color || "#ddd"};margin-top:${px(n.margin, 0)}px"></div>`;
    case "button": {
      const link = n.style === "link";
      return `<div style="text-align:center;padding:${link ? 8 : 12}px;color:${n.color || "#0a66ff"};font-size:14px;margin-top:0">${esc(n.action.label)}</div>`;
    }
    case "image": {
      const f = n.url.replace("file://", "");
      const src = fs.existsSync(f) ? `data:image/${f.endsWith(".png") ? "png" : "jpeg"};base64,${fs.readFileSync(f).toString("base64")}` : n.url;
      return `<img src="${src}" style="width:100%;aspect-ratio:${(n.aspectRatio || "1:1").replace(":", "/")};object-fit:cover;display:block">`;
    }
    default:
      return "";
  }
}

export function bubbleHtml(b) {
  const w = W[b.size || "mega"];
  const part = (p, k) => (p ? `<div style="background:${b.styles?.[k]?.backgroundColor || "#fff"}">${node(p, null)}</div>` : "");
  return `<div style="width:${w}px;flex:none;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.25);font-family:'Noto Sans JP',sans-serif">${b.hero ? node(b.hero, null) : ""}${part(b.body, "body")}${part(b.footer, "footer")}</div>`;
}

