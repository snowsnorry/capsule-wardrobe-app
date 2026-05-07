import { test, expect } from "vitest";
import { createWardrobePdfChildRuntime } from "./wardrobePdf.child.ts";

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

  expect(mkdirCalls).toEqual([{
    dirPath: "/tmp/capsule/out",
    options: { recursive: true }
  }]);
  expect(buildCalls).toEqual([{
    products: [{ id: "p1" }],
    options: { locale: "ru", totalStartedAt: 123 }
  }]);
  expect(writeCalls).toEqual([{
    filePath: "/tmp/capsule/out/wardrobe.pdf",
    buffer: pdfBuffer
  }]);
  expect(sendSpy.calls).toEqual([{
    ok: true,
    outputFilePath: "/tmp/capsule/out/wardrobe.pdf"
  }]);
  expect(disconnects).toEqual([true]);
  expect(exits).toEqual([0]);
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

  expect(buildCalls).toEqual([{
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

  expect(sendSpy.calls.length).toBe(1);
  expect(sendSpy.calls[0].ok).toBe(false);
  expect(sendSpy.calls[0].message).toBe("wardrobe_pdf_child_output_path_missing");
  expect(sendSpy.calls[0].stack).toMatch(/wardrobe_pdf_child_output_path_missing/);
  expect(exits).toEqual([1]);
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

  expect(sendSpy.calls.length).toBe(1);
  expect(sendSpy.calls[0].ok).toBe(false);
  expect(sendSpy.calls[0].message).toBe("pdf_build_failed");
  expect(sendSpy.calls[0].stack).toMatch(/pdf_build_failed/);
  expect(exits).toEqual([1]);
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

  expect(buildCalls).toEqual([[{ id: 1 }]]);
  expect(sendSpy.calls).toEqual([{ ok: true, outputFilePath: "/tmp/capsule/one.pdf" }]);
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

  expect(exits).toEqual([0]);
});
