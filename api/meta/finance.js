import { getMetaAccessToken, hasValidSession } from "../../lib/auth.js";
import { sendJson } from "../../lib/http.js";
import { getMetaFinanceData } from "../../lib/meta-dashboard.js";

export default async function handler(request, response) {
  if (request.method !== "GET") {
    sendJson(response, 405, { message: "Metodo nao permitido." });
    return;
  }

  if (!hasValidSession(request.headers)) {
    sendJson(response, 401, { message: "Sessao expirada." });
    return;
  }

  try {
    const query = request.query || {};
    const url = request.url ? new URL(request.url, "http://localhost") : null;
    const adAccountId =
      process.env.META_AD_ACCOUNT_ID ||
      query.adAccountId ||
      url?.searchParams.get("adAccountId") ||
      "";

    sendJson(
      response,
      200,
      await getMetaFinanceData({
        accessToken: getMetaAccessToken(request.headers),
        adAccountId
      })
    );
  } catch (error) {
    sendJson(response, 500, {
      message: error.message || "Nao foi possivel consultar o financeiro da Meta agora."
    });
  }
}
