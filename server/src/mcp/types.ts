export const MCP_READ_SCOPES = [
  "mcp:read",
  "profile:read",
  "wardrobe:read",
  "capsules:read",
] as const;

export type McpReadScope = (typeof MCP_READ_SCOPES)[number];

export type McpOAuthConfig = {
  accessTokenTtlSeconds: number;
  allowUnregisteredClients: boolean;
  allowedClientIds: Set<string>;
  allowedClientMetadataHosts: Set<string>;
  allowedRedirectOrigins: Set<string>;
  allowedRedirectUris: Set<string>;
  authCodeTtlSeconds: number;
  enabled: boolean;
  issuer: string;
  jwtSecret: string;
  refreshTokenTtlSeconds: number;
  resourceUrl: string;
  scopesSupported: readonly McpReadScope[];
};

export type McpOAuthClientMetadata = {
  clientName?: string;
  redirectUris: string[];
};

export type McpOAuthGrantTypes =
  | "authorization_code"
  | "authorization_code refresh_token";

export type McpRegisteredClientRow = {
  clientId: string;
  clientName: string | null;
  redirectUris: string[];
  scope: string | null;
  tokenEndpointAuthMethod: "none";
  grantTypes: McpOAuthGrantTypes;
  responseTypes: "code";
  createdAt: string | Date;
  updatedAt: string | Date;
};

export type McpAuthorizationRequest = {
  clientId: string;
  codeChallenge: string;
  codeChallengeMethod: "S256";
  redirectUri: string;
  resource: string;
  responseType: "code";
  scopes: McpReadScope[];
  state: string;
};

export type McpAuthorizationCodeRow = {
  codeHash: string;
  userEmail: string;
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  scopes: string;
  resource: string;
  expiresAt: string | Date;
  consumedAt: string | Date | null;
  createdAt: string | Date;
};

export type McpRefreshTokenRow = {
  tokenHash: string;
  userEmail: string;
  clientId: string;
  scopes: string;
  resource: string;
  expiresAt: string | Date;
  revokedAt: string | Date | null;
  createdAt: string | Date;
  consumedAt: string | Date | null;
};

export type McpAccessTokenClaims = {
  aud: string;
  client_id: string;
  exp: number;
  iat: number;
  iss: string;
  scope: string;
  sub: string;
  token_use: "access";
};

export type McpAuthenticatedSubject = {
  clientId: string;
  scopes: McpReadScope[];
  subject: string;
};
