import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

import { logError } from "../logger.js";
import { createMcpAuthMiddleware } from "./mcpAuth.js";
import { registerProductTools } from "./productTools.js";
import { registerWardrobeTools } from "./wardrobeTools.js";

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

function pingResponse(req) {
  return {
    ok: true,
    service: MCP_SERVER_NAME,
    authenticated: true,
    subject: req.mcpAuth.subject,
    scopes: req.mcpAuth.scopes,
  };
}

async function createMcpServer(req, context) {
  const server = new McpServer({
    name: MCP_SERVER_NAME,
    version: "0.1.0",
  });

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

  await registerProductTools(server, {
    profileEmail: req.mcpAuth.subject,
    runSearchImpl: context.runMcpProductSearchImpl,
    getSearchStatsImpl: context.getSearchStatsImpl,
    getSearchOptionsImpl: context.getSearchOptionsImpl,
    getProductByIdImpl: context.getProductByIdForEmailImpl,
    getProductByUrlImpl: context.getProductByUrlForEmailImpl,
  });
  registerWardrobeTools(server, {
    profileEmail: req.mcpAuth.subject,
    listWardrobeItemsImpl: context.listWardrobeItemsImpl,
  });

  return server;
}

function sendMcpInternalError(res) {
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
  const server = await createMcpServer(req, context);
  const transport = new StreamableHTTPServerTransport({
    enableJsonResponse: true,
    sessionIdGenerator: undefined,
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    logError("[mcp/request]", error);
    sendMcpInternalError(res);
  } finally {
    await transport.close();
    await server.close();
  }
}

export function registerMcpRoutes(app, context) {
  const requireMcpBearerToken = createMcpAuthMiddleware(context);

  app.all("/mcp", requireMcpBearerToken, (req, res) => {
    void handleMcpRequest(req, res, context);
  });
}
