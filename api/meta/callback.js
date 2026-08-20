import { createMetaTokenCookie } from "../../lib/auth.js";
import { exchangeCodeForToken } from "../../lib/meta-connector.js";

export default async function handler(request, response) {
  if (request.method !== "GET") {
    response.statusCode = 405;
    response.end("Metodo nao permitido.");
    return;
  }

  const query = request.query || {};
  const url = request.url ? new URL(request.url, "http://localhost") : null;
  const getParam = (name) => query[name] || url?.searchParams.get(name) || "";

  try {
    const accessToken = await exchangeCodeForToken(
      getParam("code"),
      getParam("state"),
      request.headers
    );
    response.writeHead(302, {
      "Set-Cookie": createMetaTokenCookie(accessToken),
      Location: "/?meta=connected"
    });
    response.end();
  } catch (error) {
    response.statusCode = 400;
    response.setHeader("Content-Type", "text/plain; charset=utf-8");
    response.end(error.message || "Nao foi possivel conectar com a Meta.");
  }
}
