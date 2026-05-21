import { afterEach, expect, test } from "vitest";
import {
  setSqlClientOverride,
  type SqlClientLike,
  type SqlResultLike,
} from "./core.js";
import {
  consumeMcpAuthorizationCode,
  getMcpAuthorizationCode,
  getMcpRegisteredClient,
  hasActiveMcpGrant,
  insertMcpAuthorizationCode,
  insertMcpRegisteredClient,
  upsertMcpGrant,
} from "./mcpOAuth.js";
import type {
  McpAuthorizationCodeRow,
  McpRegisteredClientRow,
} from "../mcp/types.js";

function useQueuedSql(results: SqlResultLike[]) {
  const statements: string[] = [];
  const values: unknown[][] = [];
  const sql = (async (
    strings: TemplateStringsArray,
    ...queryValues: readonly unknown[]
  ) => {
    statements.push(strings.join("?").replace(/\s+/g, " ").trim());
    values.push([...queryValues]);
    return results.shift() ?? [];
  }) as SqlClientLike;

  setSqlClientOverride(sql);
  return { statements, values };
}

afterEach(() => {
  setSqlClientOverride(null);
});

const authorizationCodeRow: McpAuthorizationCodeRow = {
  codeHash: "code-hash",
  userEmail: "person@example.com",
  clientId: "chatgpt-dev",
  redirectUri: "https://chatgpt.com/oauth/callback",
  codeChallenge: "challenge",
  codeChallengeMethod: "S256",
  scopes: "mcp:read wardrobe:read",
  resource: "https://app.example/mcp",
  expiresAt: "2099-01-01T00:00:00.000Z",
  consumedAt: null,
  createdAt: "2026-05-21T00:00:00.000Z",
};

const registeredClientRow: McpRegisteredClientRow = {
  clientId: "mcp-dcr_client",
  clientName: "Codex",
  redirectUris: ["http://127.0.0.1:5555/callback"],
  scope: "mcp:read",
  tokenEndpointAuthMethod: "none",
  grantTypes: "authorization_code",
  responseTypes: "code",
  createdAt: "2026-05-21T00:00:00.000Z",
  updatedAt: "2026-05-21T00:00:00.000Z",
};

test("mcp authorization code helpers insert, select, and consume once", async () => {
  const expiresAt = new Date("2099-01-01T00:00:00.000Z");
  const { statements, values } = useQueuedSql([
    [],
    [authorizationCodeRow],
    [authorizationCodeRow],
    [],
  ]);

  await insertMcpAuthorizationCode({
    ...authorizationCodeRow,
    expiresAt,
  });
  expect(await getMcpAuthorizationCode("code-hash")).toEqual(
    authorizationCodeRow,
  );
  expect(
    await consumeMcpAuthorizationCode({
      codeHash: "code-hash",
      clientId: "chatgpt-dev",
      redirectUri: "https://chatgpt.com/oauth/callback",
      codeChallenge: "challenge",
      resource: "https://app.example/mcp",
    }),
  ).toEqual(authorizationCodeRow);
  expect(await getMcpAuthorizationCode("missing")).toBeNull();

  expect(statements[0]).toContain("insert into mcp_oauth_authorization_codes");
  expect(statements[2]).toContain("set consumed_at = now()");
  expect(values[0]).toEqual([
    "code-hash",
    "person@example.com",
    "chatgpt-dev",
    "https://chatgpt.com/oauth/callback",
    "challenge",
    "S256",
    "mcp:read wardrobe:read",
    "https://app.example/mcp",
    expiresAt,
  ]);
});

test("mcp grant helpers check existing active grant before inserting", async () => {
  const { statements, values } = useQueuedSql([
    [],
    [],
    [],
    [{ id: "grant-1" }],
  ]);

  expect(
    await hasActiveMcpGrant({
      userEmail: "person@example.com",
      clientId: "chatgpt-dev",
      scopes: "mcp:read",
      resource: "https://app.example/mcp",
    }),
  ).toBe(false);
  await upsertMcpGrant({
    userEmail: "person@example.com",
    clientId: "chatgpt-dev",
    scopes: "mcp:read",
    resource: "https://app.example/mcp",
  });
  await upsertMcpGrant({
    userEmail: "person@example.com",
    clientId: "chatgpt-dev",
    scopes: "mcp:read",
    resource: "https://app.example/mcp",
  });

  expect(statements[0]).toContain("from mcp_oauth_grants");
  expect(statements[1]).toContain("from mcp_oauth_grants");
  expect(statements[2]).toContain("insert into mcp_oauth_grants");
  expect(statements[3]).toContain("from mcp_oauth_grants");
  expect(values[2]).toEqual([
    "person@example.com",
    "chatgpt-dev",
    "mcp:read",
    "https://app.example/mcp",
  ]);
});

test("mcp registered client helpers insert and fetch public clients", async () => {
  const { statements, values } = useQueuedSql([
    [registeredClientRow],
    [registeredClientRow],
    [],
  ]);

  expect(
    await insertMcpRegisteredClient({
      clientId: "mcp-dcr_client",
      clientName: "Codex",
      redirectUris: ["http://127.0.0.1:5555/callback"],
      scope: "mcp:read",
    }),
  ).toEqual(registeredClientRow);
  expect(await getMcpRegisteredClient("mcp-dcr_client")).toEqual(
    registeredClientRow,
  );
  expect(await getMcpRegisteredClient("missing")).toBeNull();

  expect(statements[0]).toContain("insert into mcp_oauth_registered_clients");
  expect(statements[1]).toContain("from mcp_oauth_registered_clients");
  expect(values[0]).toEqual([
    "mcp-dcr_client",
    "Codex",
    JSON.stringify(["http://127.0.0.1:5555/callback"]),
    "mcp:read",
  ]);
});
