import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, resolve, sep } from "node:path";

const root = resolve(process.argv[2] ?? "apps/mobile/.expo-live-preview");
const port = Number(process.argv[3] ?? 8104);

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ttf": "font/ttf",
  ".webp": "image/webp",
};

function safeCandidate(pathname) {
  const relative = decodeURIComponent(pathname).replace(/^\/+/, "");
  const candidate = resolve(root, relative || "index.html");
  return candidate === root || candidate.startsWith(`${root}${sep}`)
    ? candidate
    : undefined;
}

function existingFile(path) {
  return path && existsSync(path) && statSync(path).isFile() ? path : undefined;
}

createServer((request, response) => {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405).end();
    return;
  }
  const pathname = new URL(request.url ?? "/", "http://127.0.0.1").pathname;
  const candidate = safeCandidate(pathname);
  const file =
    existingFile(candidate) ??
    existingFile(candidate ? `${candidate}.html` : undefined) ??
    existingFile(resolve(root, "index.html"));
  if (!file) {
    response.writeHead(404).end("Preview not found");
    return;
  }
  response.writeHead(200, {
    "Cache-Control": "no-store",
    "Content-Type": contentTypes[extname(file).toLowerCase()] ?? "application/octet-stream",
  });
  if (request.method === "HEAD") response.end();
  else createReadStream(file).pipe(response);
}).listen(port, "127.0.0.1", () => {
  process.stdout.write(`Expo preview: http://127.0.0.1:${port}/\n`);
});
