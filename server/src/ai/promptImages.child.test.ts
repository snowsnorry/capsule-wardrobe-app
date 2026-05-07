import { test, expect } from "vitest";
import { createPromptImagesChildRuntime } from "./promptImages.child.ts";

function createSendSpy() {
  const calls = [];
  return {
    calls,
    send(message, callback) {
      calls.push(message);
      callback?.();
    },
  };
}

test("promptImages child sends serialized payload and exits 0 on success", async () => {
  const sendSpy = createSendSpy();
  const exits = [];
  const disconnects = [];
  const buildCalls = [];
  const serializeCalls = [];

  const runtime = createPromptImagesChildRuntime({
    async buildPromptDebugImagesImpl(input) {
      buildCalls.push(input);
      return { stitchedRows: [{ id: "row-1" }] };
    },
    serializePromptDebugImagesForIpcImpl(result) {
      serializeCalls.push(result);
      return { groups: [{ id: "row-1" }], totals: 1 };
    },
    sendImpl: sendSpy.send,
    disconnectImpl() {
      disconnects.push(true);
    },
    exitImpl(code) {
      exits.push(code);
    },
  });

  await runtime.handleMessage({ normalizedItems: [{ id: "look-1" }] });

  expect(buildCalls).toEqual([
    {
      normalizedItems: [{ id: "look-1" }],
      saveDebugArtifacts: false,
    },
  ]);
  expect(serializeCalls).toEqual([{ stitchedRows: [{ id: "row-1" }] }]);
  expect(sendSpy.calls).toEqual([
    {
      ok: true,
      groups: [{ id: "row-1" }],
      totals: 1,
    },
  ]);
  expect(disconnects).toEqual([true]);
  expect(exits).toEqual([0]);
});

test("promptImages child falls back to empty normalizedItems array", async () => {
  const buildCalls = [];

  const runtime = createPromptImagesChildRuntime({
    async buildPromptDebugImagesImpl(input) {
      buildCalls.push(input);
      return {};
    },
    serializePromptDebugImagesForIpcImpl() {
      return {};
    },
    sendImpl(_message, callback) {
      callback?.();
    },
    exitImpl() {},
  });

  await runtime.handleMessage({ normalizedItems: "bad-shape" });

  expect(buildCalls).toEqual([
    {
      normalizedItems: [],
      saveDebugArtifacts: false,
    },
  ]);
});

test("promptImages child sends error payload and exits 1 on failure", async () => {
  const sendSpy = createSendSpy();
  const exits = [];
  const error = new Error("prompt_images_failed");

  const runtime = createPromptImagesChildRuntime({
    async buildPromptDebugImagesImpl() {
      throw error;
    },
    sendImpl: sendSpy.send,
    disconnectImpl() {},
    exitImpl(code) {
      exits.push(code);
    },
  });

  await runtime.handleMessage({ normalizedItems: [] });

  expect(sendSpy.calls.length).toBe(1);
  expect(sendSpy.calls[0].ok).toBe(false);
  expect(sendSpy.calls[0].message).toBe("prompt_images_failed");
  expect(sendSpy.calls[0].stack).toMatch(/prompt_images_failed/);
  expect(exits).toEqual([1]);
});

test("promptImages child ignores duplicate messages", async () => {
  const sendSpy = createSendSpy();
  const buildCalls = [];

  const runtime = createPromptImagesChildRuntime({
    async buildPromptDebugImagesImpl(input) {
      buildCalls.push(input);
      return { result: buildCalls.length };
    },
    serializePromptDebugImagesForIpcImpl(result) {
      return result;
    },
    sendImpl: sendSpy.send,
    disconnectImpl() {},
    exitImpl() {},
  });

  await runtime.handleMessage({ normalizedItems: [{ id: 1 }] });
  await runtime.handleMessage({ normalizedItems: [{ id: 2 }] });

  expect(buildCalls.length).toBe(1);
  expect(buildCalls[0]).toEqual({
    normalizedItems: [{ id: 1 }],
    saveDebugArtifacts: false,
  });
  expect(sendSpy.calls).toEqual([{ ok: true, result: 1 }]);
});

test("promptImages child exits even when process.send is unavailable", async () => {
  const exits = [];

  const runtime = createPromptImagesChildRuntime({
    async buildPromptDebugImagesImpl() {
      return {};
    },
    serializePromptDebugImagesForIpcImpl() {
      return {};
    },
    sendImpl: undefined,
    exitImpl(code) {
      exits.push(code);
    },
  });

  await runtime.handleMessage({ normalizedItems: [] });

  expect(exits).toEqual([0]);
});
