const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
const HOST = "0.0.0.0";
const BASE_DIR = __dirname;

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".ico": "image/x-icon",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml; charset=utf-8",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".glb": "model/gltf-binary",
  ".gltf": "model/gltf+json",
  ".wasm": "application/wasm",
  ".map": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
};

function resolveRequestPath(urlPath) {
  let pathname = decodeURIComponent(urlPath || "/");

  if (pathname === "/" || pathname === "/index" || pathname === "/home") {
    pathname = "/index.html";
  } else if (pathname === "/algorithm" || pathname === "/algorithms" || pathname === "/algorithm-map") {
    pathname = "/algorithm-map.html";
  }

  const normalised = path.normalize(pathname).replace(/^(\.\.(\/|\\|$))+/, "");
  return path.join(BASE_DIR, normalised);
}

function serveFile(filePath, res) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";
  const isText = contentType.includes("charset=utf-8");
  const encoding = isText ? "utf8" : undefined;

  fs.readFile(filePath, encoding, (error, data) => {
    if (error) {
      if (error.code === "ENOENT") {
        res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("404 Not Found");
        return;
      }
      res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("500 Internal Server Error");
      return;
    }

    res.writeHead(200, { "Content-Type": contentType });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  const requestUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  let filePath = resolveRequestPath(requestUrl.pathname);

  try {
    const stat = fs.existsSync(filePath) ? fs.statSync(filePath) : null;
    if (stat && stat.isDirectory()) {
      filePath = path.join(filePath, "index.html");
    }
    if (!stat || !fs.existsSync(filePath)) {
      filePath = path.join(BASE_DIR, "index.html");
    }
  } catch (error) {
    filePath = path.join(BASE_DIR, "index.html");
  }

  serveFile(filePath, res);
});

server.listen(PORT, HOST, () => {
  console.log(`🚀 Unified Homepage Server running at http://localhost:${PORT}`);
  console.log("   - Algorithm Overview: http://localhost:3000/algorithm-map.html");
  console.log("   - Prediction Frontend: http://localhost:5173");
  console.log("   - Training Frontend:   http://localhost:5174");
});
