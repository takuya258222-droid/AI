// 永続化の抽象化。本番は Cloudflare KV、テストはメモリ。
// 保存するのは「フォロー配信の宛先(userId)と診断の区分」と、個人を特定しない日次カウンターのみ。

export function memoryStore() {
  const m = new Map();
  return {
    async get(k) { return m.has(k) ? structuredClone(m.get(k)) : null; },
    async put(k, v) { m.set(k, structuredClone(v)); },
    async delete(k) { m.delete(k); },
    async list(prefix) { return [...m.keys()].filter((k) => k.startsWith(prefix)); },
    _dump: () => new Map(m),
  };
}

/** @param kv Cloudflare KVNamespace */
export function kvStore(kv) {
  return {
    async get(k) {
      const v = await kv.get(k);
      return v ? JSON.parse(v) : null;
    },
    async put(k, v, ttlSeconds) {
      await kv.put(k, JSON.stringify(v), ttlSeconds ? { expirationTtl: Math.max(60, ttlSeconds) } : undefined);
    },
    async delete(k) { await kv.delete(k); },
    async list(prefix) {
      const keys = [];
      let cursor;
      do {
        const r = await kv.list({ prefix, cursor });
        keys.push(...r.keys.map((x) => x.name));
        cursor = r.list_complete ? undefined : r.cursor;
      } while (cursor);
      return keys;
    },
  };
}

export function getStore(env) {
  return env.STORE ? kvStore(env.STORE) : env.__store ?? null;
}
