import { clearMetaTokenCookie, hasValidSession } from "../../lib/auth.js";
import { sendJson } from "../../lib/http.js";

export default function handler(request, response) {
  if (request.method !== "POST") {
    sendJson(response, 405, { message: "Metodo nao permitido." });
    return;
  }

  if (!hasValidSession(request.headers)) {
    sendJson(response, 401, { message: "Sessao expirada." });
    return;
  }

  response.setHeader("Set-Cookie", clearMetaTokenCookie());
  sendJson(response, 200, { connected: Boolean(process.env.META_ACCESS_TOKEN) });
}
