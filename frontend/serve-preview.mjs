#!/usr/bin/env node
/* =====================================================================
   Preview server for the Hostel Services front-end
   ---------------------------------------------------------------------
   A plain `python3 -m http.server` is enough to look at the UI, but it
   has two problems while iterating:

     1. It answers conditional requests with 304 Not Modified, so the
        browser can keep an old styles.css / app.js after an edit.
     2. /api/* 404s as HTML, which pollutes the console.

   This server fixes both:
     - every file is served with `Cache-Control: no-store`
     - /api/* is proxied to the Spring Boot backend when it is running,
       otherwise answered with a clean JSON 503 (so fetch() fails
       gracefully and the UI stays in preview mode)
     - .woff2 / .png get the correct MIME types on every platform

   Usage:
     node serve-preview.mjs            # http://localhost:4173
     PORT=5000 node serve-preview.mjs
     API_TARGET=http://localhost:8080 node serve-preview.mjs

   This file is a local dev helper only; it is not part of the app and
   is never served to the browser.
   ===================================================================== */

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 4173);
const HOST = process.env.HOST || "0.0.0.0";
const API_TARGET = process.env.API_TARGET || "http://localhost:8080";
const API_TIMEOUT_MS = 2500;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/plain; charset=utf-8"
};

function baseHeaders(extra = {}) {
  return {
    // Never let the browser reuse an older build during a demo.
    "Cache-Control": "no-store, no-cache, must-revalidate",
    Pragma: "no-cache",
    Expires: "0",
    "X-Content-Type-Options": "nosniff",
    // Preview is embedded by the Arena proxy.
    "Access-Control-Allow-Origin": "*",
    ...extra
  };
}

/** Resolve a URL path to a file inside ROOT, or null if unsafe/missing. */
function resolveFile(urlPath) {
  let pathname;
  try {
    pathname = decodeURIComponent(urlPath.split("?")[0]);
  } catch {
    return null; // malformed percent-encoding
  }
  if (pathname.endsWith("/")) pathname += "index.html";

  const target = path.resolve(ROOT, "." + pathname);
  // Directory-traversal guard.
  if (target !== ROOT && !target.startsWith(ROOT + path.sep)) return null;

  try {
    const stat = fs.statSync(target);
    if (stat.isDirectory()) {
      const index = path.join(target, "index.html");
      return fs.existsSync(index) ? { file: index, size: fs.statSync(index).size } : null;
    }
    if (!stat.isFile()) return null;
    return { file: target, size: stat.size };
  } catch {
    return null;
  }
}

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, baseHeaders({
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(payload)
  }));
  res.end(payload);
}

/** Proxy /api/* to Spring Boot; answer 503 JSON when it is not running. */
function proxyApi(req, res) {
  const target = new URL(req.url, API_TARGET);
  const upstream = http.request(
    {
      hostname: target.hostname,
      port: target.port || 80,
      path: target.pathname + target.search,
      method: req.method,
      headers: { ...req.headers, host: target.host }
    },
    (upstreamRes) => {
      res.writeHead(upstreamRes.statusCode || 502, baseHeaders({
        "Content-Type": upstreamRes.headers["content-type"] || "application/json; charset=utf-8"
      }));
      upstreamRes.pipe(res);
    }
  );

  upstream.setTimeout(API_TIMEOUT_MS, () => upstream.destroy(new Error("timeout")));
  upstream.on("error", () => {
    if (!res.headersSent) {
      sendJson(res, 503, {
        error: "Spring Boot backend is not reachable.",
        hint: "Run ./mvnw spring-boot:run in the backend/ folder to serve live data. The UI stays in preview mode until then.",
        target: API_TARGET
      });
    }
  });

  req.pipe(upstream);
}

const server = http.createServer((req, res) => {
  const started = process.hrtime.bigint();

  res.on("finish", () => {
    const ms = Number(process.hrtime.bigint() - started) / 1e6;
    const where = req.url.startsWith("/api/") ? "→api" : "";
    console.log(`${res.statusCode} ${req.method} ${req.url} ${ms.toFixed(1)}ms ${where}`.trim());
  });

  if (req.method === "OPTIONS") {
    res.writeHead(204, baseHeaders({
      "Access-Control-Allow-Methods": "GET, POST, PATCH, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "*"
    }));
    return res.end();
  }

  if (req.url.startsWith("/api/")) return proxyApi(req, res);

  if (req.method !== "GET" && req.method !== "HEAD") {
    return sendJson(res, 405, { error: "Method not allowed on the static preview server." });
  }

  const resolved = resolveFile(req.url);
  if (!resolved) {
    res.writeHead(404, baseHeaders({ "Content-Type": "text/html; charset=utf-8" }));
    return res.end(
      `<!doctype html><meta charset="utf-8"><title>Not found</title>` +
      `<body style="font:14px/1.5 system-ui;padding:40px;color:#17181c">` +
      `<h1 style="font-size:18px">404 — not found</h1>` +
      `<p style="color:#6b6f7a">${req.url.replace(/[<>&]/g, "")}</p>` +
      `<p><a href="/" style="color:#a6192e">Back to Hostel Services</a></p>`
    );
  }

  const ext = path.extname(resolved.file).toLowerCase();
  res.writeHead(200, baseHeaders({
    "Content-Type": MIME[ext] || "application/octet-stream",
    "Content-Length": resolved.size
  }));

  if (req.method === "HEAD") return res.end();
  fs.createReadStream(resolved.file).pipe(res);
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`Port ${PORT} is already in use. Stop the other process or set PORT=<free port>.`);
    process.exit(1);
  }
  throw err;
});

server.listen(PORT, HOST, () => {
  console.log(`Hostel Services preview → http://localhost:${PORT}`);
  console.log(`  serving   ${ROOT}`);
  console.log(`  API proxy /api/* → ${API_TARGET} (JSON 503 fallback when offline)`);
  console.log(`  caching   disabled (no-store) so edits show up on refresh`);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    console.log(`\n${signal} received, closing preview server.`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 1500).unref();
  });
}
