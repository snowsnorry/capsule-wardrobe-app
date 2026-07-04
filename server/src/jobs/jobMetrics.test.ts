import { expect, test } from "vitest";
import { addJobMetricCount, createEmptyJobMetrics } from "./jobMetrics.js";

test("job metrics ignores unsupported statuses", () => {
  const metrics = createEmptyJobMetrics();

  addJobMetricCount({
    count: 3,
    kind: "capsuleReportGenerate",
    metrics,
    status: "queued",
  });
  addJobMetricCount({
    count: 2,
    kind: "capsuleReportGenerate",
    metrics,
    status: "unknown" as never,
  });

  expect(metrics).toEqual({
    total: 3,
    byStatus: { queued: 3, running: 0, completed: 0, failed: 0 },
    byKind: {
      capsuleReportGenerate: {
        queued: 3,
        running: 0,
        completed: 0,
        failed: 0,
      },
    },
    stuck: { total: 0, queued: 0, running: 0 },
  });
});
