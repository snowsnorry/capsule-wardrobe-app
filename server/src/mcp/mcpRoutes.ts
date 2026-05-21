import { createMcpAuthMiddleware } from "./mcpAuth.js";

function diagnosticResponse(req) {
  return {
    ok: true,
    service: "capsule-wardrobe-mcp",
    subject: req.mcpAuth.subject,
    scopes: req.mcpAuth.scopes,
  };
}

function jsonRpcResponse(id: unknown, result: unknown) {
  return { jsonrpc: "2.0", id, result };
}

function jsonRpcError(id: unknown, code: number, message: string) {
  return { jsonrpc: "2.0", id: id ?? null, error: { code, message } };
}

function handleJsonRpc(req, res) {
  const body = req.body || {};
  if (body.method === "initialize") {
    return res.json(
      jsonRpcResponse(body.id, {
        protocolVersion: "2025-03-26",
        capabilities: { tools: { listChanged: false } },
        serverInfo: {
          name: "capsule-wardrobe-mcp",
          version: "0.1.0",
        },
      }),
    );
  }

  if (body.method === "notifications/initialized") {
    return res.status(202).json({ ok: true });
  }

  if (body.method === "tools/list") {
    return res.json(jsonRpcResponse(body.id, { tools: [] }));
  }

  if (!body.method) {
    return res.json(diagnosticResponse(req));
  }

  return res
    .status(404)
    .json(jsonRpcError(body.id, -32601, "Method not found"));
}

export function registerMcpRoutes(app, context) {
  const requireMcpBearerToken = createMcpAuthMiddleware(context);

  app.get("/mcp", requireMcpBearerToken, (req, res) => {
    res.json(diagnosticResponse(req));
  });

  app.post("/mcp", requireMcpBearerToken, (req, res) => {
    handleJsonRpc(req, res);
  });
}
