function createMcpOAuthRefreshTokenDependencies(
  refreshTokens: Map<string, Record<string, unknown>>,
) {
  return {
    getMcpRefreshTokenImpl: async (tokenHash) =>
      refreshTokens.get(tokenHash) || null,
    insertMcpRefreshTokenImpl: async (payload) => {
      refreshTokens.set(payload.tokenHash, {
        ...payload,
        revokedAt: null,
        createdAt: new Date().toISOString(),
        consumedAt: null,
      });
    },
    rotateMcpRefreshTokenImpl: async ({
      tokenHash,
      newTokenHash,
      clientId,
      scopes,
      resource,
      expiresAt,
    }) => {
      const entry = refreshTokens.get(tokenHash);
      if (
        !entry ||
        entry.consumedAt ||
        entry.revokedAt ||
        entry.clientId !== clientId ||
        entry.resource !== resource ||
        new Date(String(entry.expiresAt)).getTime() <= Date.now()
      ) {
        return null;
      }

      entry.consumedAt = new Date().toISOString();
      const rotated = {
        tokenHash: newTokenHash,
        userEmail: entry.userEmail,
        clientId: entry.clientId,
        scopes,
        resource: entry.resource,
        expiresAt,
        revokedAt: null,
        createdAt: new Date().toISOString(),
        consumedAt: null,
      };
      refreshTokens.set(newTokenHash, rotated);
      return rotated;
    },
    revokeMcpRefreshTokenImpl: async (tokenHash) => {
      const entry = refreshTokens.get(tokenHash);
      if (!entry || entry.revokedAt) {
        return false;
      }
      entry.revokedAt = new Date().toISOString();
      return true;
    },
  };
}

export function createMcpOAuthDependencies() {
  const authorizationCodes = new Map<string, Record<string, unknown>>();
  const grants: Record<string, unknown>[] = [];
  const registeredClients = new Map<string, Record<string, unknown>>();
  const refreshTokens = new Map<string, Record<string, unknown>>();

  return {
    getMcpRegisteredClientImpl: async (clientId) =>
      registeredClients.get(clientId) || null,
    ...createMcpOAuthRefreshTokenDependencies(refreshTokens),
    insertMcpAuthorizationCodeImpl: async (payload) => {
      authorizationCodes.set(payload.codeHash, {
        ...payload,
        consumedAt: null,
        createdAt: new Date().toISOString(),
      });
    },
    insertMcpRegisteredClientImpl: async (payload) => {
      const now = new Date().toISOString();
      const client = {
        clientId: payload.clientId,
        clientName: payload.clientName,
        grantTypes: payload.grantTypes,
        redirectUris: payload.redirectUris,
        scope: payload.scope,
        tokenEndpointAuthMethod: "none",
        responseTypes: "code",
        createdAt: now,
        updatedAt: now,
      };
      registeredClients.set(payload.clientId, client);
      return client;
    },
    consumeMcpAuthorizationCodeImpl: async ({
      codeHash,
      clientId,
      redirectUri,
      codeChallenge,
      resource,
    }) => {
      const entry = authorizationCodes.get(codeHash);
      if (
        !entry ||
        entry.consumedAt ||
        entry.clientId !== clientId ||
        entry.redirectUri !== redirectUri ||
        entry.codeChallenge !== codeChallenge ||
        entry.resource !== resource ||
        new Date(String(entry.expiresAt)).getTime() <= Date.now()
      ) {
        return null;
      }

      const consumedAt = new Date().toISOString();
      entry.consumedAt = consumedAt;
      return {
        ...entry,
        consumedAt,
      };
    },
    hasActiveMcpGrantImpl: async ({ userEmail, clientId, scopes, resource }) =>
      grants.some(
        (grant) =>
          grant.userEmail === userEmail &&
          grant.clientId === clientId &&
          grant.scopes === scopes &&
          grant.resource === resource &&
          !grant.revokedAt,
      ),
    upsertMcpGrantImpl: async ({ userEmail, clientId, scopes, resource }) => {
      const exists = grants.some(
        (grant) =>
          grant.userEmail === userEmail &&
          grant.clientId === clientId &&
          grant.scopes === scopes &&
          grant.resource === resource &&
          !grant.revokedAt,
      );
      if (!exists) {
        grants.push({
          userEmail,
          clientId,
          scopes,
          resource,
          createdAt: new Date().toISOString(),
          revokedAt: null,
        });
      }
    },
  };
}
