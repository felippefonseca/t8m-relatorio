import { createSessionCookie, verifyCredentials } from "../lib/auth.js";
import { readRequestJson, sendJson } from "../lib/http.js";

export default async function handler(request, response) {
  if (request.method !== "POST") {
    sendJson(response, 405, { message: "Metodo nao permitido." });
    return;
  }

  const body = await readRequestJson(request);
  if (!verifyCredentials(body)) {
    sendJson(response, 401, {
      message: "Usuario ou senha invalidos. Confira o acesso cadastrado no painel."
    });
    return;
  }

  response.setHeader(
    "Set-Cookie",
    createSessionCookie(String(body.username || process.env.CLIENT_USERNAME || "t8m").trim())
  );
  sendJson(response, 200, { authenticated: true });
}
