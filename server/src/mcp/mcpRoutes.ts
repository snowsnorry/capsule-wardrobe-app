import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { randomUUID } from "node:crypto";
import { z } from "zod";

import { logError } from "../logger.js";
import { createMcpAuthMiddleware } from "./mcpAuth.js";
import { registerProductGridWidgetResource } from "./productGridWidget.js";
import { registerProductTools } from "./productTools.js";
import { registerWardrobeTools } from "./wardrobeTools.js";
import type { McpReadScope } from "./types.js";

const MCP_SERVER_NAME = "capsule-wardrobe-mcp";
const PING_DESCRIPTION =
  "Check that the Capsule Wardrobe MCP server is reachable and authenticated.";
const READ_ONLY_TOOL_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;
const PING_OUTPUT_SCHEMA = z.object({
  ok: z.boolean(),
  service: z.string(),
  authenticated: z.boolean(),
  subject: z.string(),
  scopes: z.array(z.string()),
});
const MCP_SESSION_TTL_MS = 30 * 60 * 1000;
type McpHttpSession = {
  clientId: string;
  scopes: McpReadScope[];
  server: McpServer;
  subject: string;
  timeout: ReturnType<typeof setTimeout> | null;
  transport: StreamableHTTPServerTransport;
};
const mcpSessions = new Map<string, McpHttpSession>();

function pingResponse(req) {
  return {
    ok: true,
    service: MCP_SERVER_NAME,
    authenticated: true,
    subject: req.mcpAuth.subject,
    scopes: req.mcpAuth.scopes,
  };
}

function hasScope(req, scope: McpReadScope): boolean {
  return req.mcpAuth.scopes.includes(scope);
}

function includesSessionScopes(
  requestScopes: readonly McpReadScope[],
  sessionScopes: readonly McpReadScope[],
): boolean {
  const requestScopeSet = new Set(requestScopes);
  return sessionScopes.every((scope) => requestScopeSet.has(scope));
}

async function createMcpServer(req, context) {
  const server = new McpServer({
    name: MCP_SERVER_NAME,
    version: "0.1.0",
  });

  registerProductGridWidgetResource(server);

  server.registerTool(
    "ping",
    {
      description: PING_DESCRIPTION,
      inputSchema: {},
      outputSchema: PING_OUTPUT_SCHEMA,
      annotations: READ_ONLY_TOOL_ANNOTATIONS,
    },
    async () => {
      const response = pingResponse(req);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(response),
          },
        ],
        structuredContent: response,
      };
    },
  );

  if (hasScope(req, "catalog:read")) {
    await registerProductTools(server, {
      profileEmail: req.mcpAuth.subject,
      runSearchImpl: context.runMcpProductSearchImpl,
      getSearchStatsImpl: context.getSearchStatsImpl,
      getSearchOptionsImpl: context.getSearchOptionsImpl,
      getProductByIdImpl: context.getProductByIdForEmailImpl,
      getProductByUrlImpl: context.getProductByUrlForEmailImpl,
    });
  }

  if (hasScope(req, "personal-items:read")) {
    registerWardrobeTools(server, {
      profileEmail: req.mcpAuth.subject,
      listWardrobeItemsImpl: context.listWardrobeItemsImpl,
    });
  }

  return server;
}

function sendMcpInternalError(res) {
  if (res.headersSent || res.writableEnded) {
    return;
  }

  res.status(500).json({
    jsonrpc: "2.0",
    error: {
      code: -32603,
      message: "Internal server error",
    },
    id: null,
  });
}

