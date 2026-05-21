import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

import { logError } from "../logger.js";
import { createMcpAuthMiddleware } from "./mcpAuth.js";

const MCP_SERVER_NAME = "capsule-wardrobe-mcp";
const PING_DESCRIPTION =
  "Check that the Capsule Wardrobe MCP server is reachable and authenticated.";

function pingResponse(req) {
  return {
    ok: true,
    service: MCP_SERVER_NAME,
    authenticated: true,
    subject: req.mcpAuth.subject,
    scopes: req.mcpAuth.scopes,
  };
}

function createMcpServer(req) {
  const server = new McpServer({
    name: MCP_SERVER_NAME,
    version: "0.1.0",
  });

  server.registerTool(
    "ping",
    {
      description: PING_DESCRIPTION,
      inputSchema: {},
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

async function handleMcpRequest(req, res) {
  const server = createMcpServer(req);
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
    void handleMcpRequest(req, res);
  });
}
