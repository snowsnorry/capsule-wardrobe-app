import { act, renderHook } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

const api = vi.hoisted(() => ({
  addJobSnapshotListener: vi.fn(),
  fetchCapsule: vi.fn(),
}));
const actions = vi.hoisted(() => ({
  refreshActiveOutfit: vi.fn(),
  refreshCapsuleList: vi.fn(),
}));

vi.mock("../api/jobs", () => ({
  addJobSnapshotListener: api.addJobSnapshotListener,
}));
vi.mock("../api/capsules", () => ({ fetchCapsule: api.fetchCapsule }));
vi.mock("./capsuleListActions", () => ({
  refreshCapsuleList: actions.refreshCapsuleList,
}));
vi.mock("./outfitActionHelpers", () => ({
  refreshActiveOutfit: actions.refreshActiveOutfit,
}));

import { useJobEntityReconciliation } from "./useJobEntityReconciliation";
import type { JobSnapshot } from "../api/jobs";

function createJob(overrides: Partial<JobSnapshot> = {}): JobSnapshot {
  return {
    id: "job-1",
    kind: "capsuleGenerate",
    status: "completed",
    phase: "completed",
    progress: { current: 1, total: 1, label: null },
    entity: { type: "capsule", id: "capsule-1" },
    result: null,
    error: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:01:00.000Z",
    startedAt: null,
    completedAt: "2026-01-01T00:01:00.000Z",
    failedAt: null,
    ...overrides,
  } as JobSnapshot;
}

beforeEach(() => {
  api.addJobSnapshotListener.mockReset();
  api.fetchCapsule.mockReset();
  actions.refreshActiveOutfit.mockReset();
  actions.refreshActiveOutfit.mockResolvedValue(undefined);
  actions.refreshCapsuleList.mockReset();
  actions.refreshCapsuleList.mockResolvedValue(undefined);
});

test("reconciles capsule extras and terminal snapshots once", async () => {
  let listener: (job: JobSnapshot) => void = () => undefined;
  api.addJobSnapshotListener.mockImplementation((next) => {
    listener = next;
    return () => undefined;
  });
  api.fetchCapsule.mockResolvedValue({ snapshot: { status: "pending" } });
  const appState = {
    activeCapsuleIdRef: { current: "capsule-1" },
    setStatus: vi.fn(),
  };
  const operations = {
    applyCapsuleState: vi.fn(),
    applyWardrobeSnapshot: vi.fn(async () => undefined),
    getAppActionContext: vi.fn(() => ({})),
  };

  renderHook(() =>
    useJobEntityReconciliation({
      appState: appState as never,
      operations: operations as never,
      resolveErrorMessage: vi.fn(() => "error"),
      userEmail: "person@example.com",
    }),
  );

  const extras = createJob({
    status: "running",
    phase: "extras",
    completedAt: null,
  });
  await act(async () => {
    listener(extras);
    listener(extras);
    await Promise.resolve();
  });
  expect(api.fetchCapsule).toHaveBeenCalledTimes(1);
  expect(operations.applyWardrobeSnapshot).toHaveBeenCalledWith(
    { status: "pending" },
    "capsule-1",
    { refreshReadyCapsule: false },
  );
});

test("surfaces job failures and refreshes capsule and outfit entities", async () => {
  let listener: (job: JobSnapshot) => void = () => undefined;
  api.addJobSnapshotListener.mockImplementation((next) => {
    listener = next;
    return () => undefined;
  });
  api.fetchCapsule.mockResolvedValue({
    capsule: { id: "capsule-1", status: "ready" },
    snapshot: { status: "ready" },
  });
  const setStatus = vi.fn();
  const appState = {
    activeCapsuleIdRef: { current: "capsule-1" },
    setStatus,
  };
  const operations = {
    applyCapsuleState: vi.fn(),
    applyWardrobeSnapshot: vi.fn(async () => undefined),
    getAppActionContext: vi.fn(() => ({ context: true })),
  };
  const resolveErrorMessage = vi.fn(() => "visible error");

  renderHook(() =>
    useJobEntityReconciliation({
      appState: appState as never,
      operations: operations as never,
      resolveErrorMessage,
      userEmail: "person@example.com",
    }),
  );

  await act(async () => {
    listener(
      createJob({
        status: "failed",
        phase: "failed",
        error: { code: "model_not_allowed", message: null },
        completedAt: null,
        failedAt: "2026-01-01T00:01:00.000Z",
      }),
    );
    listener(
      createJob({
        id: "job-2",
        kind: "outfitReportGenerate",
        entity: { type: "outfit", id: "outfit-1" },
      }),
    );
    await Promise.resolve();
  });

  expect(operations.applyWardrobeSnapshot).toHaveBeenCalledWith(
    { status: "failed" },
    "capsule-1",
    { refreshReadyCapsule: false },
  );
  expect(operations.applyCapsuleState).toHaveBeenCalledWith(
    expect.objectContaining({ status: "ready" }),
  );
  expect(actions.refreshCapsuleList).toHaveBeenCalled();
  expect(actions.refreshActiveOutfit).toHaveBeenCalledWith(
    { context: true },
    "outfit-1",
    { onlyIfActive: true },
  );
  const updater = setStatus.mock.calls[0][0];
  expect(updater({ error: "" })).toEqual({ error: "visible error" });
});

test("retries terminal capsule reconciliation after a transient GET failure", async () => {
  vi.useFakeTimers();
  let listener: (job: JobSnapshot) => void = () => undefined;
  api.addJobSnapshotListener.mockImplementation((next) => {
    listener = next;
    return () => undefined;
  });
  api.fetchCapsule
    .mockRejectedValueOnce(new Error("network"))
    .mockResolvedValueOnce({
      capsule: { id: "capsule-1" },
      snapshot: { status: "ready" },
    });
  const appState = {
    activeCapsuleIdRef: { current: "capsule-1" },
    setStatus: vi.fn(),
  };
  const operations = {
    applyCapsuleState: vi.fn(),
    applyWardrobeSnapshot: vi.fn(async () => undefined),
    getAppActionContext: vi.fn(() => ({})),
  };
  renderHook(() =>
    useJobEntityReconciliation({
      appState: appState as never,
      operations: operations as never,
      resolveErrorMessage: vi.fn(() => "error"),
      userEmail: "person@example.com",
    }),
  );

  act(() => listener(createJob()));
  await act(async () => {
    await vi.advanceTimersByTimeAsync(250);
  });

  expect(api.fetchCapsule).toHaveBeenCalledTimes(2);
  expect(operations.applyWardrobeSnapshot).toHaveBeenCalledWith(
    { status: "ready" },
    "capsule-1",
    { refreshReadyCapsule: false },
  );
  vi.useRealTimers();
});
