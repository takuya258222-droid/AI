// Node.js 用サーバー（Render / Railway / ローカル確認用）。 起動: npm start
// ※フォロー配信・集計に使うKVは無いため、これらの機能は無効になります（診断・応答は同じように動作）。
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { handleRequest } from "../core/app.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../public");
const MIME = { ".jpg": "image/jpeg", ".png": "image/png", ".html": "text/html; charset=utf-8", ".css": "text/css", ".svg": "image/svg+xml" };
const PORT = Number(process.env.PORT || 3000);

http
  .createServer(async (req, res) => {
    try {
      const url = new URL(req.url, `http://${req.headers.host}`);
      // 静的ファイル
      if (req.method === "GET" && url.pathname !== "/health") {
        const rel = url.pathname === "/" ? "/index.html" : url.pathname;
        const file = path.normalize(path.join(ROOT, rel));
        if (file.startsWith(ROOT) && fs.existsSync(file) && fs.statSync(file).isFile()) {
          res.writeHead(200, { "content-type": MIME[path.extname(file)] || "application/octet-stream", "cache-control": "public, max-age=3600" });
          return fs.createReadStream(file).pipe(res);
        }
      }
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const proto = req.headers["x-forwarded-proto"] || "http";
      const request = new Request(`${proto}://${req.headers.host}${req.url}`, {
        method: req.method,
        headers: req.headers,
        body: ["GET", "HEAD"].includes(req.method) ? undefined : Buffer.concat(chunks),
      });
      const response = await handleRequest(request, process.env, {});
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(Buffer.from(await response.arrayBuffer()));
    } catch (e) {
      console.log(JSON.stringify({ evt: "fatal", msg: String(e).slice(0, 300) }));
      res.writeHead(500).end("internal error");
    }
  })
  .listen(PORT, () => console.log(`career-line-bot listening on :${PORT}`));
