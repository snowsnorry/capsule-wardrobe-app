import type { Page } from "@playwright/test";
import { expect, test } from "./test";

const capsuleId = "capsule-e2e";
const originalProductName = "Navy relaxed shirt";
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

test("applying capsule filters reconciles through the shared jobs stream", async ({
  baseURL,
  page,
  resetAndLogin,
}) => {
  const externalRequests: string[] = [];
  const eventRequests: string[] = [];
  const capsuleReadRequests: string[] = [];
  const recentCapsuleRequests: string[] = [];
  page.on("request", (request) => {
    const url = request.url();
    if (url.includes("/events")) eventRequests.push(url);
    if (
      request.method() === "GET" &&
      new URL(url).pathname.endsWith(`/capsules/${capsuleId}`)
    ) {
      capsuleReadRequests.push(url);
    }
    if (
      request.method() === "GET" &&
      new URL(url).pathname.endsWith("/capsules/recent")
    ) {
      recentCapsuleRequests.push(url);
    }
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

  await resetAndLogin("with-profile");
  await openApp(page);

  await expectProductCard(page, originalProductName);

  const modeResponse = await page
    .context()
    .request.post("/__e2e/jobs/manual-mode", {
      data: { kinds: ["capsuleGenerate"] },
    });
  await expect(modeResponse).toBeOK();

  await page.getByRole("button", { name: "Formal" }).click();
  await expect(page.getByRole("button", { name: "Apply" })).toBeEnabled();

  await page.getByRole("button", { name: "Regenerate all" }).click();
  const confirmDialog = page.getByRole("dialog", {
    name: "Apply updated filters?",
  });
  await expect(confirmDialog).toBeVisible();

  const filterRegenerationResponse = page.waitForResponse(
    (response) =>
      response
        .url()
        .endsWith(`/capsules/${capsuleId}/filters?regenerate=true`) &&
      response.request().method() === "PATCH",
  );
  const eventStreamResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith("/jobs/events") &&
      response.request().method() === "GET" &&
      response.status() === 200,
  );
  await confirmDialog
    .getByRole("button", { name: "Apply and regenerate" })
    .click();

  const filterResponse = await filterRegenerationResponse;
  expect(filterResponse.ok()).toBe(true);
  const filterPayload = (await filterResponse.json()) as {
    job?: { id?: string };
  };
  expect(filterPayload.job?.id).toBeTruthy();
  await eventStreamResponse;

  await expect(
    page.getByRole("progressbar", { name: "Job in progress" }),
  ).toBeVisible();
  for (const product of readyProducts) {
    await expect(
      page.getByRole("button", { name: product.name, exact: true }),
    ).toHaveCount(0);
  }

  const capsuleReadsBeforeCompletion = capsuleReadRequests.length;
  const recentReadsBeforeCompletion = recentCapsuleRequests.length;
  const releaseResponse = await page
    .context()
    .request.post(`/__e2e/jobs/${filterPayload.job?.id}/release`);
  await expect(releaseResponse).toBeOK();
  await expect(
    (await releaseResponse.json()) as { job?: { status?: string } },
  ).toEqual(
    expect.objectContaining({
      job: expect.objectContaining({ status: "completed" }),
    }),
  );

  for (const product of readyProducts) {
    await expectProductCard(page, product.name);
  }
  await expect(page.getByRole("progressbar")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: originalProductName, exact: true }),
  ).toHaveCount(0);
  expect(capsuleReadRequests.length - capsuleReadsBeforeCompletion).toBe(1);
  expect(recentCapsuleRequests.length - recentReadsBeforeCompletion).toBe(1);

  await page.reload();
  await expect(
    page.getByRole("button", { name: "Regenerate all" }),
  ).toBeVisible();
  for (const product of readyProducts) {
    await expectProductCard(page, product.name);
  }
  await expect(
    page.getByRole("button", { name: originalProductName, exact: true }),
  ).toHaveCount(0);
  expect(externalRequests).toEqual([]);
  expect(
    eventRequests.filter((url) => url.endsWith("/jobs/events")),
  ).toHaveLength(1);
  expect(
    eventRequests.filter(
      (url) =>
        url.includes(`/capsules/${capsuleId}/events`) ||
        /\/jobs\/[^/]+\/events$/.test(url),
    ),
  ).toEqual([]);
});
