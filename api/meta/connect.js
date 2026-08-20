import { hasValidSession } from "../../lib/auth.js";
import { sendJson } from "../../lib/http.js";
import { createAuthorizationUrl } from "../../lib/meta-connector.js";

export default function handler(request, response) {
  if (request.method !== "POST") {
    sendJson(response, 405, { message: "Metodo nao permitido." });
    return;
  }

  if (!hasValidSession(request.headers)) {
    sendJson(response, 401, { message: "Sessao expirada." });
    return;
  }

  try {
    sendJson(response, 200, { authorizationUrl: createAuthorizationUrl(request.headers) });
  } catch (error) {
    sendJson(response, 400, { message: error.message });
  }
}
