import http from "node:http";
import path from "node:path";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";
import { readFile, stat } from "node:fs/promises";
import worker from "../dist/server/index.js";

const PORT = Number(process.env.PORT ?? 3000);
const CLIENT_ROOT = fileURLToPath(new URL("../dist/client/", import.meta.url));
const MIME_TYPES = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".woff", "font/woff"],
  [".woff2", "font/woff2"],
]);

function resolveAsset(url) {
  const pathname = decodeURIComponent(new URL(url).pathname);
  const relative = pathname.replace(/^\/+/, "");
  const resolved = path.resolve(CLIENT_ROOT, relative);
  return resolved.startsWith(CLIENT_ROOT) ? resolved : null;
}

async function assetResponse(request) {
  const filename = resolveAsset(request.url);
  if (!filename) return new Response("Not found", { status: 404 });
  try {
    const info = await stat(filename);
    if (!info.isFile()) return new Response("Not found", { status: 404 });
    const body = await readFile(filename);
    const extension = path.extname(filename).toLowerCase();
    return new Response(body, {
      status: 200,
      headers: {
        "content-type": MIME_TYPES.get(extension) ?? "application/octet-stream",
        "cache-control": relativeIsImmutable(filename) ? "public, max-age=31536000, immutable" : "public, max-age=300",
      },
    });
  } catch (error) {
    if (error.code === "ENOENT") return new Response("Not found", { status: 404 });
    throw error;
  }
}

function relativeIsImmutable(filename) {
  return filename.startsWith(path.join(CLIENT_ROOT, "assets") + path.sep);
}

function writeNodeResponse(nodeResponse, webResponse, method) {
  nodeResponse.statusCode = webResponse.status;
  for (const [name, value] of webResponse.headers) nodeResponse.setHeader(name, value);
  if (method === "HEAD" || webResponse.status === 204 || webResponse.status === 304) {
    nodeResponse.end();
    return;
  }
  webResponse.arrayBuffer()
    .then((body) => nodeResponse.end(Buffer.from(body)))
    .catch((error) => {
      console.error(JSON.stringify({ level: "error", event: "frontend_response_error", message: error.message }));
      nodeResponse.destroy(error);
    });
}

const server = http.createServer(async (request, response) => {
  try {
    const host = request.headers.host ?? `127.0.0.1:${PORT}`;
    const protocol = request.headers["x-forwarded-proto"] ?? "http";
    const url = `${protocol}://${host}${request.url ?? "/"}`;
    const asset = await assetResponse(new Request(url));
    if (asset.status !== 404) {
      writeNodeResponse(response, asset, request.method);
      return;
    }

    const hasBody = request.method !== "GET" && request.method !== "HEAD";
    const webRequest = new Request(url, {
      method: request.method,
      headers: request.headers,
      body: hasBody ? Readable.toWeb(request) : undefined,
      duplex: hasBody ? "half" : undefined,
    });
    const webResponse = await worker.fetch(
      webRequest,
      { ASSETS: { fetch: assetResponse } },
      { waitUntil() {}, passThroughOnException() {} },
    );
    writeNodeResponse(response, webResponse, request.method);
  } catch (error) {
    console.error(JSON.stringify({ level: "error", event: "frontend_request_error", message: error.message }));
    if (!response.headersSent) {
      response.writeHead(500, { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" });
      response.end("Internal Server Error");
    } else {
      response.destroy(error);
    }
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(JSON.stringify({ level: "info", event: "frontend_started", port: PORT }));
});

function shutdown(signal) {
  console.log(JSON.stringify({ level: "info", event: "frontend_shutdown", signal }));
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
