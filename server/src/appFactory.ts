import express from "express";
import {
  applyCorsMiddleware,
  applyObservabilityMiddleware,
  applySecurityMiddleware,
} from "./appMiddleware.js";
import { createAppDependencies } from "./appDependencies.js";
import { createAppRouteContext } from "./appRouteContext.js";
import { registerAppRoutes } from "./appRoutes.js";

function createExpressApp(deps) {
  const app = express();
  app.set("trust proxy", 1);
  applyObservabilityMiddleware(app);
  app.use(express.json({ limit: "100kb" }));
  app.use(express.urlencoded({ extended: false, limit: "20kb" }));
  applySecurityMiddleware(app, deps.nodeEnv, {
    clientOrigin: deps.clientOrigin,
    mcpOAuthIssuer: deps.mcpOAuthConfig?.issuer,
  });
  applyCorsMiddleware(app, {
    nodeEnv: deps.nodeEnv,
    clientOrigin: deps.clientOrigin,
  });
  return app;
}

export function createApp(options = {}) {
  const deps = createAppDependencies(options);
  const app = createExpressApp(deps);
  app.locals.appDependencies = deps;
  const routeContext = createAppRouteContext(deps);
  registerAppRoutes(app, routeContext);

  const apiRouter = express.Router();
  registerAppRoutes(apiRouter, routeContext);
  app.use("/api", apiRouter);

  return app;
}
