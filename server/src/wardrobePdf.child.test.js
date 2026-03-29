import test from "node:test";
import assert from "node:assert/strict";
import { createWardrobePdfChildRuntime } from "./wardrobePdf.child.js";

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

test("wardrobePdf child writes built PDF and exits 0 on success", async () => {
  const sendSpy = createSendSpy();
  const exits = [];
  const disconnects = [];
  const mkdirCalls = [];
  const writeCalls = [];
  const buildCalls = [];
  const pdfBuffer = Buffer.from("pdf");

  const runtime = createWardrobePdfChildRuntime({
    async mkdirImpl(dirPath, options) {
      mkdirCalls.push({ dirPath, options });
    },
    async writeFileImpl(filePath, buffer) {
      writeCalls.push({ filePath, buffer });
    },
    async buildWardrobePdfImpl(products, options) {
      buildCalls.push({ products, options });
      return pdfBuffer;
    },
    sendImpl: sendSpy.send,
    disconnectImpl() {
      disconnects.push(true);
    },
    exitImpl(code) {
      exits.push(code);
    }
  });

  await runtime.handleMessage({
    outputFilePath: "/tmp/capsule/out/wardrobe.pdf",
    products: [{ id: "p1" }],
    locale: "ru",
    totalStartedAt: 123
  });

  assert.deepEqual(mkdirCalls, [{
    dirPath: "/tmp/capsule/out",
    options: { recursive: true }
  }]);
  assert.deepEqual(buildCalls, [{
    products: [{ id: "p1" }],
    options: { locale: "ru", totalStartedAt: 123 }
  }]);
  assert.deepEqual(writeCalls, [{
    filePath: "/tmp/capsule/out/wardrobe.pdf",
    buffer: pdfBuffer
  }]);
  assert.deepEqual(sendSpy.calls, [{
    ok: true,
    outputFilePath: "/tmp/capsule/out/wardrobe.pdf"
  }]);
  assert.deepEqual(disconnects, [true]);
  assert.deepEqual(exits, [0]);
});

test("wardrobePdf child defaults locale and totalStartedAt for invalid input", async () => {
  const buildCalls = [];

  const runtime = createWardrobePdfChildRuntime({
    async mkdirImpl() {},
    async writeFileImpl() {},
    async buildWardrobePdfImpl(products, options) {
      buildCalls.push({ products, options });
      return Buffer.from("pdf");
    },
    sendImpl(_message, callback) {
      callback?.();
    },
    exitImpl() {}
  });

  await runtime.handleMessage({
    outputFilePath: "/tmp/capsule/defaults.pdf",
    products: "bad-products",
    locale: "",
    totalStartedAt: "bad-start"
  });

  assert.deepEqual(buildCalls, [{
    products: [],
    options: { locale: "en", totalStartedAt: null }
  }]);
});

test("wardrobePdf child sends error payload when outputFilePath is missing", async () => {
  const sendSpy = createSendSpy();
  const exits = [];

  const runtime = createWardrobePdfChildRuntime({
    sendImpl: sendSpy.send,
    disconnectImpl() {},
    exitImpl(code) {
      exits.push(code);
    }
  });

  await runtime.handleMessage({});

  assert.equal(sendSpy.calls.length, 1);
  assert.equal(sendSpy.calls[0].ok, false);
  assert.equal(sendSpy.calls[0].message, "wardrobe_pdf_child_output_path_missing");
  assert.match(sendSpy.calls[0].stack, /wardrobe_pdf_child_output_path_missing/);
  assert.deepEqual(exits, [1]);
});

test("wardrobePdf child sends build errors and exits 1", async () => {
  const sendSpy = createSendSpy();
  const exits = [];
  const error = new Error("pdf_build_failed");

  const runtime = createWardrobePdfChildRuntime({
    async mkdirImpl() {},
    async buildWardrobePdfImpl() {
      throw error;
    },
    sendImpl: sendSpy.send,
    disconnectImpl() {},
    exitImpl(code) {
      exits.push(code);
    }
  });

  await runtime.handleMessage({ outputFilePath: "/tmp/capsule/out.pdf" });

  assert.equal(sendSpy.calls.length, 1);
  assert.equal(sendSpy.calls[0].ok, false);
  assert.equal(sendSpy.calls[0].message, "pdf_build_failed");
  assert.match(sendSpy.calls[0].stack, /pdf_build_failed/);
  assert.deepEqual(exits, [1]);
});

test("wardrobePdf child ignores duplicate messages", async () => {
  const sendSpy = createSendSpy();
  const buildCalls = [];

  const runtime = createWardrobePdfChildRuntime({
    async mkdirImpl() {},
    async writeFileImpl() {},
    async buildWardrobePdfImpl(products) {
      buildCalls.push(products);
      return Buffer.from("pdf");
    },
    sendImpl: sendSpy.send,
    disconnectImpl() {},
    exitImpl() {}
  });

  await runtime.handleMessage({ outputFilePath: "/tmp/capsule/one.pdf", products: [{ id: 1 }] });
  await runtime.handleMessage({ outputFilePath: "/tmp/capsule/two.pdf", products: [{ id: 2 }] });

  assert.deepEqual(buildCalls, [[{ id: 1 }]]);
  assert.deepEqual(sendSpy.calls, [{ ok: true, outputFilePath: "/tmp/capsule/one.pdf" }]);
});

test("wardrobePdf child exits even when process.send is unavailable", async () => {
  const exits = [];

  const runtime = createWardrobePdfChildRuntime({
    async mkdirImpl() {},
    async writeFileImpl() {},
    async buildWardrobePdfImpl() {
      return Buffer.from("pdf");
    },
    sendImpl: undefined,
    exitImpl(code) {
      exits.push(code);
    }
  });

  await runtime.handleMessage({ outputFilePath: "/tmp/capsule/no-ipc.pdf" });

  assert.deepEqual(exits, [0]);
});
