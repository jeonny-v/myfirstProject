import http from "node:http";
import { randomUUID } from "node:crypto";
import { pool, waitForDatabase } from "./db.js";
import { hashPassword, verifyPassword } from "./password.js";
import {
  clearSessionCookie,
  newOpaqueToken,
  normalizeEmail,
  parseCookies,
  safeText,
  sessionCookie,
  sha256,
} from "./security.js";
import { seedDemoUsers } from "./seed.js";

const PORT = Number(process.env.PORT ?? 8080);
const PUBLIC_ORIGIN = process.env.PUBLIC_ORIGIN ?? "http://localhost:8080";
const COOKIE_SECURE = process.env.COOKIE_SECURE !== "false";
const SESSION_COOKIE_NAME = COOKIE_SECURE ? "__Host-session" : "session";
const SESSION_TTL_SECONDS = Number(process.env.SESSION_TTL_SECONDS ?? 28_800);
const BODY_LIMIT = 16 * 1024;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
let fakePasswordHash;

function json(response, status, body, headers = {}) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
    "referrer-policy": "no-referrer",
    "content-security-policy": "default-src 'none'; frame-ancestors 'none'",
    ...headers,
  });
  if (status === 204) response.end();
  else response.end(JSON.stringify(body));
}

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > BODY_LIMIT) {
      const error = new Error("BODY_TOO_LARGE");
      error.status = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    const error = new Error("INVALID_JSON");
    error.status = 400;
    throw error;
  }
}

function requestContext(request) {
  const forwarded = String(request.headers["x-forwarded-for"] ?? "").split(",")[0].trim();
  const ip = forwarded || request.socket.remoteAddress || "unknown";
  return {
    requestId: safeText(request.headers["x-request-id"] || randomUUID(), 100),
    ipHash: sha256(ip),
    userAgent: safeText(request.headers["user-agent"], 300),
  };
}

function checkOrigin(request) {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(request.method)) return true;
  const origin = request.headers.origin;
  return !origin || origin === PUBLIC_ORIGIN;
}

async function authenticate(request) {
  const token = parseCookies(request.headers.cookie)[SESSION_COOKIE_NAME];
  if (!token) return null;
  const result = await pool.query(
    `SELECT s.id AS session_id, s.user_id, u.email, u.display_name, u.role, u.membership_tier
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token_digest = $1 AND s.revoked_at IS NULL AND s.expires_at > now() AND u.status = 'ACTIVE'`,
    [sha256(token)],
  );
  if (!result.rowCount) return null;
  await pool.query("UPDATE sessions SET last_seen_at = now() WHERE id = $1", [result.rows[0].session_id]);
  return result.rows[0];
}

