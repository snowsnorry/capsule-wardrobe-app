import { Buffer } from "node:buffer";
import { expect, test } from "./test";
import type { Page } from "@playwright/test";

type JobResponse = {
  job?: {
    id?: string;
    status?: string;
  };
};

const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMB/atcw3kAAAAASUVORK5CYII=",
  "base64",
);

async function setManualJobs(page: Page, kinds: string[]) {
  const response = await page
    .context()
    .request.post("/__e2e/jobs/manual-mode", {
      data: { kinds },
    });
  await expect(response).toBeOK();
}

async function releaseJob(page: Page, jobId: string) {
  const response = await page
    .context()
    .request.post(`/__e2e/jobs/${encodeURIComponent(jobId)}/release`);
  await expect(response).toBeOK();
}

async function failJob(page: Page, jobId: string) {
  const response = await page
    .context()
    .request.post(`/__e2e/jobs/${encodeURIComponent(jobId)}/fail`, {
      data: { errorCode: "e2e_forced_failure" },
    });
  await expect(response).toBeOK();
}

async function seedSidebarLists(page: Page) {
  const response = await page
    .context()
    .request.post("/__e2e/seed/sidebar-lists", {
      data: { capsules: 12, outfits: 12 },
    });
  await expect(response).toBeOK();
}

async function openCapsule(page: Page) {
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto("/capsule/capsule-e2e");
  await expect(
    page.getByRole("button", { name: "Regenerate all" }),
  ).toBeVisible();
}

async function generateCapsuleReport(page: Page) {
  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().endsWith("/capsules/capsule-e2e/report") &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Analyze" }).click();
  const response = await responsePromise;
  expect(response.ok()).toBe(true);
  return (await response.json()) as JobResponse;
}

async function uploadOnePersonalItemWithManualJob(page: Page) {
  await page.goto("/personal-items");
  await expect(
    page.getByRole("button", { name: "Upload item photo" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Upload item photo" }).click();
  const dialog = page.getByRole("dialog", {
    name: "Upload personal item photos",
  });
  await expect(dialog).toBeVisible();
  await page.locator('input[type="file"]').setInputFiles({
    name: "manual-failure.png",
    mimeType: "image/png",
    buffer: TINY_PNG,
  });
  const responsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().includes("/wardrobe/items/upload"),
  );
  await dialog.getByRole("button", { name: "Upload" }).click();
  const response = await responsePromise;
  expect(response.status()).toBe(202);
  return (await response.json()) as JobResponse;
}

test("capsule report generate regenerate delete and linked item highlight work through the UI", async ({
  page,
  resetAndLogin,
}) => {
  await resetAndLogin("with-profile");
  await openCapsule(page);

  const generated = await generateCapsuleReport(page);
  expect(generated.job?.status).toBe("completed");

  const report = page.getByTestId("capsule-report");
  await expect(report).toBeVisible();
  await expect(
    page.getByRole("progressbar", { name: "Generating capsule report" }),
  ).toHaveCount(0);
  await expect(
    report.getByText("E2E capsule report #1: office capsule is cohesive"),
  ).toBeVisible();
  await report.getByRole("button", { name: "Show details" }).click();
  await expect(report.getByText("E2E mock report generated.")).toBeVisible();

  await report
    .getByText("White leather sneakers need attention in office outfits.")
    .hover();
  await expect(
    page.getByTestId("capsule-report-item-highlighted"),
  ).toContainText("White leather sneakers");

  await page.reload();
  await expect(report).toBeVisible();
  await expect(
    report.getByText("E2E capsule report #1: office capsule is cohesive"),
  ).toBeVisible();

  await report.getByRole("button", { name: "Open report actions" }).click();
  const regenerateResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith("/capsules/capsule-e2e/report") &&
      response.request().method() === "POST",
  );
  await page.getByRole("menuitem", { name: "Regenerate report" }).click();
  expect((await regenerateResponse).ok()).toBe(true);
  await expect(
    report.getByText("E2E capsule report #2: office capsule is cohesive"),
  ).toBeVisible();

  await report.getByRole("button", { name: "Open report actions" }).click();
  const deleteResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith("/capsules/capsule-e2e/report") &&
      response.request().method() === "DELETE",
  );
  await page.getByRole("menuitem", { name: "Delete" }).click();
  expect((await deleteResponse).ok()).toBe(true);
  await expect(report).toHaveCount(0);
});

