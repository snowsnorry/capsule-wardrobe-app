import type { Page } from "@playwright/test";
import { expect, test } from "./test";

const selectedProductName = "Navy relaxed shirt";
const controlProductName = "Straight black trousers";
const replacementProductName = "E2E Regenerated Shirt";
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

test("selected item regeneration replaces only the selected wardrobe product and persists", async ({
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

  await expectProductCard(page, selectedProductName);
  await expectProductCard(page, controlProductName);

  await page
    .getByRole("button", { name: selectedProductName, exact: true })
    .hover();
  await page.getByRole("button", { name: "Open product menu" }).first().click();
  await page.getByRole("menuitem", { name: "Select" }).click();

  await expect(
    page.getByRole("button", { name: "Regenerate Selected (1)" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Cancel" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Mark item for partial regeneration" }),
  ).toBeVisible();

  const selectedRegenerationResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith("/capsules/capsule-e2e/regenerate-selected") &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Regenerate Selected (1)" }).click();
  await selectedRegenerationResponse;

  await expectProductCard(page, replacementProductName);
  await expectProductCard(page, controlProductName);
  await expect(
    page.getByRole("button", { name: selectedProductName, exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Regenerate all" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Regenerate Selected (1)" }),
  ).toHaveCount(0);

  await page.reload();

  await expect(
    page.getByRole("button", { name: "Regenerate all" }),
  ).toBeVisible();
  await expectProductCard(page, replacementProductName);
  await expectProductCard(page, controlProductName);
  await expect(
    page.getByRole("button", { name: selectedProductName, exact: true }),
  ).toHaveCount(0);
  expect(externalRequests).toEqual([]);
});
