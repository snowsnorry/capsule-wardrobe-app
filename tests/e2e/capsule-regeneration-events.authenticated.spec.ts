import type { Page } from "@playwright/test";
import { expect, test } from "./test";

const capsuleId = "capsule-e2e";
const originalProductName = "Navy relaxed shirt";
const originalProductUrl = "https://example.test/products/navy-shirt";
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
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Regenerate all" }),
  ).toBeVisible();
}

async function expectProductLink(page: Page, name: string, url: string) {
  const link = page.getByRole("link", { name, exact: true });
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute("href", url);
}

test("applying capsule filters shows pending regeneration until SSE ready snapshot", async ({
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

  await resetAndLogin("with-profile");
  await openApp(page);

  await expectProductLink(page, originalProductName, originalProductUrl);

  const modeResponse = await page
    .context()
    .request.post("/__e2e/generation/mode", { data: { mode: "pending" } });
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
      response.url().endsWith(`/capsules/${capsuleId}/events`) &&
      response.request().method() === "GET" &&
      response.status() === 200,
  );
  await confirmDialog
    .getByRole("button", { name: "Apply and regenerate" })
    .click();

  const filterResponse = await filterRegenerationResponse;
  expect(filterResponse.ok()).toBe(true);
  await eventStreamResponse;

  await expect(page.getByRole("progressbar")).toBeVisible();
  for (const product of readyProducts) {
    await expect(
      page.getByRole("link", { name: product.name, exact: true }),
    ).toHaveCount(0);
  }

  const releaseResponse = await page
    .context()
    .request.post("/__e2e/generation/release", { data: { capsuleId } });
  await expect(releaseResponse).toBeOK();
  await expect(
    (await releaseResponse.json()) as { published?: boolean },
  ).toEqual(expect.objectContaining({ published: true, status: "ready" }));

  for (const product of readyProducts) {
    await expectProductLink(page, product.name, product.url);
  }
  await expect(page.getByRole("progressbar")).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: originalProductName, exact: true }),
  ).toHaveCount(0);

  await page.reload();
  await expect(
    page.getByRole("button", { name: "Regenerate all" }),
  ).toBeVisible();
  for (const product of readyProducts) {
    await expectProductLink(page, product.name, product.url);
  }
  await expect(
    page.getByRole("link", { name: originalProductName, exact: true }),
  ).toHaveCount(0);
  expect(externalRequests).toEqual([]);
});
