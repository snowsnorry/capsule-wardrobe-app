import "dotenv/config";
import { createApp } from "./appFactory.js";
import { createStartServer } from "./serverStartup.js";
import { logError } from "./logger.js";

const app = createApp();
const startServer = createStartServer(app);

function shouldStartServer(env: NodeJS.ProcessEnv) {
  return env.NODE_ENV !== "test" && env.E2E_SERVER !== "true";
}

function handleStartServerError(error: unknown) {
  logError("[server/start]", error);
  process.exitCode = 1;
}

if (shouldStartServer(process.env)) {
  void startServer().catch(handleStartServerError);
}

export {
  app,
  createApp,
  handleStartServerError,
  shouldStartServer,
  startServer,
};
