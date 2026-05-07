import { test, expect } from "vitest";
import {
  getProcessMemoryUsage,
  runWithImageWorkSlot,
  sumCategoryBytes,
  sumImageAssetBytesById,
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
    }),
  ]);

  expect(maxActive).toBe(1);
});

test("runWithImageWorkSlot releases slots after failures and byte helpers sum buffers", async () => {
  await expect(
    runWithImageWorkSlot("failing-job", async () => {
      throw new Error("failed");
    }),
  ).rejects.toThrow(/failed/);

  const result = await runWithImageWorkSlot("next-job", () => "ok");
  expect(result).toBe("ok");
  expect(
    sumCategoryBytes([{ buffer: Buffer.alloc(2) }, { buffer: null }, {}]),
  ).toBe(2);
  expect(
    sumImageAssetBytesById({
      a: { buffer: Buffer.alloc(3) },
      b: { buffer: null },
      c: {},
    }),
  ).toBe(3);

  const memory = getProcessMemoryUsage();
  expect(typeof memory.rssBytes).toBe("number");
  expect(typeof memory.heapUsedBytes).toBe("number");
});
