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

  // タイムアウト(8秒)と、一時的なエラー(429/5xx/通信エラー)の1回だけの再試行つき
  async function call(method, path, body, { retry = true } = {}) {
    let lastErr;
    for (let attempt = 0; attempt < (retry ? 2 : 1); attempt++) {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 8000);
      try {
        const res = await fetch(base + path, {
          method,
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: body ? JSON.stringify(body) : undefined,
          signal: ctl.signal,
        });
        const raw = await res.text();
        let data = raw;
        try { data = raw ? JSON.parse(raw) : {}; } catch { /* 非JSON */ }
        if (res.ok) return data;
        lastErr = new LineError(res.status, data, `${method} ${path}`);
        if (!(res.status === 429 || res.status >= 500)) throw lastErr; // 4xxはやり直しても同じ
      } catch (e) {
        if (e instanceof LineError && !(e.status === 429 || e.status >= 500)) throw e;
        lastErr = e instanceof LineError ? e : new LineError(0, String(e), `${method} ${path} (network/timeout)`);
      } finally {
        clearTimeout(timer);
      }
      if (attempt === 0 && retry) await new Promise((r) => setTimeout(r, 300));
    }
    throw lastErr;
  }

  return {
    reply: (replyToken, messages) => call("POST", "/v2/bot/message/reply", { replyToken, messages: messages.slice(0, 5) }),
    push: (to, messages) => call("POST", "/v2/bot/message/push", { to, messages: messages.slice(0, 5) }),
    profile: (userId) => call("GET", `/v2/bot/profile/${encodeURIComponent(userId)}`),
    validateReply: (messages) => call("POST", "/v2/bot/message/validate/reply", { messages }),
    call,
  };
}
