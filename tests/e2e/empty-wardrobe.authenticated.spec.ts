import type { Page } from "@playwright/test";
import { expect, test } from "./test";

const capsuleId = "capsule-e2e";
const emptyCapsuleName = "Empty Playwright capsule";
const failureMessage =
  "Failed to regenerate the capsule. Your previous capsule was restored.";
const readyProducts = [
  {
    name: "E2E Ready linen blazer",
    url: "https://example.test/products/ready-linen-blazer",
  },
  {
    name: "E2E Ready tailored trousers",
    url: "https://example.test/products/ready-tailored-trousers",
  },
  {
    name: "E2E Ready almond loafers",
    url: "https://example.test/products/ready-almond-loafers",
  },
];
const EXPECTED_GLOBAL_EXTERNAL_HOSTS = new Set(["fonts.googleapis.com"]);

function isLocalHttpUrl(rawUrl: string, baseURL: string | undefined): boolean {
  const url = new URL(rawUrl);
  const base = new URL(baseURL || "http://127.0.0.1:5310");
  return (
    ["http:", "https:"].includes(url.protocol) &&
    (url.origin === base.origin ||
      ["127.0.0.1", "localhost", "::1"].includes(url.hostname))
  );
}

async function openApp(page: Page) {
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto("/capsule/capsule-e2e");
  await expect(
    page.getByRole("button", { name: "Regenerate all" }),
  ).toBeVisible();
}

async function expectProductCard(page: Page, name: string) {
  await expect(page.getByRole("button", { name, exact: true })).toBeVisible();
}

async function expectEmptyWardrobe(page: Page) {
  await expect(
    page.getByRole("button", { name: `Rename capsule ${emptyCapsuleName}` }),
  ).toBeVisible();
  await expect(page.getByTestId("capsule-summary")).toContainText("0 items");
  await expect(page.getByTestId("capsule-summary")).toContainText("0 outfits");
  await expect(page.getByRole("link")).toHaveCount(0);
}

test("empty wardrobe recovers from one failed full regeneration and persists retry success", async ({
  baseURL,
  page,
  resetAndLogin,
}) => {
  const externalRequests: string[] = [];
  page.on("request", (request) => {
    const url = request.url();
    if (isLocalHttpUrl(url, baseURL)) {
      return;
    }
    const parsedUrl = new URL(url);
    if (
      ["http:", "https:"].includes(parsedUrl.protocol) &&
      !EXPECTED_GLOBAL_EXTERNAL_HOSTS.has(parsedUrl.hostname)
    ) {
      externalRequests.push(url);
    }
  });

  await resetAndLogin("empty-wardrobe");
  await openApp(page);
  await expectEmptyWardrobe(page);

  const failOnceResponse = await page
    .context()
    .request.post("/__e2e/fail-once", {
      data: { domain: "generation", action: "regenerate-all" },
    });
  await expect(failOnceResponse).toBeOK();

  const failedRegenerationResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith(`/capsules/${capsuleId}/regenerate`) &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Regenerate all" }).click();
  const failedResponse = await failedRegenerationResponse;
  expect(failedResponse.status()).toBe(202);
  await expect(
    (await failedResponse.json()) as { job?: { status?: string } },
  ).toEqual(
    expect.objectContaining({
      job: expect.objectContaining({ status: "failed" }),
    }),
  );

  await expect(page.getByRole("alert")).toContainText(failureMessage);
  await expect(page.getByRole("progressbar")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Regenerate all" }),
  ).toBeEnabled();
  await expectEmptyWardrobe(page);

  const successfulRetryResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith(`/capsules/${capsuleId}/regenerate`) &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Regenerate all" }).click();
  const retryResponse = await successfulRetryResponse;
  expect(retryResponse.status()).toBe(202);
  await expect(
    (await retryResponse.json()) as { job?: { status?: string } },
  ).toEqual(
    expect.objectContaining({
      job: expect.objectContaining({ status: "completed" }),
    }),
  );

  for (const product of readyProducts) {
    await expectProductCard(page, product.name);
  }
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.getByRole("progressbar")).toHaveCount(0);

  await page.reload();
  await expect(
    page.getByRole("button", { name: "Regenerate all" }),
  ).toBeVisible();
  for (const product of readyProducts) {
    await expectProductCard(page, product.name);
  }
  await expect(page.getByRole("alert")).toHaveCount(0);
  expect(externalRequests).toEqual([]);
});

test("full regeneration shows an error when its queued job fails", async ({
  page,
  resetAndLogin,
}) => {
  await resetAndLogin("empty-wardrobe");
  await openApp(page);

  const manualModeResponse = await page
    .context()
    .request.post("/__e2e/jobs/manual-mode", {
      data: { kinds: ["capsuleGenerate"] },
    });
  await expect(manualModeResponse).toBeOK();

  const regenerationResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith(`/capsules/${capsuleId}/regenerate`) &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Regenerate all" }).click();
  const response = await regenerationResponse;
  expect(response.status()).toBe(202);
  const payload = (await response.json()) as {
    job?: { id?: string; status?: string };
  };
  expect(payload.job).toEqual(
    expect.objectContaining({ id: expect.any(String), status: "queued" }),
  );
  await expect(
    page.getByRole("progressbar", { name: "Job in progress" }),
  ).toBeVisible();

  const failureResponse = await page
    .context()
    .request.post(`/__e2e/jobs/${payload.job?.id}/fail`, {
      data: { errorCode: "e2e_forced_failure" },
    });
  await expect(failureResponse).toBeOK();
  await expect(page.getByRole("alert")).toContainText(failureMessage);
  await expect(page.getByRole("progressbar")).toHaveCount(0);
  await expectEmptyWardrobe(page);
});
