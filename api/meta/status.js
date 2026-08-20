import { getMetaAccessToken, hasValidSession } from "../../lib/auth.js";
import { sendJson } from "../../lib/http.js";
import { getConnectorStatus } from "../../lib/meta-connector.js";

export default function handler(request, response) {
  if (request.method !== "GET") {
    sendJson(response, 405, { message: "Metodo nao permitido." });
    return;
  }

  if (!hasValidSession(request.headers)) {
    sendJson(response, 401, { message: "Sessao expirada." });
    return;
  }

  const metaAccessToken = getMetaAccessToken(request.headers);
  sendJson(response, 200, getConnectorStatus({ ...request.headers, metaAccessToken }));
}
