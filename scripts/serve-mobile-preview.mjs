import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, sep } from "node:path";

const root = normalize(join(process.cwd(), "apps/mobile/.expo-live-preview"));
const port = Number(process.env.E2E_PORT ?? 8104);
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

createServer(async (request, response) => {
  const pathname = decodeURIComponent(new URL(request.url ?? "/", "http://localhost").pathname);
  const target = normalize(join(root, pathname));
  if (target !== root && !target.startsWith(root + sep)) {
    response.writeHead(403).end();
    return;
  }
  try {
    const file = (await stat(target)).isDirectory() ? join(target, "index.html") : target;
    const body = await readFile(file);
    response.writeHead(200, { "content-type": mime[extname(file)] ?? "application/octet-stream" }).end(body);
  } catch {
    try {
      const body = await readFile(join(root, "index.html"));
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(body);
    } catch {
      response.writeHead(404).end("Preview not built");
    }
  }
}).listen(port, "127.0.0.1", () => {
  process.stdout.write(`Mobile preview listening at http://127.0.0.1:${port}/\n`);
});
