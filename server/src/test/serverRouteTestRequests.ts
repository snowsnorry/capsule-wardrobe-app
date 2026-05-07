import type {
  RequestJsonOptions,
  RequestJsonResult,
} from "./serverRouteTestTypes.js";

export async function requestJson(
  baseUrl,
  pathname,
  {
    method = "GET",
    body,
    cookie,
    csrfToken,
    origin,
    headers = {},
  }: RequestJsonOptions = {},
): Promise<RequestJsonResult> {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(cookie ? { cookie } : {}),
      ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
      ...(origin ? { origin } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await response.text();
  let json = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = text;
    }
  }

  return { response, json };
}

export async function requestText(
  baseUrl,
  pathname,
  headers: Record<string, string> = {},
) {
  const response = await fetch(`${baseUrl}${pathname}`, { headers });
  return {
    response,
    text: await response.text(),
  };
}
