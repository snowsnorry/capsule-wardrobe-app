export const MCP_READ_SCOPES = [
  "profile:read",
  "wardrobe:read",
  "capsules:read",
  "mcp:read",
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
  resourceUrl: string;
  scopesSupported: readonly McpReadScope[];
};

export type McpOAuthClientMetadata = {
  clientName?: string;
  redirectUris: string[];
};

export type McpRegisteredClientRow = {
  clientId: string;
  clientName: string | null;
  redirectUris: string[];
  scope: string | null;
  tokenEndpointAuthMethod: "none";
  grantTypes: "authorization_code";
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
