import { createHash, randomBytes } from "node:crypto";

export function sha256(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

export function newOpaqueToken() {
  return randomBytes(32).toString("base64url");
}

export function normalizeEmail(value) {
  return String(value ?? "").trim().toLowerCase();
}

export function parseCookies(header = "") {
  return Object.fromEntries(
    header
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf("=");
        return index < 0
          ? [decodeURIComponent(part), ""]
          : [decodeURIComponent(part.slice(0, index)), decodeURIComponent(part.slice(index + 1))];
      }),
  );
}

export function sessionCookie(name, token, maxAgeSeconds, secure = true) {
  const securePart = secure ? "; Secure" : "";
  return `${name}=${encodeURIComponent(token)}; Max-Age=${maxAgeSeconds}; Path=/; HttpOnly; SameSite=Lax${securePart}`;
}

export function clearSessionCookie(name, secure = true) {
  return sessionCookie(name, "", 0, secure);
}

export function safeText(value, maxLength) {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, "").slice(0, maxLength);
}
