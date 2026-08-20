import { getMetaAccessToken, hasValidSession } from "../../lib/auth.js";
import { sendJson } from "../../lib/http.js";
import { listAdAccounts } from "../../lib/meta-connector.js";

export default async function handler(request, response) {
  if (request.method !== "GET") {
    sendJson(response, 405, { message: "Metodo nao permitido." });
    return;
  }

  if (!hasValidSession(request.headers)) {
    sendJson(response, 401, { message: "Sessao expirada." });
    return;
  }

  sendJson(response, 200, {
    accounts: await listAdAccounts(getMetaAccessToken(request.headers))
  });
}
