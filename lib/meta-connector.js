import crypto from "node:crypto";
import { graphFetchWithToken } from "./meta-dashboard.js";

const scope = ["ads_read", "business_management"].join(",");

export function getConnectorStatus(headers = {}) {
  const appReady = Boolean(process.env.META_APP_ID && process.env.META_APP_SECRET);
  const envConnected = Boolean(process.env.META_ACCESS_TOKEN && process.env.META_AD_ACCOUNT_ID);
  const cookieConnected = Boolean(headers?.metaAccessToken);
  const callbackUrl = getRedirectUri(headers);

  return {
    connected: envConnected || cookieConnected,
    mode: envConnected ? "server" : cookieConnected ? "oauth" : "none",
    appReady,
    adAccountLocked: Boolean(process.env.META_AD_ACCOUNT_ID),
    adAccountId: process.env.META_AD_ACCOUNT_ID || "",
    callbackUrl,
    missing: [
      !process.env.META_APP_ID ? "META_APP_ID" : "",
      !process.env.META_APP_SECRET ? "META_APP_SECRET" : ""
    ].filter(Boolean)
  };
}

export function createAuthorizationUrl(headers = {}) {
  if (!process.env.META_APP_ID || !process.env.META_APP_SECRET) {
    throw new Error("Configure META_APP_ID e META_APP_SECRET para ativar o conector.");
  }

  const redirectUri = getRedirectUri(headers);
  const state = signState({ createdAt: Date.now() });
  const url = new URL("https://www.facebook.com/dialog/oauth");
  url.searchParams.set("client_id", process.env.META_APP_ID);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("scope", scope);
  url.searchParams.set("response_type", "code");
  return url.toString();
}

export async function exchangeCodeForToken(code, state, headers = {}) {
  if (!verifyState(state)) throw new Error("Estado de autenticacao invalido.");
  if (!code) throw new Error("Codigo de autorizacao ausente.");

  const shortUrl = new URL("https://graph.facebook.com/v25.0/oauth/access_token");
  shortUrl.searchParams.set("client_id", process.env.META_APP_ID);
  shortUrl.searchParams.set("client_secret", process.env.META_APP_SECRET);
  shortUrl.searchParams.set("redirect_uri", getRedirectUri(headers));
  shortUrl.searchParams.set("code", code);
  const shortToken = await fetchJson(shortUrl);

  const longUrl = new URL("https://graph.facebook.com/v25.0/oauth/access_token");
  longUrl.searchParams.set("grant_type", "fb_exchange_token");
  longUrl.searchParams.set("client_id", process.env.META_APP_ID);
  longUrl.searchParams.set("client_secret", process.env.META_APP_SECRET);
  longUrl.searchParams.set("fb_exchange_token", shortToken.access_token);
  const longToken = await fetchJson(longUrl);

  return longToken.access_token || shortToken.access_token;
}

export async function listAdAccounts(accessToken) {
  if (!accessToken) return [];
  const response = await graphFetchWithToken(
    "/me/adaccounts",
    {
      fields: "id,name,currency,account_status",
      limit: "100"
    },
    accessToken
  );
  return (response.data || []).map((account) => ({
    id: account.id,
    name: account.name || account.id,
    currency: account.currency || "",
    status: account.account_status || null
  }));
}

function getRedirectUri(headers = {}) {
  if (process.env.META_REDIRECT_URI) return process.env.META_REDIRECT_URI;
  const proto = headers["x-forwarded-proto"] || "http";
  const host = headers["x-forwarded-host"] || headers.host || "localhost:4173";
  return `${proto}://${host}/api/meta/callback`;
}

function signState(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", process.env.SESSION_SECRET || "dev-session-secret")
    .update(body)
    .digest("base64url");
  return `${body}.${signature}`;
}

function verifyState(state = "") {
  const [body, signature] = state.split(".");
  if (!body || !signature) return false;
  const expected = crypto
    .createHmac("sha256", process.env.SESSION_SECRET || "dev-session-secret")
    .update(body)
    .digest("base64url");
  if (!secureEqual(signature, expected)) return false;

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    return Date.now() - Number(payload.createdAt) < 1000 * 60 * 15;
  } catch {
    return false;
  }
}

async function fetchJson(url) {
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(json.error?.message || "Nao foi possivel conectar com a Meta.");
  }
  return json;
}

function secureEqual(input, expected) {
  const inputBuffer = Buffer.from(input);
  const expectedBuffer = Buffer.from(expected);
  if (inputBuffer.length !== expectedBuffer.length) return false;
  return crypto.timingSafeEqual(inputBuffer, expectedBuffer);
}
