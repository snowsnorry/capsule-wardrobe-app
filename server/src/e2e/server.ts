import { createApp } from "../index.js";
import { logError } from "../logger.js";
import { createStartServer } from "../serverStartup.js";
import { installE2eLogFilter } from "./logFilter.js";
import { registerE2eRoutes } from "./routes.js";
import { createE2eDependencies, e2eState } from "./state.js";

const port = process.env.PORT || 5310;
const clientOrigin = process.env.CLIENT_ORIGIN || `http://127.0.0.1:${port}`;
installE2eLogFilter();
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
      ws: { port: hmrPort },
    },
  });
}

startServer({
  appInstance: app,
  clientOrigin,
  createViteServerImpl: createE2eViteServer,
  ensureTablesImpl: async () => {},
  getSharedCapsuleOgMetadataImpl: async (id) =>
    e2eState.getShareOgMetadataById(id),
  nodeEnv: "development",
  port,
}).catch((error) => {
  logError("e2e.server.failed", error);
  process.exitCode = 1;
});
