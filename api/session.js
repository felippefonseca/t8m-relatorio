import { hasValidSession } from "../lib/auth.js";
import { sendJson } from "../lib/http.js";

export default function handler(request, response) {
  if (request.method !== "GET") {
    sendJson(response, 405, { message: "Metodo nao permitido." });
    return;
  }

  sendJson(response, 200, { authenticated: hasValidSession(request.headers) });
}