async function recordAudit(client, type, result, context, userId = null, metadata = {}) {
  await client.query(
    `INSERT INTO audit_events (id, event_type, result, user_id, request_id, ip_hash, metadata_safe)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
    [randomUUID(), type, result, userId, context.requestId, context.ipHash, JSON.stringify(metadata)],
  );
}

async function handleLogin(request, response, context) {
  const body = await readJson(request);
  const email = normalizeEmail(body.email);
  const password = String(body.password ?? "");
  if (!EMAIL_PATTERN.test(email) || email.length > 254 || password.length < 1 || password.length > 256) {
    return json(response, 400, { code: "VALIDATION_ERROR", message: "입력값을 확인해 주세요." });
  }

  const emailHash = sha256(email);
  const recent = await pool.query(
    `SELECT count(*)::int AS failures FROM auth_attempts
      WHERE occurred_at > now() - interval '15 minutes' AND success = false
        AND (email_lookup_hash = $1 OR ip_hash = $2)`,
    [emailHash, context.ipHash],
  );
  if (recent.rows[0].failures >= 10) {
    return json(response, 429, { code: "TRY_LATER", message: "잠시 후 다시 시도해 주세요." }, { "retry-after": "900" });
  }

  const found = await pool.query(
    `SELECT u.id, u.email, u.display_name, u.status, u.role, u.membership_tier, c.password_hash
       FROM users u JOIN credentials c ON c.user_id = u.id WHERE u.email = $1`,
    [email],
  );
  const user = found.rows[0];
  const validPassword = await verifyPassword(password, user?.password_hash ?? fakePasswordHash);
  const success = Boolean(user && user.status === "ACTIVE" && validPassword);
  await pool.query(
    `INSERT INTO auth_attempts (id, email_lookup_hash, ip_hash, success, reason_code, request_id)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [randomUUID(), emailHash, context.ipHash, success, success ? "SUCCESS" : "INVALID_CREDENTIALS", context.requestId],
  );
  if (!success) {
    await recordAudit(pool, "LOGIN", "FAILURE", context, user?.id ?? null, { reason: "INVALID_CREDENTIALS" });
    return json(response, 401, { code: "INVALID_CREDENTIALS", message: "이메일 또는 비밀번호를 확인해 주세요." });
  }

  const token = newOpaqueToken();
  const sessionId = randomUUID();
  await pool.query(
    `INSERT INTO sessions (id, user_id, token_digest, user_agent, ip_hash, expires_at)
     VALUES ($1, $2, $3, $4, $5, now() + ($6 * interval '1 second'))`,
    [sessionId, user.id, sha256(token), context.userAgent, context.ipHash, SESSION_TTL_SECONDS],
  );
  await recordAudit(pool, "LOGIN", "SUCCESS", context, user.id, { sessionId });
  return json(
    response,
    200,
    { user: { id: user.id, email: user.email, displayName: user.display_name, role: user.role, membershipTier: user.membership_tier } },
    { "set-cookie": sessionCookie(SESSION_COOKIE_NAME, token, SESSION_TTL_SECONDS, COOKIE_SECURE) },
  );
}

async function handleSignup(request, response, context) {
  const body = await readJson(request);
  const email = normalizeEmail(body.email);
  const password = String(body.password ?? "");
  const displayName = safeText(body.displayName || email.split("@")[0], 80);
  if (!EMAIL_PATTERN.test(email) || email.length > 254 || password.length < 12 || password.length > 256) {
    return json(response, 400, { code: "VALIDATION_ERROR", message: "이메일과 12자 이상의 비밀번호를 확인해 주세요." });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const userId = randomUUID();
    const passwordHash = await hashPassword(password);
    await client.query(
      `INSERT INTO users (id, email, display_name, status, role, membership_tier)
       VALUES ($1, $2, $3, 'ACTIVE', 'MEMBER', 'BASIC')`,
      [userId, email, displayName],
    );
    await client.query("INSERT INTO credentials (user_id, password_hash) VALUES ($1, $2)", [userId, passwordHash]);
    await recordAudit(client, "SIGN_UP", "SUCCESS", context, userId);
    await client.query("COMMIT");
    return json(response, 201, { message: "계정이 생성되었습니다." });
  } catch (error) {
    await client.query("ROLLBACK");
    if (error.code === "23505") {
      return json(response, 409, { code: "ACCOUNT_UNAVAILABLE", message: "이 이메일로 계정을 만들 수 없습니다." });
    }
    throw error;
  } finally {
    client.release();
  }
}

async function handleSessions(request, response, user) {
  const result = await pool.query(
    `SELECT id, user_agent, created_at, last_seen_at, expires_at
       FROM sessions WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > now()
      ORDER BY last_seen_at DESC`,
    [user.user_id],
  );
  return json(response, 200, {
    sessions: result.rows.map((row) => ({
      id: row.id,
      device: row.user_agent || "알 수 없는 기기",
      detail: "보안 세션",
      location: "위치 비공개",
      time: row.last_seen_at,
      current: row.id === user.session_id,
    })),
  });
}

