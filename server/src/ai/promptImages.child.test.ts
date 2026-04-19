import test from "node:test";
import assert from "node:assert/strict";
import { createPromptImagesChildRuntime } from "./promptImages.child.js";

function createSendSpy() {
  const calls = [];
  return {
    calls,
    send(message, callback) {
      calls.push(message);
      callback?.();
    }
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
    }
  });

  await runtime.handleMessage({ normalizedItems: [{ id: "look-1" }] });

  assert.deepEqual(buildCalls, [{
    normalizedItems: [{ id: "look-1" }],
    saveDebugArtifacts: false
  }]);
  assert.deepEqual(serializeCalls, [{ stitchedRows: [{ id: "row-1" }] }]);
  assert.deepEqual(sendSpy.calls, [{
    ok: true,
    groups: [{ id: "row-1" }],
    totals: 1
  }]);
  assert.deepEqual(disconnects, [true]);
  assert.deepEqual(exits, [0]);
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
    exitImpl() {}
  });

  await runtime.handleMessage({ normalizedItems: "bad-shape" });

  assert.deepEqual(buildCalls, [{
    normalizedItems: [],
    saveDebugArtifacts: false
  }]);
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
    }
  });

  await runtime.handleMessage({ normalizedItems: [] });

  assert.equal(sendSpy.calls.length, 1);
  assert.equal(sendSpy.calls[0].ok, false);
  assert.equal(sendSpy.calls[0].message, "prompt_images_failed");
  assert.match(sendSpy.calls[0].stack, /prompt_images_failed/);
  assert.deepEqual(exits, [1]);
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
    exitImpl() {}
  });

  await runtime.handleMessage({ normalizedItems: [{ id: 1 }] });
  await runtime.handleMessage({ normalizedItems: [{ id: 2 }] });

  assert.equal(buildCalls.length, 1);
  assert.deepEqual(buildCalls[0], {
    normalizedItems: [{ id: 1 }],
    saveDebugArtifacts: false
  });
  assert.deepEqual(sendSpy.calls, [{ ok: true, result: 1 }]);
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
    }
  });

  await runtime.handleMessage({ normalizedItems: [] });

  assert.deepEqual(exits, [0]);
});
