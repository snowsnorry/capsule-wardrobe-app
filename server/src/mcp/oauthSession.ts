import { parseCookies } from "../httpCookies.js";

export async function readAppSession(req, context) {
  const cookies = parseCookies(req.headers.cookie);
  const sessionId = cookies.session;
  if (!sessionId) {
    return null;
  }

  const session = await context.getSessionImpl(sessionId);
  if (!session) {
    return null;
  }

  return { session, sessionId };
}

export function buildLoginRedirect(req): string {
  return `/personal-items?oauthReturnTo=${encodeURIComponent(req.originalUrl)}`;
}
