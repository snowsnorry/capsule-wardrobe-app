import { EventEmitter } from "node:events";
import type { ChildProcess } from "node:child_process";
import type {
  PromptDebugImageResult,
  PromptDebugImageCategory,
  PromptDebugImageStitched
} from "../ai/types.js";

function buildPromptDebugImageStitched(
  overrides: Partial<PromptDebugImageStitched> = {}
): PromptDebugImageStitched {
  return {
    category: "all-categories",
    mimeType: "image/jpeg",
    filename: "categories-stitched.jpg",
    totalItems: 1,
    categoryCount: 1,
    buffer: Buffer.from("stitched"),
    ...overrides
  };
}

function buildPromptDebugImageCategory(
  overrides: Partial<PromptDebugImageCategory> = {}
): PromptDebugImageCategory {
  return {
    category: "top",
    mimeType: "image/jpeg",
    filename: "category-top.jpg",
    totalItems: 1,
    cachedCount: 0,
    downloadedCount: 1,
    skippedCount: 0,
    items: [],
    buffer: null,
    ...overrides
  };
}

function buildPromptDebugImageResult(
  overrides: Partial<PromptDebugImageResult> = {}
): PromptDebugImageResult {
  return {
    cachedCount: 0,
    downloadedCount: 1,
    skippedCount: 0,
    stitched: buildPromptDebugImageStitched(),
    categories: [buildPromptDebugImageCategory()],
    timings: {
      cacheLookupMs: 0,
      networkFetchMs: 0,
      sourceInspectMs: 0,
      tileBuildMs: 0,
      collageEncodeMs: 0,
      debugSaveMs: 0,
      categoryBuildMs: 0,
      childRoundTripMs: 0
    },
    ...overrides
  };
}

function createJsonResponse(payload: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(payload), {
    status: init.status ?? 200,
    headers: {
      "content-type": "application/json",
      ...(init.headers ?? {})
    }
  });
}

function createTextResponse(body: string, init: ResponseInit = {}): Response {
  return new Response(body, {
    status: init.status ?? 200,
    headers: init.headers
  });
}

function createBinaryResponse(body: Buffer | Uint8Array, init: ResponseInit = {}): Response {
  const payload = Buffer.isBuffer(body) ? new Uint8Array(body) : body;
  return new Response(payload, {
    status: init.status ?? 200,
    headers: init.headers
  });
}

function createMockChildProcess(): ChildProcess {
  const emitter = new EventEmitter();
  const child = Object.assign(emitter, {
    pid: 1234,
    connected: true,
    exitCode: null,
    signalCode: null,
    stdin: null,
    stdout: null,
    stderr: null,
    stdio: [],
    channel: null,
    send(message: unknown, callback?: (error: Error | null) => void) {
      callback?.(null);
      return true;
    },
    kill() {
      return true;
    },
    disconnect() {
      return child;
    }
  });

  return child as ChildProcess;
}

export {
  buildPromptDebugImageCategory,
  buildPromptDebugImageResult,
  buildPromptDebugImageStitched,
  createBinaryResponse,
  createJsonResponse,
  createMockChildProcess,
  createTextResponse
};
