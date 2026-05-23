import { CONSENT_APP_NAME } from "./oauthConstants.js";
import { escapeHtml } from "./oauthRequestHelpers.js";
import { scopesToKey } from "./oauthScopes.js";
import type { McpAuthorizationRequest } from "./types.js";

function buildConsentHiddenInputs(
  authRequest: McpAuthorizationRequest,
  csrfToken: string,
): string {
  return [
    ["response_type", authRequest.responseType],
    ["client_id", authRequest.clientId],
    ["redirect_uri", authRequest.redirectUri],
    ["code_challenge", authRequest.codeChallenge],
    ["code_challenge_method", authRequest.codeChallengeMethod],
    ["scope", scopesToKey(authRequest.scopes)],
    ["state", authRequest.state],
    ["resource", authRequest.resource],
    ["csrfToken", csrfToken],
  ]
    .map(
      ([name, value]) =>
        `<input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(value)}" />`,
    )
    .join("\n");
}

export function renderConsentPage({
  authRequest,
  csrfToken,
  signedInUser,
}: {
  authRequest: McpAuthorizationRequest;
  csrfToken: string;
  signedInUser: string;
}): string {
  const hiddenInputs = buildConsentHiddenInputs(authRequest, csrfToken);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${CONSENT_APP_NAME}</title>
  <style>
    body { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 0; background: #f6f7f9; color: #17202a; }
    main { max-width: 560px; margin: 12vh auto; padding: 28px; background: #fff; border: 1px solid #dce1e7; border-radius: 8px; }
    h1 { font-size: 24px; margin: 0 0 16px; }
    dl { display: grid; grid-template-columns: 120px 1fr; gap: 10px 16px; }
    dt { color: #5d6978; }
    dd { margin: 0; word-break: break-word; }
    .actions { display: flex; gap: 12px; margin-top: 24px; }
    button { border: 1px solid #0f172a; border-radius: 6px; padding: 10px 14px; background: #fff; color: #0f172a; cursor: pointer; }
    button[value="allow"] { background: #0f172a; color: #fff; }
  </style>
</head>
<body>
  <main>
    <h1>${CONSENT_APP_NAME}</h1>
    <p>Allow ChatGPT to connect to your Capsule Wardrobe account with read-only MCP access.</p>
    <dl>
      <dt>Client</dt><dd>${escapeHtml(authRequest.clientId)}</dd>
      <dt>Scopes</dt><dd>${escapeHtml(scopesToKey(authRequest.scopes))}</dd>
      <dt>Signed in as</dt><dd>${escapeHtml(signedInUser)}</dd>
    </dl>
    <form method="post" action="/oauth/authorize">
      ${hiddenInputs}
      <div class="actions">
        <button type="submit" name="decision" value="allow">Allow</button>
        <button type="submit" name="decision" value="deny">Deny</button>
      </div>
    </form>
  </main>
</body>
</html>`;
}