test("active job sidebar indicators clear after controlled success and failure", async ({
  page,
  resetAndLogin,
}) => {
  await resetAndLogin("with-profile");
  await setManualJobs(page, ["capsuleReportGenerate"]);
  await openCapsule(page);

  const reportJob = await generateCapsuleReport(page);
  const reportJobId = reportJob.job?.id || "";
  expect(reportJobId).not.toBe("");
  await expect(
    page.getByRole("progressbar", { name: "Job in progress" }),
  ).toBeVisible();

  await releaseJob(page, reportJobId);
  await expect(page.getByTestId("capsule-report")).toBeVisible();
  await expect(
    page.getByRole("progressbar", { name: "Job in progress" }),
  ).toHaveCount(0);

  await setManualJobs(page, ["personalItemUploadFiles"]);
  const uploadJob = await uploadOnePersonalItemWithManualJob(page);
  const uploadJobId = uploadJob.job?.id || "";
  expect(uploadJobId).not.toBe("");
  await expect(
    page.getByRole("progressbar", { name: "Personal items is busy" }),
  ).toBeVisible();

  await failJob(page, uploadJobId);
  await expect(
    page.getByRole("progressbar", { name: "Personal items is busy" }),
  ).toHaveCount(0);
  await expect(
    page.getByText("Failed to upload personal item photos. Please try again."),
  ).toBeVisible();
});

test("sidebar capsule and outfit search dialogs support load more empty state and mobile selection", async ({
  page,
  resetAndLogin,
}) => {
  await resetAndLogin("with-profile");
  await seedSidebarLists(page);
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto("/capsule/capsule-e2e");

  await expect(page.getByRole("button", { name: "Show 3 more" })).toBeVisible();
  await page.getByRole("button", { name: "Show 3 more" }).click();
  await expect(
    page.getByRole("button", { name: "Sidebar capsule 01", exact: true }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Search capsules" }).click();
  await page.getByPlaceholder("Search capsules...").fill("Sidebar capsule 11");
  await expect(
    page.getByRole("button", { name: "Sidebar capsule 11", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Sidebar capsule 11", exact: true })
    .click();
  await expect(page).toHaveURL(/\/capsule\/capsule-e2e-\d+$/);
  await expect(
    page.getByRole("button", { name: "Rename capsule Sidebar capsule 11" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Search capsules" }).click();
  await page.getByPlaceholder("Search capsules...").fill("No capsule match");
  await expect(page.getByText("No capsules found.")).toBeVisible();
  await page.keyboard.press("Escape");

  await expect(page.getByRole("button", { name: "Show 2 more" })).toBeVisible();
  await page.getByRole("button", { name: "Search outfits" }).click();
  await page.getByPlaceholder("Search outfits...").fill("No outfit match");
  await expect(page.getByText("No outfits found.")).toBeVisible();
  await page.getByPlaceholder("Search outfits...").fill("Sidebar outfit 08");
  await expect(
    page.getByRole("button", { name: "Sidebar outfit 08", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Sidebar outfit 08", exact: true })
    .click();
  await expect(page).toHaveURL(/\/outfit\/outfit-e2e-\d+$/);
  await expect(
    page.getByRole("button", { name: "Rename capsule Sidebar outfit 08" }),
  ).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/capsule/capsule-e2e");
  await page.getByRole("button", { name: "Toggle sidebar" }).click();
  const drawer = page.locator(".MuiDrawer-root .MuiDrawer-paper");
  await expect(drawer).toBeVisible();
  await page
    .locator(".MuiDrawer-root")
    .getByRole("button", { name: "Search capsules" })
    .click();
  await page.getByPlaceholder("Search capsules...").fill("Sidebar capsule 03");
  await page
    .getByRole("button", { name: "Sidebar capsule 03", exact: true })
    .click();
  await expect(page).toHaveURL(/\/capsule\/capsule-e2e-\d+$/);
  await expect(drawer).toBeHidden();
  await expect(
    page.getByRole("heading", { name: "Sidebar capsule 03" }),
  ).toBeVisible();
});
