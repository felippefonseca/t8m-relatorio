import fs from "node:fs";
import fsp from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  clearMetaTokenCookie,
  clearSessionCookie,
  createMetaTokenCookie,
  createSessionCookie,
  getMetaAccessToken,
  hasValidSession,
  verifyCredentials
} from "./lib/auth.js";
import { readRequestJson, sendJson } from "./lib/http.js";
import {
  createAuthorizationUrl,
  exchangeCodeForToken,
  getConnectorStatus,
  listAdAccounts
} from "./lib/meta-connector.js";
import { getAdPreviewData, getDashboardData, getMetaFinanceData } from "./lib/meta-dashboard.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "public");

loadDotEnv(path.join(__dirname, ".env"));

const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || "127.0.0.1";

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml"
};

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url || "/", `http://${request.headers.host}`);

    if (url.pathname.startsWith("/api/")) {
      await handleApi(request, response, url);
      return;
    }

    await serveStatic(url.pathname, response);
  } catch (error) {
    console.error(error);
    sendJson(response, 500, {
      message: "Nao foi possivel processar a solicitacao agora."
    });
  }
});

startServer(port);

function loadDotEnv(filePath) {
  try {
    const content = fs.readFileSync(filePath, "utf8");
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
      const [key, ...parts] = trimmed.split("=");
      if (process.env[key]) continue;
      process.env[key] = parts.join("=").replace(/^["']|["']$/g, "");
    }
  } catch {
    // A .env file is optional; .env.example documents the available settings.
  }
}

async function handleApi(request, response, url) {
  if (url.pathname === "/api/login" && request.method === "POST") {
    const body = await readRequestJson(request);
    if (!verifyCredentials(body)) {
      sendJson(response, 401, { message: "Usuario ou senha invalidos." });
      return;
    }

    response.setHeader(
      "Set-Cookie",
      createSessionCookie(process.env.CLIENT_USERNAME || "t8m")
    );
    sendJson(response, 200, { authenticated: true });
    return;
  }

  if (url.pathname === "/api/logout" && request.method === "POST") {
    response.setHeader("Set-Cookie", [clearSessionCookie(), clearMetaTokenCookie()]);
    sendJson(response, 200, { authenticated: false });
    return;
  }

  if (url.pathname === "/api/session" && request.method === "GET") {
    sendJson(response, 200, { authenticated: hasValidSession(request.headers) });
    return;
  }

  if (url.pathname === "/api/meta/callback" && request.method === "GET") {
    const accessToken = await exchangeCodeForToken(
      url.searchParams.get("code"),
      url.searchParams.get("state"),
      request.headers
    );
    response.writeHead(302, {
      "Set-Cookie": createMetaTokenCookie(accessToken),
      Location: "/?meta=connected"
    });
    response.end();
    return;
  }

  if (!hasValidSession(request.headers)) {
    sendJson(response, 401, { message: "Sessao expirada." });
    return;
  }

  if (url.pathname === "/api/dashboard" && request.method === "GET") {
    const accessToken = getMetaAccessToken(request.headers);
    const data = await getDashboardData({
      accessToken,
      adAccountId: process.env.META_AD_ACCOUNT_ID || url.searchParams.get("adAccountId"),
      datePreset: url.searchParams.get("datePreset"),
      since: url.searchParams.get("since"),
      until: url.searchParams.get("until")
    });
    sendJson(response, 200, data);
    return;
  }

  if (url.pathname === "/api/meta/status" && request.method === "GET") {
    const metaAccessToken = getMetaAccessToken(request.headers);
    sendJson(response, 200, getConnectorStatus({ ...request.headers, metaAccessToken }));
    return;
  }

  if (url.pathname === "/api/meta/finance" && request.method === "GET") {
    sendJson(
      response,
      200,
      await getMetaFinanceData({
        accessToken: getMetaAccessToken(request.headers),
        adAccountId: process.env.META_AD_ACCOUNT_ID || url.searchParams.get("adAccountId")
      })
    );
    return;
  }

  if (url.pathname === "/api/meta/connect" && request.method === "POST") {
    try {
      sendJson(response, 200, { authorizationUrl: createAuthorizationUrl(request.headers) });
    } catch (error) {
      sendJson(response, 400, { message: error.message });
    }
    return;
  }

  if (url.pathname === "/api/meta/accounts" && request.method === "GET") {
    sendJson(response, 200, {
      accounts: await listAdAccounts(getMetaAccessToken(request.headers))
    });
    return;
  }

  if (url.pathname === "/api/meta/preview" && request.method === "GET") {
    try {
      sendJson(
        response,
        200,
        await getAdPreviewData({
          accessToken: getMetaAccessToken(request.headers),
          adId: url.searchParams.get("adId"),
          creativeId: url.searchParams.get("creativeId")
        })
      );
    } catch (error) {
      sendJson(response, 400, {
        message: error.message || "Nao foi possivel abrir o preview deste anuncio."
      });
    }
    return;
  }

  if (url.pathname === "/api/meta/disconnect" && request.method === "POST") {
    response.setHeader("Set-Cookie", clearMetaTokenCookie());
    sendJson(response, 200, { connected: Boolean(process.env.META_ACCESS_TOKEN) });
    return;
  }

  sendJson(response, 404, { message: "Rota nao encontrada." });
}

function startServer(candidatePort, attempts = 0) {
  server.once("error", (error) => {
    if (error.code === "EADDRINUSE" && attempts < 10) {
      startServer(candidatePort + 1, attempts + 1);
      return;
    }
    throw error;
  });

  server.listen(candidatePort, host, () => {
    console.log(`Painel disponivel em http://localhost:${candidatePort}`);
  });
}

async function serveStatic(requestPath, response) {
  const normalizedPath = requestPath === "/" ? "/index.html" : requestPath;
  const safePath = path.normalize(normalizedPath).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(publicDir, safePath);

  if (!filePath.startsWith(publicDir)) {
    response.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Acesso negado.");
    return;
  }

  try {
    const content = await fsp.readFile(filePath);
    response.writeHead(200, {
      "Content-Type": mimeTypes[path.extname(filePath)] || "application/octet-stream"
    });
    response.end(content);
  } catch {
    const index = await fsp.readFile(path.join(publicDir, "index.html"));
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    response.end(index);
  }
}
