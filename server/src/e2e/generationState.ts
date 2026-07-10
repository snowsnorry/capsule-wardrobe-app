import {
  cloneEffectiveCapsuleSnapshot,
  deepClone,
  E2eCapsuleMemory,
  normalizeCapsuleId,
} from "./capsuleState.js";
import { buildE2eCapsule, buildE2eRegeneratedWardrobe } from "./fixtures.js";
import {
  buildCapsuleSnapshotWithRegeneration,
  normalizeCapsuleSnapshot,
  type CapsuleSnapshot,
} from "../capsuleStoreModel.js";
import type {
  StoredWardrobePayloadLike,
  WardrobeJobState,
} from "../ai/types.js";

type E2eGenerationMode = "immediate" | "pending";

type E2eGenerationFailureState = {
  domain: string | null;
  action: string | null;
  configured: boolean;
  consumed: boolean;
  retryReadyOnce: boolean;
  lastFailedJobId: string | null;
};

type E2ePendingWardrobeJob = WardrobeJobState & {
  capsuleId: string;
  email: string;
  failedSnapshot: CapsuleSnapshot;
  readySnapshot: CapsuleSnapshot;
};

function generationKey(email: unknown, capsuleId: unknown): string {
  return `${String(email || "")
    .trim()
    .toLowerCase()}::${normalizeCapsuleId(capsuleId)}`;
}

function buildReadyWardrobeSnapshot(
  capsuleMemory: E2eCapsuleMemory,
  capsuleId: unknown,
): CapsuleSnapshot | null {
  const effectiveSnapshot = cloneEffectiveCapsuleSnapshot(
    capsuleMemory.get(capsuleId),
  );
  const baseSnapshot =
    effectiveSnapshot || normalizeCapsuleSnapshot(buildE2eCapsule().draft);
  if (!baseSnapshot) return null;

  return normalizeCapsuleSnapshot({
    filters: baseSnapshot.filters,
    data: {
      wardrobe: buildE2eRegeneratedWardrobe(),
      rejectedUrls: [],
      regeneration: null,
    },
  });
}

function buildPendingWardrobeSnapshot(
  capsuleMemory: E2eCapsuleMemory,
  capsuleId: unknown,
  requestId: string,
  startedAt: string,
): CapsuleSnapshot | null {
  return buildCapsuleSnapshotWithRegeneration(
    cloneEffectiveCapsuleSnapshot(capsuleMemory.get(capsuleId)),
    {
      status: "pending",
      kind: "full",
      startedAt,
      requestId,
    },
  );
}

function cloneWardrobeJob(job: E2ePendingWardrobeJob): WardrobeJobState {
  const {
    capsuleId: _capsuleId,
    email: _email,
    failedSnapshot: _failedSnapshot,
    readySnapshot: _snapshot,
    ...rest
  } = job;
  return deepClone(rest);
}

export class E2eGenerationMemory {
  private counter = 0;
  private jobs = new Map<string, E2ePendingWardrobeJob>();
  private subscribers = new Map<string, Set<unknown>>();
  private failure: E2eGenerationFailureState = {
    domain: null,
    action: null,
    configured: false,
    consumed: false,
    retryReadyOnce: false,
    lastFailedJobId: null,
  };

  mode: E2eGenerationMode = "immediate";

  reset(): void {
    this.mode = "immediate";
    this.counter = 0;
    this.jobs.clear();
    this.resetFailureState();
    this.closeSubscribers();
  }

  setMode(mode: unknown): E2eGenerationMode | null {
    if (mode !== "immediate" && mode !== "pending") return null;
    this.mode = mode;
    return this.mode;
  }

  setFailureMode(mode: unknown): E2eGenerationMode | "fail-once" | null {
    if (mode === "fail-once") {
      this.failOnce();
      this.mode = "immediate";
      return "fail-once";
    }
    return this.setMode(mode);
  }

  failOnce(
    options: { domain?: unknown; action?: unknown } = {},
  ): E2eGenerationFailureState {
    this.failure = {
      domain: String(options.domain || "generation"),
      action: String(options.action || "regenerate-all"),
      configured: true,
      consumed: false,
      retryReadyOnce: false,
      lastFailedJobId: null,
    };
    return this.cloneFailureState();
  }

  consumeFailureOnce(): E2eGenerationFailureState | null {
    if (!this.failure.configured || this.failure.consumed) return null;

    this.counter += 1;
    this.failure = {
      domain: this.failure.domain,
      action: this.failure.action,
      configured: false,
      consumed: true,
      retryReadyOnce: true,
      lastFailedJobId: `e2e-full-generation-failed-${this.counter}`,
    };
    return this.cloneFailureState();
  }

  consumeRetryReadyOnce(): boolean {
    if (!this.failure.retryReadyOnce) return false;
    this.failure = {
      ...this.failure,
      retryReadyOnce: false,
    };
    return true;
  }

  cloneFailureState(): E2eGenerationFailureState {
    return deepClone(this.failure);
  }

  getJob(email: unknown, capsuleId: unknown): WardrobeJobState | null {
    const job = this.jobs.get(generationKey(email, capsuleId));
    return job ? cloneWardrobeJob(job) : null;
  }

