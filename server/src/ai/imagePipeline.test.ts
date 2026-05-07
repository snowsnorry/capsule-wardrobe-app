import test from "node:test";
import assert from "node:assert/strict";
import {
  getProcessMemoryUsage,
  runWithImageWorkSlot,
  sumCategoryBytes,
  sumImageAssetBytesById
} from "./imagePipeline.js";

test("runWithImageWorkSlot serializes image-heavy work by default", async () => {
  let active = 0;
  let maxActive = 0;

  await Promise.all([
    runWithImageWorkSlot("job-1", async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 20));
      active -= 1;
    }),
    runWithImageWorkSlot("job-2", async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 20));
      active -= 1;
    })
  ]);

  assert.equal(maxActive, 1);
});

test("runWithImageWorkSlot releases slots after failures and byte helpers sum buffers", async () => {
  await assert.rejects(
    runWithImageWorkSlot("failing-job", async () => {
      throw new Error("failed");
    }),
    /failed/
  );

  const result = await runWithImageWorkSlot("next-job", () => "ok");
  assert.equal(result, "ok");
  assert.equal(sumCategoryBytes([{ buffer: Buffer.alloc(2) }, { buffer: null }, {}]), 2);
  assert.equal(sumImageAssetBytesById({
    a: { buffer: Buffer.alloc(3) },
    b: { buffer: null },
    c: {}
  }), 3);

  const memory = getProcessMemoryUsage();
  assert.equal(typeof memory.rssBytes, "number");
  assert.equal(typeof memory.heapUsedBytes, "number");
});
