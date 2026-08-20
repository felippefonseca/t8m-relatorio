export async function readRequestJson(request) {
  if (request.body && typeof request.body === "object") return request.body;
  if (typeof request.body === "string") return parseJson(request.body);

  let raw = "";
  for await (const chunk of request) raw += chunk;
  return parseJson(raw);
}

export function sendJson(response, status, payload, headers = {}) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  for (const [key, value] of Object.entries(headers)) response.setHeader(key, value);
  response.end(JSON.stringify(payload));
}

function parseJson(raw) {
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}
