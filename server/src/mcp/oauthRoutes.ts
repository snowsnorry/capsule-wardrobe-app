import { parseCookies } from "../httpCookies.js";
import { logError, logInfo } from "../logger.js";
import { buildIssuerUrl, createMcpOAuthConfig } from "./oauthConfig.js";
import { CONSENT_APP_NAME } from "./oauthConstants.js";
import { redirectWithAuthorizationCode } from "./oauthAuthorizationCodes.js";
import { validateAuthorizationRequest } from "./oauthClientValidation.js";
import { renderConsentPage } from "./oauthConsentPage.js";
import {
  createConsentCsrfToken,
  createRegisteredClientId,
} from "./oauthCrypto.js";
import {
  buildRegistrationResponse,
  validateRegistrationRequest,
} from "./oauthRegistration.js";
import { redirectWithOAuthError } from "./oauthRedirects.js";
import { readString } from "./oauthRequestHelpers.js";
import { scopesToKey } from "./oauthScopes.js";
import { buildLoginRedirect, readAppSession } from "./oauthSession.js";
import {
  handleAuthorizationCodeTokenRequest,
  handleRefreshTokenGrantRequest,
} from "./oauthTokenHandlers.js";

export function registerMcpOAuthRoutes(app, context) {
  const config = context.mcpOAuthConfig ?? createMcpOAuthConfig();
  if (!config.enabled) {
    return;
  }

  registerOAuthDiscoveryRoutes(app, config);
  registerOAuthClientRegistrationRoute(app, context, config);
  registerOAuthAuthorizationRoutes(app, context, config);
  registerOAuthTokenRoute(app, context, config);
}

function registerOAuthDiscoveryRoutes(app, config) {
  app.get("/.well-known/oauth-protected-resource", (_req, res) => {
    res.json({
      resource: config.resourceUrl,
      resource_name: CONSENT_APP_NAME,
      authorization_servers: [config.issuer],
      bearer_methods_supported: ["header"],
      scopes_supported: config.scopesSupported,
    });
  });

  const authorizationServerMetadata = {
    issuer: config.issuer,
    authorization_endpoint: buildIssuerUrl(config, "/oauth/authorize"),
    token_endpoint: buildIssuerUrl(config, "/oauth/token"),
    registration_endpoint: buildIssuerUrl(config, "/oauth/register"),
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    scopes_supported: config.scopesSupported,
    resource_parameter_supported: true,
  };

  app.get("/.well-known/oauth-authorization-server", (_req, res) => {
    res.json(authorizationServerMetadata);
  });

  app.get("/.well-known/openid-configuration", (_req, res) => {
    res.json(authorizationServerMetadata);
  });
}

function registerOAuthClientRegistrationRoute(app, context, config) {
  app.post(
    "/oauth/register",
    context.oauthRegisterLimiter,
    async (req, res) => {
      const registration = validateRegistrationRequest(req.body, config);
      if ("error" in registration) {
        logInfo("[mcp/oauth/register/failure]", { error: registration.error });
        return res.status(400).json({ error: registration.error });
      }

      try {
        const client = await context.insertMcpRegisteredClientImpl({
          clientId: createRegisteredClientId(),
          clientName: registration.clientName,
          grantTypes: registration.grantTypes,
          redirectUris: registration.redirectUris,
          scope: registration.scope,
        });
        logInfo("[mcp/oauth/register/success]", {
          clientId: client.clientId,
          redirectUriCount: client.redirectUris.length,
        });
        return res.status(201).json(buildRegistrationResponse(client));
      } catch (error) {
        logError("[mcp/oauth/register]", error);
        return res.status(503).json({ error: "service_unavailable" });
      }
    },
  );
}

function registerOAuthAuthorizationRoutes(app, context, config) {
  registerOAuthAuthorizeGetRoute(app, context, config);
  registerOAuthAuthorizePostRoute(app, context, config);
}

