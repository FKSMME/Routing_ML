const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const PORT = Number(process.env.PORT || 3000);
const USE_HTTPS = process.env.USE_HTTPS === "true" || false;
const HOST = "0.0.0.0";
const BASE_DIR = __dirname;
const API_TARGET = process.env.API_TARGET || "http://localhost:8000";
const API_URL = new URL(API_TARGET);

// SSL Certificate paths
const SSL_KEY = path.join(__dirname, "../certs/rtml.ksm.co.kr.key");
const SSL_CERT = path.join(__dirname, "../certs/rtml.ksm.co.kr.crt");

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

function getSecurityHeaders(contentType) {
  return {
    "Content-Type": contentType,
    "X-Content-Type-Options": "nosniff",
    "X-XSS-Protection": "1; mode=block",
    "X-Frame-Options": "SAMEORIGIN",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Content-Security-Policy": [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self' data:",
      "connect-src 'self' http://localhost:* http://10.204.2.28:* http://rtml.ksm.co.kr:* http://mcs.ksm.co.kr:* ws://localhost:* ws://10.204.2.28:* ws://rtml.ksm.co.kr:* ws://mcs.ksm.co.kr:*",
      "frame-ancestors 'self'",
    ].join("; "),
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
      const headers = getSecurityHeaders("text/plain; charset=utf-8");
      if (error.code === "ENOENT") {
        res.writeHead(404, headers);
        res.end("404 Not Found");
        return;
      }
      res.writeHead(500, headers);
      res.end("500 Internal Server Error");
      return;
    }

    const headers = getSecurityHeaders(contentType);
    res.writeHead(200, headers);
    res.end(data);
  });
}

function proxyToApi(req, res, requestUrl) {
  const isHttps = API_URL.protocol === "https:";
  const client = isHttps ? https : http;
  const headers = { ...req.headers };

  headers.host = API_URL.host;
  headers.origin = `${API_URL.protocol}//${API_URL.host}`;
  delete headers["accept-encoding"];

  const options = {
    hostname: API_URL.hostname,
    port: API_URL.port || (isHttps ? 443 : 80),
    path: requestUrl.pathname + requestUrl.search,
    method: req.method,
    headers,
  };

  const proxyReq = client.request(options, (proxyRes) => {
    const upstreamHeaders = { ...proxyRes.headers };
    delete upstreamHeaders["content-security-policy"];
    const securityHeaders = getSecurityHeaders(upstreamHeaders["content-type"] || "application/json; charset=utf-8");

    res.writeHead(proxyRes.statusCode || 500, { ...upstreamHeaders, ...securityHeaders });
    proxyRes.pipe(res, { end: true });
  });

  proxyReq.on("error", (error) => {
    const headers = getSecurityHeaders("application/json; charset=utf-8");
    res.writeHead(502, headers);
    res.end(JSON.stringify({
      success: false,
      message: error.code ? `API proxy error: ${error.code}` : "API proxy error",
    }));
  });

  req.pipe(proxyReq, { end: true });
}

const requestHandler = (req, res) => {
  const requestUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);

  if (requestUrl.pathname.startsWith("/api/")) {
    proxyToApi(req, res, requestUrl);
    return;
  }

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
};

let server;

if (USE_HTTPS && fs.existsSync(SSL_KEY) && fs.existsSync(SSL_CERT)) {
  const options = {
    key: fs.readFileSync(SSL_KEY),
    cert: fs.readFileSync(SSL_CERT),
  };
  server = https.createServer(options, requestHandler);
  console.log("[home] HTTPS enabled with self-signed certificate");
} else {
  server = http.createServer(requestHandler);
  console.log("[home] Running in HTTP mode");
}

server.listen(PORT, HOST, () => {
  const protocol = USE_HTTPS ? "https" : "http";
  console.log(`[home] listening on ${protocol}://localhost:${PORT}`);
  console.log(`        algorithm map:    ${protocol}://localhost:${PORT}/algorithm-map.html`);
  console.log(`        sql view explorer: ${protocol}://localhost:${PORT}/view-explorer.html`);
  console.log(`        domain access:    ${protocol}://rtml.ksm.co.kr:${PORT}`);
});
