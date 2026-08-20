import crypto from "node:crypto";

export const sessionCookie = "t8m_meta_session";
export const metaTokenCookie = "t8m_meta_token";
const sessionTtlMs = 1000 * 60 * 60 * 8;
const metaTokenTtlSeconds = 60 * 60 * 24 * 60;

export function verifyCredentials(body = {}) {
  const expectedUser = process.env.CLIENT_USERNAME || "t8m";
  const expectedPassword = process.env.CLIENT_PASSWORD || "troque-esta-senha";

  return (
    secureEqual(body.username || "", expectedUser) &&
    secureEqual(body.password || "", expectedPassword)
  );
}

export function createSessionCookie(username = "t8m") {
  const payload = Buffer.from(
    JSON.stringify({ username, expiresAt: Date.now() + sessionTtlMs })
  ).toString("base64url");
  return cookieHeader(`${payload}.${sign(payload)}`, Math.floor(sessionTtlMs / 1000));
}

export function clearSessionCookie() {
  return cookieHeader("", 0);
}

export function createMetaTokenCookie(accessToken) {
  const payload = Buffer.from(
    JSON.stringify({ accessToken, expiresAt: Date.now() + metaTokenTtlSeconds * 1000 })
  ).toString("base64url");
  return cookieHeaderFor(metaTokenCookie, `${payload}.${sign(payload)}`, metaTokenTtlSeconds);
}

export function clearMetaTokenCookie() {
  return cookieHeaderFor(metaTokenCookie, "", 0);
}

export function hasValidSession(headers = {}) {
  const value = getCookie(headers.cookie || "", sessionCookie);
  const [payload, signature] = value.split(".");
  if (!payload || !signature || !secureEqual(signature, sign(payload))) return false;

  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return Number(session.expiresAt) > Date.now();
  } catch {
    return false;
  }
}

export function getMetaAccessToken(headers = {}) {
  if (process.env.META_ACCESS_TOKEN) return process.env.META_ACCESS_TOKEN;

  const value = getCookie(headers.cookie || "", metaTokenCookie);
  const [payload, signature] = value.split(".");
  if (!payload || !signature || !secureEqual(signature, sign(payload))) return "";

  try {
    const token = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (Number(token.expiresAt) <= Date.now()) return "";
    return token.accessToken || "";
  } catch {
    return "";
  }
}

function cookieHeader(value, maxAge) {
  return cookieHeaderFor(sessionCookie, value, maxAge);
}

function cookieHeaderFor(name, value, maxAge) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${name}=${value}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${secure}`;
}

function sign(value) {
  const secret = process.env.SESSION_SECRET || "dev-session-secret";
  return crypto.createHmac("sha256", secret).update(value).digest("base64url");
}

function getCookie(cookieHeaderValue, name) {
  const cookies = cookieHeaderValue.split(";").map((item) => item.trim());
  for (const cookie of cookies) {
    const [key, ...value] = cookie.split("=");
    if (key === name) return value.join("=");
  }
  return "";
}

function secureEqual(input, expected) {
  const inputBuffer = Buffer.from(input);
  const expectedBuffer = Buffer.from(expected);
  if (inputBuffer.length !== expectedBuffer.length) return false;
  return crypto.timingSafeEqual(inputBuffer, expectedBuffer);
}
