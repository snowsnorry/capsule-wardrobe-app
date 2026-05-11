import type { Page } from "@playwright/test";
import { expect, test } from "./test";

const selectedProductName = "Navy relaxed shirt";
const selectedProductUrl = "https://example.test/products/navy-shirt";
const controlProductName = "Straight black trousers";
const controlProductUrl = "https://example.test/products/black-trousers";
const replacementProductName = "E2E Regenerated Shirt";
const replacementProductUrl =
  "https://example.test/products/regenerated-shirt-1";
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

  await expectProductLink(page, selectedProductName, selectedProductUrl);
  await expectProductLink(page, controlProductName, controlProductUrl);

  await page
    .getByRole("link", { name: selectedProductName, exact: true })
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

  await expectProductLink(page, replacementProductName, replacementProductUrl);
  await expectProductLink(page, controlProductName, controlProductUrl);
  await expect(
    page.getByRole("link", { name: selectedProductName, exact: true }),
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
  await expectProductLink(page, replacementProductName, replacementProductUrl);
  await expectProductLink(page, controlProductName, controlProductUrl);
  await expect(
    page.getByRole("link", { name: selectedProductName, exact: true }),
  ).toHaveCount(0);
  expect(externalRequests).toEqual([]);
});
