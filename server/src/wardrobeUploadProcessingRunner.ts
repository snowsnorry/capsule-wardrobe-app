import { fork as nodeFork } from "node:child_process";
import { rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import {
  WARDROBE_UPLOAD_PROCESSING_CHILD_KILL_GRACE_MS,
  WARDROBE_UPLOAD_PROCESSING_CHILD_TIMEOUT_MS,
  resolveWardrobeUploadProcessingChildEntryUrl,
  resolveWardrobeUploadProcessingChildExecArgv,
  type WardrobeUploadProcessingChildMessage,
  type WardrobeUploadProcessingChildProcessLike,
  type WardrobeUploadProcessingEvent,
  type WardrobeUploadProcessingForkLike,
  type WardrobeUploadProcessingPayload,
  type WardrobeUploadProcessingResult,
} from "./wardrobeUploadProcessingCore.js";
import { incrementWardrobeUploadMetric } from "./wardrobeUploadProcessingMetrics.js";

type ProcessWardrobeUploadFilesInChildInput = {
  cleanupPaths?: string[];
  email: string;
  files: Array<{
    filePath: string;
    mimeType: string;
    originalName: string;
  }>;
  forkImpl?: WardrobeUploadProcessingForkLike;
  imageLlm: string;
  onEvent?: (event: WardrobeUploadProcessingEvent) => void;
  signal?: AbortSignal | null;
};

type ProcessWardrobeUploadUrlsInChildInput = {
  cleanupPaths?: string[];
  email: string;
  forkImpl?: WardrobeUploadProcessingForkLike;
  imageLlm: string;
  onEvent?: (event: WardrobeUploadProcessingEvent) => void;
  signal?: AbortSignal | null;
  urls: string[];
};

type RunnerOptions = {
  forkImpl: WardrobeUploadProcessingForkLike;
  onEvent?: (event: WardrobeUploadProcessingEvent) => void;
  payload: WardrobeUploadProcessingPayload;
  signal?: AbortSignal | null;
};

type RunnerState = {
  childExited: boolean;
  killing: boolean;
  settled: boolean;
};

async function cleanupPaths(paths: string[] = []) {
  await Promise.all(
    paths.map((targetPath) =>
      rm(targetPath, { recursive: true, force: true }).catch(() => {}),
    ),
  );
}

async function processWardrobeUploadFilesInChild({
  cleanupPaths: pathsToCleanup = [],
  email,
  files,
  forkImpl = nodeFork,
  imageLlm,
  onEvent,
  signal = null,
}: ProcessWardrobeUploadFilesInChildInput): Promise<
  WardrobeUploadProcessingResult[]
> {
  try {
    return await runWardrobeUploadProcessingChild({
      forkImpl,
      onEvent,
      payload: {
        email,
        imageLlm,
        items: files.map((file, inputIndex) => ({
          ...file,
          inputIndex,
          kind: "file",
        })),
      },
      signal,
    });
  } finally {
    await cleanupPaths(pathsToCleanup);
  }
}

async function processWardrobeUploadUrlsInChild({
  cleanupPaths: pathsToCleanup = [],
  email,
  forkImpl = nodeFork,
  imageLlm,
  onEvent,
  signal = null,
  urls,
}: ProcessWardrobeUploadUrlsInChildInput): Promise<
  WardrobeUploadProcessingResult[]
> {
  try {
    return await runWardrobeUploadProcessingChild({
      forkImpl,
      onEvent,
      payload: {
        email,
        imageLlm,
        items: urls.map((url, inputIndex) => ({
          inputIndex,
          kind: "url",
          url,
        })),
      },
      signal,
    });
  } finally {
    await cleanupPaths(pathsToCleanup);
  }
}

class WardrobeUploadProcessingChildRun {
  private child: WardrobeUploadProcessingChildProcessLike | null = null;
  private forceKillTimer: NodeJS.Timeout | null = null;
  private reject?: (error: Error) => void;
  private resolve?: (value: WardrobeUploadProcessingResult[]) => void;
  private state: RunnerState = {
    childExited: false,
    killing: false,
    settled: false,
  };
  private timeout: NodeJS.Timeout | null = null;

  constructor(private readonly options: RunnerOptions) {}

  run() {
    return new Promise<WardrobeUploadProcessingResult[]>((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
      this.start();
    });
  }

  private start() {
    if (this.options.signal?.aborted) {
      this.reject?.(new Error("wardrobe_upload_processing_aborted"));
      return;
    }

    const childEntryUrl = resolveWardrobeUploadProcessingChildEntryUrl();
    this.child = this.options.forkImpl(fileURLToPath(childEntryUrl), {
      stdio: ["ignore", "inherit", "inherit", "ipc"],
      execArgv: resolveWardrobeUploadProcessingChildExecArgv(childEntryUrl),
    });
    incrementWardrobeUploadMetric("uploadWorkerStartedCount");

    this.timeout = setTimeout(() => {
      incrementWardrobeUploadMetric("uploadWorkerTimeoutCount");
      this.rejectAfterKill(
        new Error("wardrobe_upload_processing_child_timeout"),
      );
    }, WARDROBE_UPLOAD_PROCESSING_CHILD_TIMEOUT_MS);
    this.timeout.unref?.();
    this.attachListeners();
    this.child.send(this.options.payload, this.onSendComplete);
  }

  private attachListeners() {
    this.child?.on("message", this.onMessage);
    this.child?.on("error", this.onError);
    this.child?.on("exit", this.onExit);
    this.options.signal?.addEventListener?.("abort", this.onAbort, {
      once: true,
    });
  }

  private cleanup({ keepExitForKill = false } = {}) {
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }
    if (this.forceKillTimer && !keepExitForKill) {
      clearTimeout(this.forceKillTimer);
      this.forceKillTimer = null;
    }
    this.options.signal?.removeEventListener?.("abort", this.onAbort);
    this.child?.removeListener("message", this.onMessage);
    this.child?.removeListener("error", this.onError);
    if (!keepExitForKill) {
      this.child?.removeListener("exit", this.onExit);
    }
  }

  private scheduleForceKill() {
    if (this.forceKillTimer) {
      return;
    }
    this.forceKillTimer = setTimeout(() => {
      if (!this.state.childExited) {
        incrementWardrobeUploadMetric("uploadWorkerKilledCount");
        this.child?.kill("SIGKILL");
      }
    }, WARDROBE_UPLOAD_PROCESSING_CHILD_KILL_GRACE_MS);
    this.forceKillTimer.unref?.();
  }

  private killChild() {
    this.state.killing = true;
    this.child?.kill("SIGTERM");
    this.scheduleForceKill();
  }

  private resolveOnce(value: WardrobeUploadProcessingResult[]) {
    if (this.state.settled) return;
    this.state.settled = true;
    this.cleanup();
    incrementWardrobeUploadMetric("uploadWorkerCompletedCount");
    this.resolve?.(value);
  }

  private rejectOnce(error: Error) {
    if (this.state.settled) return;
    this.state.settled = true;
    this.cleanup();
    this.reject?.(error);
  }

  private rejectAfterKill(error: Error) {
    if (this.state.settled) return;
    this.state.settled = true;
    this.killChild();
    this.cleanup({ keepExitForKill: true });
    this.reject?.(error);
  }

  private onAbort = () => {
    this.rejectAfterKill(new Error("wardrobe_upload_processing_aborted"));
  };

  private onMessage = (message: unknown) => {
    const childMessage = message as WardrobeUploadProcessingChildMessage;
    if (childMessage?.type === "event") {
      this.options.onEvent?.(childMessage);
      return;
    }

    if (childMessage?.type === "result" && childMessage.ok === true) {
      this.resolveResultMessage(childMessage.results);
      return;
    }

    if (childMessage?.type === "result" && childMessage.ok === false) {
      this.rejectOnce(getChildPayloadError(childMessage));
    }
  };

  private onError = (error: unknown) => {
    this.rejectOnce(error instanceof Error ? error : new Error(String(error)));
  };

  private onExit = (code: unknown, signalName: unknown) => {
    this.state.childExited = true;
    if (this.forceKillTimer) {
      clearTimeout(this.forceKillTimer);
      this.forceKillTimer = null;
    }
    if (this.state.killing) {
      this.child?.removeListener("exit", this.onExit);
      return;
    }
    if (!this.state.settled) {
      this.rejectOnce(
        new Error(
          `wardrobe_upload_processing_child_exit:${code ?? "null"}:${signalName ?? "null"}`,
        ),
      );
    }
  };

  private onSendComplete = (error: Error | null) => {
    if (error && !this.state.childExited) {
      this.rejectOnce(error);
    }
  };

  private resolveResultMessage(results: WardrobeUploadProcessingResult[]) {
    try {
      this.resolveOnce(validateResults(results));
    } catch (error) {
      this.rejectOnce(
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }
}

function runWardrobeUploadProcessingChild(options: RunnerOptions) {
  return new WardrobeUploadProcessingChildRun(options).run();
}

function validateResults(results: WardrobeUploadProcessingResult[]) {
  if (!Array.isArray(results)) {
    throw new Error("wardrobe_upload_processing_child_invalid_payload");
  }

  return results.map((result) => {
    if (!Number.isFinite(result?.inputIndex)) {
      throw new Error("wardrobe_upload_processing_child_invalid_payload");
    }

    return {
      analysis: result.analysis || null,
      cleanup: result.cleanup || null,
      inputIndex: Number(result.inputIndex),
      message: result.message ? String(result.message) : null,
      ok: Boolean(result.ok),
      source: result.source || null,
      stack: result.stack ? String(result.stack) : null,
    };
  });
}

function getChildPayloadError(
  message: Extract<WardrobeUploadProcessingChildMessage, { ok: false }>,
): Error {
  const error = new Error(
    String(message?.message || "wardrobe_upload_processing_child_failed"),
  );
  if (typeof message?.stack === "string" && message.stack.trim().length > 0) {
    error.stack = message.stack;
  }
  return error;
}

export {
  processWardrobeUploadFilesInChild,
  processWardrobeUploadUrlsInChild,
  runWardrobeUploadProcessingChild,
};
export type {
  ProcessWardrobeUploadFilesInChildInput,
  ProcessWardrobeUploadUrlsInChildInput,
};
