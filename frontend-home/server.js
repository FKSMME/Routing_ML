const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const PORT = Number(process.env.PORT || 5176);
const envHttps = process.env.USE_HTTPS;
const USE_HTTPS = envHttps === undefined ? true : envHttps.toLowerCase() === "true";
const HOST = "0.0.0.0";
const BASE_DIR = __dirname;
const API_TARGET = process.env.API_TARGET || "https://localhost:8000";
const API_URL = new URL(API_TARGET);
const HTTP_REDIRECT_PORT = Number(process.env.HTTP_REDIRECT_PORT || 0);
const REDIRECT_HOST = process.env.REDIRECT_HOST || null;

// SSL Certificate paths
const CERT_SEARCH_PATHS = [
  path.join(__dirname, "../certs"),
  path.join(__dirname, "certs"),
  path.join(process.cwd(), "certs"),
];

const resolveCertPath = (explicitPath, filename) => {
  if (explicitPath) {
    const resolved = path.resolve(explicitPath);
    if (fs.existsSync(resolved)) {
      return resolved;
    }
  }

  for (const base of CERT_SEARCH_PATHS) {
    const candidate = path.join(base, filename);
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
};

const SSL_KEY = resolveCertPath(process.env.SSL_KEY_PATH, "rtml.ksm.co.kr.key");
const SSL_CERT = resolveCertPath(process.env.SSL_CERT_PATH, "rtml.ksm.co.kr.crt");

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
      "connect-src 'self' http://localhost:* https://localhost:* http://10.204.2.28:* https://10.204.2.28:* https://rtml.ksm.co.kr:* https://mcs.ksm.co.kr:* ws://localhost:* wss://localhost:* ws://10.204.2.28:* wss://10.204.2.28:* ws://rtml.ksm.co.kr:* wss://rtml.ksm.co.kr:* ws://mcs.ksm.co.kr:* wss://mcs.ksm.co.kr:*",
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
    rejectUnauthorized: false, // Allow self-signed certificates
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

const HTTPS_READY = USE_HTTPS && SSL_KEY && SSL_CERT;

if (USE_HTTPS && !HTTPS_READY) {
  console.error("[home] USE_HTTPS is true but certificate files were not found.");
  if (!SSL_KEY) {
    console.error("        Missing key file. Checked paths:", CERT_SEARCH_PATHS.map((p) => path.join(p, "rtml.ksm.co.kr.key")).join(", "));
  }
  if (!SSL_CERT) {
    console.error("        Missing certificate file. Checked paths:", CERT_SEARCH_PATHS.map((p) => path.join(p, "rtml.ksm.co.kr.crt")).join(", "));
  }
  console.error("        Set SSL_KEY_PATH and SSL_CERT_PATH to valid files or set USE_HTTPS=false.");
  process.exit(1);
}

let server;
let redirectServer;

if (HTTPS_READY) {
  const options = {
    key: fs.readFileSync(SSL_KEY),
    cert: fs.readFileSync(SSL_CERT),
  };
  server = https.createServer(options, requestHandler);
  console.log("[home] HTTPS enabled with certificate:", SSL_CERT);
} else {
  server = http.createServer(requestHandler);
  console.log("[home] Running in HTTP mode");
}

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`[home] Port ${PORT} is already in use. Stop the other process or choose a different PORT.`);
  } else {
    console.error("[home] Server error:", error);
  }
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  const protocol = HTTPS_READY ? "https" : "http";
  console.log(`[home] listening on ${protocol}://localhost:${PORT}`);
  console.log(`        algorithm map:    ${protocol}://localhost:${PORT}/algorithm-map.html`);
  console.log(`        sql view explorer: ${protocol}://localhost:${PORT}/view-explorer.html`);
  console.log(`        domain access:    ${protocol}://rtml.ksm.co.kr:${PORT}`);
});

if (HTTPS_READY && HTTP_REDIRECT_PORT > 0) {
  redirectServer = http.createServer((req, res) => {
    const hostHeader = req.headers.host || `localhost:${HTTP_REDIRECT_PORT}`;
    const hostWithoutPort = hostHeader.replace(/:\d+$/, "");
    const targetHost = REDIRECT_HOST || hostWithoutPort;
    const portSegment = PORT === 443 ? "" : `:${PORT}`;
    const redirectUrl = `https://${targetHost}${portSegment}${req.url}`;

    res.writeHead(301, {
      Location: redirectUrl,
      "Content-Type": "text/plain",
    });
    res.end(`Redirecting to ${redirectUrl}`);
  });

  redirectServer.on("error", (error) => {
    if (error.code === "EADDRINUSE") {
      console.warn(`[home] HTTP redirect port ${HTTP_REDIRECT_PORT} is already in use. Redirect server not started.`);
    } else {
      console.warn("[home] HTTP redirect server error:", error);
    }
  });

  redirectServer.listen(HTTP_REDIRECT_PORT, HOST, () => {
    console.log(`[home] HTTP redirect listening on http://localhost:${HTTP_REDIRECT_PORT} -> https://localhost:${PORT}`);
  });
}