function registerOAuthAuthorizeGetRoute(app, context, config) {
  app.get("/oauth/authorize", async (req, res) => {
    const authRequest = await validateAuthorizationRequest(
      req.query,
      config,
      context,
    );
    if ("error" in authRequest) {
      logInfo("[mcp/oauth/authorize/failure]", { error: authRequest.error });
      return res.status(400).json({ error: authRequest.error });
    }

    let sessionInfo;
    try {
      sessionInfo = await readAppSession(req, context);
    } catch (error) {
      logError("[mcp/oauth/authorize/session]", error);
      return res.status(503).json({ error: "service_unavailable" });
    }

    if (!sessionInfo) {
      return res.redirect(302, buildLoginRedirect(req));
    }

    const scopes = scopesToKey(authRequest.scopes);
    if (
      await context.hasActiveMcpGrantImpl({
        clientId: authRequest.clientId,
        resource: authRequest.resource,
        scopes,
        userEmail: sessionInfo.session.email,
      })
    ) {
      return redirectWithAuthorizationCode({
        authRequest,
        context,
        res,
        userEmail: sessionInfo.session.email,
      });
    }

    return res
      .status(200)
      .type("html")
      .send(
        renderConsentPage({
          authRequest,
          csrfToken: createConsentCsrfToken(
            sessionInfo.sessionId,
            sessionInfo.session.csrfToken,
          ),
          signedInUser: sessionInfo.session.email,
        }),
      );
  });
}

function registerOAuthAuthorizePostRoute(app, context, config) {
  app.post("/oauth/authorize", async (req, res) => {
    const authRequest = await validateAuthorizationRequest(
      req.body,
      config,
      context,
    );
    if ("error" in authRequest) {
      logInfo("[mcp/oauth/authorize/consent-failure]", {
        error: authRequest.error,
      });
      return res.status(400).json({ error: authRequest.error });
    }

    let sessionInfo;
    try {
      sessionInfo = await readAppSession(req, context);
    } catch (error) {
      logError("[mcp/oauth/authorize/consent-session]", error);
      return res.status(503).json({ error: "service_unavailable" });
    }

    if (!sessionInfo) {
      return res.redirect(302, buildLoginRedirect(req));
    }

    const cookies = parseCookies(req.headers.cookie);
    const expectedCsrf = createConsentCsrfToken(
      sessionInfo.sessionId,
      sessionInfo.session.csrfToken,
    );
    if (
      readString(req.body?.csrfToken) !== expectedCsrf ||
      cookies.csrf !== sessionInfo.session.csrfToken
    ) {
      return res.status(403).json({ error: "csrf_invalid" });
    }

    if (readString(req.body?.decision) !== "allow") {
      logInfo("[mcp/oauth/authorize/denied]", {
        clientId: authRequest.clientId,
        subject: sessionInfo.session.email,
      });
      return res.redirect(
        302,
        redirectWithOAuthError(
          authRequest.redirectUri,
          authRequest.state,
          "access_denied",
        ),
      );
    }

    const scopes = scopesToKey(authRequest.scopes);
    await context.upsertMcpGrantImpl({
      clientId: authRequest.clientId,
      resource: authRequest.resource,
      scopes,
      userEmail: sessionInfo.session.email,
    });

    return redirectWithAuthorizationCode({
      authRequest,
      context,
      res,
      userEmail: sessionInfo.session.email,
    });
  });
}

function registerOAuthTokenRoute(app, context, config) {
  app.post("/oauth/token", context.oauthTokenLimiter, async (req, res) => {
    if (req.headers.authorization || readString(req.body?.client_secret)) {
      logInfo("[mcp/oauth/token/failure]", { error: "invalid_client" });
      return res.status(400).json({ error: "invalid_client" });
    }

    const grantType = readString(req.body?.grant_type);
    if (grantType === "authorization_code") {
      return handleAuthorizationCodeTokenRequest({ config, context, req, res });
    }

    if (grantType === "refresh_token") {
      return handleRefreshTokenGrantRequest({ config, context, req, res });
    }

    logInfo("[mcp/oauth/token/failure]", { error: "invalid_request" });
    return res.status(400).json({ error: "invalid_request" });
  });
}
