import { clearMetaTokenCookie, clearSessionCookie } from "../lib/auth.js";
import { sendJson } from "../lib/http.js";

export default function handler(request, response) {
  if (request.method !== "POST") {
    sendJson(response, 405, { message: "Metodo nao permitido." });
    return;
  }

  response.setHeader("Set-Cookie", [clearSessionCookie(), clearMetaTokenCookie()]);
  sendJson(response, 200, { authenticated: false });
}