  createPendingWardrobeJob({
    capsuleMemory,
    capsuleId,
    email,
  }: {
    capsuleMemory: E2eCapsuleMemory;
    capsuleId: unknown;
    email: unknown;
  }): E2ePendingWardrobeJob | null {
    const normalizedCapsuleId = normalizeCapsuleId(capsuleId);
    const key = generationKey(email, normalizedCapsuleId);
    const existing = this.jobs.get(key);
    if (existing?.status === "pending") return deepClone(existing);

    this.counter += 1;
    const capsuleRequestId = `e2e-full-generation-${this.counter}`;
    const startedAt = this.counter;
    const pendingSnapshot = buildPendingWardrobeSnapshot(
      capsuleMemory,
      normalizedCapsuleId,
      capsuleRequestId,
      new Date(startedAt * 1000).toISOString(),
    );
    const readySnapshot = buildReadyWardrobeSnapshot(
      capsuleMemory,
      normalizedCapsuleId,
    );
    const failedSnapshot = buildCapsuleSnapshotWithRegeneration(
      cloneEffectiveCapsuleSnapshot(capsuleMemory.get(normalizedCapsuleId)),
      null,
    );
    if (!pendingSnapshot || !readySnapshot || !failedSnapshot) return null;

    const updatedCapsule = capsuleMemory.update(
      normalizedCapsuleId,
      pendingSnapshot,
    );
    if (!updatedCapsule) return null;

    const job: E2ePendingWardrobeJob = {
      capsuleRequestId,
      status: "pending",
      startedAt,
      updatedAt: startedAt,
      promise: null,
      phase: "capsule",
      result: null,
      email: String(email || "")
        .trim()
        .toLowerCase(),
      capsuleId: normalizedCapsuleId,
      failedSnapshot,
      readySnapshot,
    };
    this.jobs.set(key, job);
    return deepClone(job);
  }

  releaseWardrobeJob({
    capsuleMemory,
    capsuleId,
    email,
  }: {
    capsuleMemory: E2eCapsuleMemory;
    capsuleId?: unknown;
    email?: unknown;
  }): E2ePendingWardrobeJob | null {
    const job = this.findPendingJob(email, capsuleId);
    if (!job) return null;

    const updatedCapsule = capsuleMemory.update(
      job.capsuleId,
      job.readySnapshot,
    );
    if (!updatedCapsule) return null;

    job.status = "completed";
    job.phase = "completed";
    job.updatedAt = this.counter + 1;
    job.result = deepClone(
      job.readySnapshot.data.wardrobe,
    ) as StoredWardrobePayloadLike;
    this.jobs.set(generationKey(job.email, job.capsuleId), job);
    return deepClone(job);
  }

  failWardrobeJob({
    capsuleMemory,
    capsuleId,
    email,
  }: {
    capsuleMemory: E2eCapsuleMemory;
    capsuleId?: unknown;
    email?: unknown;
  }): E2ePendingWardrobeJob | null {
    const job = this.findPendingJob(email, capsuleId);
    if (!job) return null;

    const updatedCapsule = capsuleMemory.update(
      job.capsuleId,
      job.failedSnapshot,
    );
    if (!updatedCapsule) return null;

    job.status = "failed";
    job.phase = "failed";
    job.updatedAt = this.counter + 1;
    job.error = new Error("e2e_forced_failure");
    this.jobs.set(generationKey(job.email, job.capsuleId), job);
    return deepClone(job);
  }

  subscribe({
    email,
    capsuleId,
    res,
    snapshot,
  }: {
    email: unknown;
    capsuleId: unknown;
    res: unknown;
    snapshot: unknown;
  }): void {
    this.writeSnapshot(res, snapshot);
    const key = generationKey(email, capsuleId);
    const job = this.jobs.get(key);
    if (job?.status !== "pending") {
      this.endResponse(res);
      return;
    }

    if (!this.subscribers.has(key)) this.subscribers.set(key, new Set());
    this.subscribers.get(key)?.add(res);
    this.registerCloseHandler(key, res);
  }

  publish(
    email: unknown,
    capsuleId: unknown,
    snapshot: unknown,
    options: { close?: boolean } = {},
  ): boolean {
    const key = generationKey(email, capsuleId);
    const subscribers = this.subscribers.get(key);
    if (!subscribers?.size) return false;

    for (const res of subscribers) {
      this.writeSnapshot(res, snapshot);
      if (options.close) this.endResponse(res);
    }
    if (options.close) this.subscribers.delete(key);
    return true;
  }

  private findPendingJob(
    email?: unknown,
    capsuleId?: unknown,
  ): E2ePendingWardrobeJob | null {
    const normalizedCapsuleId = capsuleId ? normalizeCapsuleId(capsuleId) : "";
    const normalizedEmail = String(email || "")
      .trim()
      .toLowerCase();

    for (const job of this.jobs.values()) {
      if (job.status !== "pending") continue;
      if (normalizedCapsuleId && job.capsuleId !== normalizedCapsuleId)
        continue;
      if (normalizedEmail && job.email !== normalizedEmail) continue;
      return job;
    }
    return null;
  }

  private closeSubscribers(): void {
    for (const subscribers of this.subscribers.values()) {
      for (const res of subscribers) {
        this.endResponse(res);
      }
    }
    this.subscribers.clear();
  }

  private resetFailureState(): void {
    this.failure = {
      domain: null,
      action: null,
      configured: false,
      consumed: false,
      retryReadyOnce: false,
      lastFailedJobId: null,
    };
  }

  private registerCloseHandler(key: string, res: unknown): void {
    const response = res as {
      on?: (event: string, listener: () => void) => void;
    };
    response.on?.("close", () => {
      const subscribers = this.subscribers.get(key);
      subscribers?.delete(res);
      if (subscribers?.size === 0) this.subscribers.delete(key);
    });
  }

  private writeSnapshot(res: unknown, snapshot: unknown): void {
    const response = res as {
      write?: (chunk: string) => void;
    };
    response.write?.(`event: snapshot\ndata: ${JSON.stringify(snapshot)}\n\n`);
  }

  private endResponse(res: unknown): void {
    const response = res as {
      end?: () => void;
      writableEnded?: boolean;
    };
    if (!response.writableEnded) response.end?.();
  }
}
