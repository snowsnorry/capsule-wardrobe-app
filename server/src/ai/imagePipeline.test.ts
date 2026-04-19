import test from "node:test";
import assert from "node:assert/strict";
import { runWithImageWorkSlot } from "./imagePipeline.js";

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
