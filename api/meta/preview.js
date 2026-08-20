import { getMetaAccessToken, hasValidSession } from "../../lib/auth.js";
import { sendJson } from "../../lib/http.js";
import { getAdPreviewData } from "../../lib/meta-dashboard.js";

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
    const getParam = (name) => query[name] || url?.searchParams.get(name) || "";

    sendJson(
      response,
      200,
      await getAdPreviewData({
        accessToken: getMetaAccessToken(request.headers),
        adId: getParam("adId"),
        creativeId: getParam("creativeId")
      })
    );
  } catch (error) {
    sendJson(response, 400, {
      message: error.message || "Nao foi possivel abrir o preview deste anuncio."
    });
  }
}
