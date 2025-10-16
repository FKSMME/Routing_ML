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

/**
 * Security headers for HTTP responses
 *
 * IMPORTANT: These headers assume the server is behind an HTTPS reverse proxy.
 * In production, ensure you have:
 * - HTTPS termination at reverse proxy level (nginx, Apache, Caddy, etc.)
 * - Proper SSL/TLS certificate configuration
 * - HSTS enabled on the proxy if needed
 *
 * This Node.js server serves HTTP only - HTTPS should be handled by the proxy.
 */
function getSecurityHeaders(contentType) {
  return {
    "Content-Type": contentType,
    // Prevent MIME type sniffing
    "X-Content-Type-Options": "nosniff",
    // Enable XSS filter in browsers
    "X-XSS-Protection": "1; mode=block",
    // Control iframe embedding (SAMEORIGIN allows same-domain framing)
    "X-Frame-Options": "SAMEORIGIN",
    // Referrer policy - only send origin on cross-origin requests
    "Referrer-Policy": "strict-origin-when-cross-origin",
    // Content Security Policy - adjust as needed for your app
    "Content-Security-Policy": [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net", // Allow inline scripts and CDN
      "style-src 'self' 'unsafe-inline'", // Allow inline styles
      "img-src 'self' data: https:",
      "font-src 'self' data:",
      "connect-src 'self' http://localhost:* http://10.204.2.28:* ws://localhost:* ws://10.204.2.28:*", // Allow local API calls
      "frame-ancestors 'self'",
    ].join("; "),
    // Permissions Policy (formerly Feature-Policy)
    "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
  };
}

function serveFile(filePath, res) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";
  const isText = contentType.includes("charset=utf-8");
  const encoding = isText ? "utf8" : undefined;

  fs.readFile(filePath, encoding, (error, data) => {
    if (error) {
      if (error.code === "ENOENT") {
        const headers = getSecurityHeaders("text/plain; charset=utf-8");
        res.writeHead(404, headers);
        res.end("404 Not Found");
        return;
      }
      const headers = getSecurityHeaders("text/plain; charset=utf-8");
      res.writeHead(500, headers);
      res.end("500 Internal Server Error");
      return;
    }

    const headers = getSecurityHeaders(contentType);
    res.writeHead(200, headers);
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
