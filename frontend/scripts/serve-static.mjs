// Serves the SPA build (build/client) for Docker / any Node host: files as they are, every other path gets
// index.html so client-side routes like /teacher/ABC123 work on reload. No dependencies.
// On Render the site is a free Static Site instead (rewrite /* -> /index.html), which needs no server at all.
import { createServer } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";

const root = resolve(process.argv[2] ?? "build/client");
const port = Number(process.env.PORT ?? 3000);
const types = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".webmanifest": "application/manifest+json", ".png": "image/png", ".ico": "image/x-icon", ".svg": "image/svg+xml",
  ".woff2": "font/woff2", ".woff": "font/woff", ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".wav": "audio/wav",
  ".webp": "image/webp", ".gif": "image/gif", ".txt": "text/plain",
};

createServer((req, res) => {
  const path = decodeURIComponent((req.url ?? "/").split("?")[0]);
  let file = normalize(join(root, path));
  if (!file.startsWith(root)) {
    res.writeHead(403).end();
    return;
  }
  if (!existsSync(file) || statSync(file).isDirectory()) file = join(root, "index.html");
  const hashed = file.includes(`${join(root, "assets")}`);
  res.writeHead(200, {
    "Content-Type": types[extname(file)] ?? "application/octet-stream",
    // hashed bundles never change; index.html must always be fresh after a deploy
    "Cache-Control": hashed ? "public, max-age=31536000, immutable" : "no-cache",
  });
  createReadStream(file).pipe(res);
}).listen(port, () => console.log(`serving ${root} on :${port}`));