async function route(request, response) {
  const url = new URL(request.url, "http://backend.internal");
  const context = requestContext(request);
  response.setHeader("x-request-id", context.requestId);

  if (!checkOrigin(request)) return json(response, 403, { code: "FORBIDDEN", message: "허용되지 않은 요청 출처입니다." });
  if (request.method === "GET" && url.pathname === "/api/health/live") return json(response, 200, { status: "ok" });
  if (request.method === "GET" && url.pathname === "/api/health/ready") {
    await pool.query("SELECT 1");
    return json(response, 200, { status: "ready" });
  }
  if (request.method === "POST" && url.pathname === "/api/v1/auth/login") return handleLogin(request, response, context);
  if (request.method === "POST" && url.pathname === "/api/v1/auth/sign-up") return handleSignup(request, response, context);
  if (request.method === "POST" && url.pathname === "/api/v1/auth/password-recovery") {
    await readJson(request);
    return json(response, 202, { message: "가입된 계정이라면 복구 안내를 전송합니다." });
  }

  const user = await authenticate(request);
  if (!user) {
    return json(response, 401, { code: "UNAUTHENTICATED", message: "로그인이 필요합니다." }, { "set-cookie": clearSessionCookie(SESSION_COOKIE_NAME, COOKIE_SECURE) });
  }
  if (request.method === "GET" && url.pathname === "/api/v1/auth/me") {
    return json(response, 200, { user: { id: user.user_id, email: user.email, displayName: user.display_name, role: user.role, membershipTier: user.membership_tier } });
  }
  if (request.method === "GET" && url.pathname === "/api/v1/auth/sessions") return handleSessions(request, response, user);
  if (request.method === "POST" && url.pathname === "/api/v1/auth/logout") {
    await pool.query("UPDATE sessions SET revoked_at = now() WHERE id = $1", [user.session_id]);
    await recordAudit(pool, "LOGOUT", "SUCCESS", context, user.user_id, { sessionId: user.session_id });
    return json(response, 204, null, { "set-cookie": clearSessionCookie(SESSION_COOKIE_NAME, COOKIE_SECURE) });
  }
  if (request.method === "POST" && url.pathname === "/api/v1/auth/logout-others") {
    await pool.query("UPDATE sessions SET revoked_at = now() WHERE user_id = $1 AND id <> $2 AND revoked_at IS NULL", [user.user_id, user.session_id]);
    await recordAudit(pool, "LOGOUT_OTHERS", "SUCCESS", context, user.user_id, { currentSessionId: user.session_id });
    return json(response, 204, null);
  }
  const sessionMatch = url.pathname.match(/^\/api\/v1\/auth\/sessions\/([0-9a-f-]{36})$/i);
  if (request.method === "DELETE" && sessionMatch) {
    await pool.query("UPDATE sessions SET revoked_at = now() WHERE id = $1 AND user_id = $2", [sessionMatch[1], user.user_id]);
    await recordAudit(pool, "SESSION_REVOKE", "SUCCESS", context, user.user_id, { sessionId: sessionMatch[1] });
    return json(response, 204, null);
  }
  return json(response, 404, { code: "NOT_FOUND", message: "요청 경로를 찾을 수 없습니다." });
}

await waitForDatabase();
fakePasswordHash = await hashPassword("not-a-real-account-password");
const seedResult = await seedDemoUsers();
console.log(JSON.stringify({ level: "info", event: "demo_seed", ...seedResult }));

const server = http.createServer((request, response) => {
  route(request, response).catch((error) => {
    console.error(JSON.stringify({ level: "error", event: "request_error", message: error.message }));
    if (!response.headersSent) json(response, error.status ?? 500, { code: "INTERNAL_ERROR", message: "요청을 처리하지 못했습니다." });
    else response.end();
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(JSON.stringify({ level: "info", event: "server_started", port: PORT }));
});

async function shutdown(signal) {
  console.log(JSON.stringify({ level: "info", event: "shutdown", signal }));
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
