import type { Server } from "node:http";
import { once } from "node:events";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { TEST_CLIENT_ORIGIN } from "./serverRouteTestConstants.js";
import { createDependencies } from "./serverRouteTestDependencies.js";
import type {
  CleanupContext,
  DependencyOverrides,
  StartedTestServer,
} from "./serverRouteTestTypes.js";

const { createApp, startServer } = await import("../index.ts");

function registerCleanup(
  testContext: CleanupContext,
  cleanup: () => Promise<void>,
): void {
  if (typeof testContext.onTestFinished === "function") {
    testContext.onTestFinished(cleanup);
    return;
  }

  if (typeof testContext.after === "function") {
    testContext.after(cleanup);
    return;
  }

  throw new Error("test cleanup context is missing");
}

async function waitForListeningServer(server: Server): Promise<Server> {
  if (server.address()) {
    return server;
  }

  await once(server, "listening");
  return server;
}

export async function startTestServer(
  testContext: CleanupContext,
  {
    nodeEnv = "production",
    authTestMode = false,
    googleClientId = "google-client-id",
    googleAuthClient = null,
    overrides = {},
  }: {
    nodeEnv?: string;
    authTestMode?: boolean;
    googleClientId?: string;
    googleAuthClient?: unknown | null;
    overrides?: DependencyOverrides;
  } = {},
): Promise<StartedTestServer> {
  const deps = createDependencies(overrides);
  const app = createApp({
    nodeEnv,
    clientOrigin: TEST_CLIENT_ORIGIN,
    authTestMode,
    googleClientId,
    googleAuthClient,
    ...deps,
  });

  const server = await waitForListeningServer(app.listen(0, "127.0.0.1"));

  registerCleanup(testContext, async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  return {
    deps,
    baseUrl: `http://127.0.0.1:${(server.address() as { port: number }).port}`,
  };
}

export async function startSpaFallbackTestServer(
  testContext: CleanupContext,
  {
    overrides = {},
  }: {
    overrides?: DependencyOverrides;
  } = {},
): Promise<StartedTestServer> {
  const deps = createDependencies(overrides);
  const app = createApp({
    nodeEnv: "production",
    clientOrigin: TEST_CLIENT_ORIGIN,
    ...deps,
  });
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "capsule-og-test-"));
  await fs.writeFile(
    path.join(tempDir, "index.html"),
    '<!doctype html><html><head><title>Capsule Wardrobe</title></head><body><div id="root"></div></body></html>',
    "utf-8",
  );

  const server = await waitForListeningServer(
    await startServer({
      appInstance: app,
      nodeEnv: "production",
      ensureTablesImpl: async () => {},
      port: 0,
      clientOrigin: TEST_CLIENT_ORIGIN,
      clientDistPath: tempDir,
      getSharedCapsuleOgMetadataImpl: deps.getSharedCapsuleOgMetadataImpl,
      runProductionStartupPreflightImpl: () => {},
    }),
  );

  registerCleanup(testContext, async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  return {
    deps,
    baseUrl: `http://127.0.0.1:${(server.address() as { port: number }).port}`,
  };
}
