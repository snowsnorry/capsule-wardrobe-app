import { logInfo } from "../logger.js";
import { createAuthorizationCode, hashOAuthSecret } from "./oauthCrypto.js";
import { scopesToKey } from "./oauthScopes.js";
import type { McpAuthorizationRequest } from "./types.js";

async function issueAuthorizationCode({
  authRequest,
  context,
  userEmail,
}: {
  authRequest: McpAuthorizationRequest;
  context;
  userEmail: string;
}): Promise<string> {
  const code = createAuthorizationCode();
  await context.insertMcpAuthorizationCodeImpl({
    clientId: authRequest.clientId,
    codeChallenge: authRequest.codeChallenge,
    codeChallengeMethod: authRequest.codeChallengeMethod,
    codeHash: hashOAuthSecret(code),
    expiresAt: new Date(
      Date.now() + context.mcpOAuthConfig.authCodeTtlSeconds * 1000,
    ),
    redirectUri: authRequest.redirectUri,
    resource: authRequest.resource,
    scopes: scopesToKey(authRequest.scopes),
    userEmail,
  });
  return code;
}

export async function redirectWithAuthorizationCode({
  authRequest,
  context,
  res,
  userEmail,
}: {
  authRequest: McpAuthorizationRequest;
  context;
  res;
  userEmail: string;
}) {
  const code = await issueAuthorizationCode({
    authRequest,
    context,
    userEmail,
  });
  const redirectUrl = new URL(authRequest.redirectUri);
  redirectUrl.searchParams.set("code", code);
  redirectUrl.searchParams.set("state", authRequest.state);
  logInfo("mcp.oauth.authorize.completed", {
    clientId: authRequest.clientId,
    scopes: scopesToKey(authRequest.scopes),
    subject: userEmail,
  });
  return res.redirect(302, redirectUrl.toString());
}
