// LINE Messaging API クライアント（Web標準APIのみ使用: Cloudflare Workers / Node 18+ で動作）

const enc = new TextEncoder();

function b64(buf) {
  let s = "";
  for (const b of new Uint8Array(buf)) s += String.fromCharCode(b);
  return btoa(s);
}

/** X-Line-Signature を検証する（HMAC-SHA256 + 定数時間比較） */
export async function verifySignature(secret, rawBody, signature) {
  if (!secret || !signature) return false;
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = b64(await crypto.subtle.sign("HMAC", key, enc.encode(rawBody)));
  if (mac.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < mac.length; i++) diff |= mac.charCodeAt(i) ^ signature.charCodeAt(i);
  return diff === 0;
}

export class LineError extends Error {
  constructor(status, body, where) {
    super(`LINE API ${where} failed: ${status} ${typeof body === "string" ? body : JSON.stringify(body)}`);
    this.status = status;
    this.body = body;
  }
}

export function makeClient(env) {
  const base = env.LINE_API_BASE || "https://api.line.me";
  const token = env.LINE_CHANNEL_ACCESS_TOKEN;

  async function call(method, path, body) {
    const res = await fetch(base + path, {
      method,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const raw = await res.text();
    let data = raw;
    try { data = raw ? JSON.parse(raw) : {}; } catch { /* 非JSON */ }
    if (!res.ok) throw new LineError(res.status, data, `${method} ${path}`);
    return data;
  }

  return {
    reply: (replyToken, messages) => call("POST", "/v2/bot/message/reply", { replyToken, messages: messages.slice(0, 5) }),
    push: (to, messages) => call("POST", "/v2/bot/message/push", { to, messages: messages.slice(0, 5) }),
    profile: (userId) => call("GET", `/v2/bot/profile/${encodeURIComponent(userId)}`),
    validateReply: (messages) => call("POST", "/v2/bot/message/validate/reply", { messages }),
    call,
  };
}