async function handleMcpRequest(req, res, context) {
  let server: McpServer | null = null;
  let transport: StreamableHTTPServerTransport | null = null;

  try {
    server = await createMcpServer(req, context);
    transport = new StreamableHTTPServerTransport({
      enableJsonResponse: true,
      sessionIdGenerator: undefined,
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    logError("[mcp/request]", error);
    sendMcpInternalError(res);
  } finally {
    await transport?.close();
    await server?.close();
  }
}

function isInitializeRequestBody(body): boolean {
  const messages = Array.isArray(body) ? body : [body];
  return messages.some(
    (message) =>
      message && typeof message === "object" && message.method === "initialize",
  );
}

function getMcpSessionId(req): string {
  return String(req.headers["mcp-session-id"] || "").trim();
}

async function closeMcpSession(sessionId: string, closeTransport = true) {
  const session = mcpSessions.get(sessionId);
  if (!session) {
    return;
  }
  mcpSessions.delete(sessionId);
  if (session.timeout) {
    clearTimeout(session.timeout);
  }
  if (closeTransport) {
    await session.transport.close();
  }
  await session.server.close();
}

function refreshMcpSession(sessionId: string, session: McpHttpSession) {
  if (session.timeout) {
    clearTimeout(session.timeout);
  }
  session.timeout = setTimeout(() => {
    void closeMcpSession(sessionId);
  }, MCP_SESSION_TTL_MS);
}

function getMcpSession(req, res) {
  const sessionId = getMcpSessionId(req);
  if (!sessionId) {
    return null;
  }

  const session = mcpSessions.get(sessionId);
  if (!session) {
    res.status(404).json({ error: "session_not_found" });
    return null;
  }

  if (
    session.subject !== req.mcpAuth.subject ||
    session.clientId !== req.mcpAuth.clientId ||
    !includesSessionScopes(req.mcpAuth.scopes, session.scopes)
  ) {
    res.status(404).json({ error: "session_not_found" });
    return null;
  }

  refreshMcpSession(sessionId, session);
  return session;
}

async function handleStatefulMcpInitialize(req, res, context) {
  let sessionId = "";
  let server: McpServer | null = null;
  let transport: StreamableHTTPServerTransport | null = null;
  let session: McpHttpSession | null = null;

  try {
    server = await createMcpServer(req, context);
    transport = new StreamableHTTPServerTransport({
      enableJsonResponse: true,
      sessionIdGenerator: randomUUID,
      onsessioninitialized: (initializedSessionId) => {
        if (!session) {
          return;
        }
        sessionId = initializedSessionId;
        mcpSessions.set(initializedSessionId, session);
        refreshMcpSession(initializedSessionId, session);
      },
      onsessionclosed: (closedSessionId) => {
        void closeMcpSession(closedSessionId, false);
      },
    });
    session = {
      clientId: req.mcpAuth.clientId,
      scopes: req.mcpAuth.scopes,
      server,
      subject: req.mcpAuth.subject,
      timeout: null,
      transport,
    };
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    logError("[mcp/request]", error);
    sendMcpInternalError(res);
  } finally {
    if (!sessionId) {
      await transport?.close();
      await server?.close();
    }
  }
}

async function handleStatefulMcpSessionRequest(req, res) {
  const session = getMcpSession(req, res);
  if (!session) {
    return;
  }

  try {
    await session.transport.handleRequest(req, res, req.body);
  } catch (error) {
    logError("[mcp/request]", error);
    sendMcpInternalError(res);
  }
}

async function handleMcpTransportRequest(req, res, context) {
  if (getMcpSessionId(req)) {
    await handleStatefulMcpSessionRequest(req, res);
    return;
  }

  if (req.method === "POST" && isInitializeRequestBody(req.body)) {
    await handleStatefulMcpInitialize(req, res, context);
    return;
  }

  await handleMcpRequest(req, res, context);
}

export function registerMcpRoutes(app, context) {
  const requireMcpBearerToken = createMcpAuthMiddleware(context);

  app.all("/mcp", requireMcpBearerToken, async (req, res) => {
    try {
      await handleMcpTransportRequest(req, res, context);
    } catch (error) {
      logError("[mcp/request]", error);
      sendMcpInternalError(res);
    }
  });
}
