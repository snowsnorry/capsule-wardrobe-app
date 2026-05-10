import { createApp } from "../index.js";
import { logError } from "../logger.js";
import { createStartServer } from "../serverStartup.js";
import { registerE2eRoutes } from "./routes.js";
import { createE2eDependencies } from "./state.js";

const port = process.env.PORT || 5310;
const clientOrigin = process.env.CLIENT_ORIGIN || `http://127.0.0.1:${port}`;
const app = createApp(createE2eDependencies());

registerE2eRoutes(app);

const startServer = createStartServer(app);
const hmrPort = Number(process.env.E2E_VITE_HMR_PORT || 24679);

async function createE2eViteServer(config) {
  const { createServer } = await import("vite");
  return createServer({
    ...config,
    server: {
      ...config.server,
      hmr: { port: hmrPort },
    },
  });
}

startServer({
  appInstance: app,
  clientOrigin,
  createViteServerImpl: createE2eViteServer,
  ensureTablesImpl: async () => {},
  nodeEnv: "development",
  port,
}).catch((error) => {
  logError("[e2e/server]", error);
  process.exitCode = 1;
});
