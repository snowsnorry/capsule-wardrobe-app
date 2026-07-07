import { expect, test } from "./test";
import type { Page } from "@playwright/test";

const catalogItemName = "Navy relaxed shirt";
const searchResultName = /Navy relaxed shirt E2E Studio/;

function selectedProductDetail(page: Page) {
  return page.getByTestId("product-detail-content");
}

function wardrobeToolbar(page: Page) {
  return page.getByTestId("wardrobe-toolbar");
}

function personalItemCard(page: Page, name: string) {
  return page
    .getByRole("button", { name, exact: true })
    .locator(
      "xpath=ancestor-or-self::*[contains(@class, 'wardrobe-card-root')][1]",
    );
}

async function expectCatalogItemVisible(page: Page) {
  await expect(
    page.getByRole("button", { name: catalogItemName, exact: true }),
  ).toBeVisible();
}

async function openProductActions(page: Page) {
  await selectedProductDetail(page)
    .getByRole("button", { name: "Product actions" })
    .click();
}

async function likeSelectedProduct(page: Page) {
  await openProductActions(page);
  const likeResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith("/liked-items") &&
      response.request().method() === "POST",
  );
  await page.getByRole("menuitem", { name: "Like" }).click();
  expect((await likeResponse).ok()).toBe(true);
  await expect(selectedProductDetail(page).getByLabel("Liked")).toBeVisible();
}

async function saveSelectedProductToPersonalItems(page: Page) {
  await openProductActions(page);
  const saveResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith("/wardrobe/items/from-catalog") &&
      response.request().method() === "POST",
  );
  await page.getByRole("menuitem", { name: "Save to Personal items" }).click();
  expect((await saveResponse).ok()).toBe(true);
  await expect(selectedProductDetail(page).getByLabel("Saved")).toBeVisible();
}

async function openPersonalItemMenu(page: Page, name: string) {
  const card = personalItemCard(page, name);
  await card.hover();
  await card.getByRole("button", { name: "Open product menu" }).click();
}

test("liked catalog state follows an item across capsule search and Personal items", async ({
  page,
  resetAndLogin,
}) => {
  await resetAndLogin("with-profile");

  await page.goto("/capsule/capsule-e2e");
  await expect(
    page.getByRole("button", { name: "Regenerate all" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: catalogItemName, exact: true })
    .click();
  await expect(selectedProductDetail(page)).toBeVisible();

  await likeSelectedProduct(page);
  await page.getByRole("button", { name: "Close" }).click();

  await page.reload();
  await expect(
    page.getByRole("button", { name: "Regenerate all" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: catalogItemName, exact: true })
    .click();
  await expect(selectedProductDetail(page).getByLabel("Liked")).toBeVisible();
  await page.getByRole("button", { name: "Close" }).click();

  await page.goto("/explore");
  await page
    .getByPlaceholder(/Search in natural language/)
    .fill("navy office shirt");
  await page.keyboard.press("Enter");

  await expect(page.getByText("3 results")).toBeVisible();
  await expect(
    page.getByRole("button", { name: searchResultName }),
  ).toBeVisible();
  await expect(selectedProductDetail(page).getByLabel("Liked")).toBeVisible();

  await saveSelectedProductToPersonalItems(page);

  await page.goto("/personal-items");
  await wardrobeToolbar(page)
    .getByRole("button", { name: "Catalog", exact: true })
    .click();
  await expectCatalogItemVisible(page);

  await wardrobeToolbar(page)
    .getByRole("button", { name: "Liked only" })
    .click();
  await expect(
    wardrobeToolbar(page).getByRole("button", { name: "Liked only" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expectCatalogItemVisible(page);

  await page.reload();
  await expect(
    wardrobeToolbar(page).getByRole("button", {
      name: "Catalog",
      exact: true,
    }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    wardrobeToolbar(page).getByRole("button", { name: "Liked only" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expectCatalogItemVisible(page);

  await openPersonalItemMenu(page, catalogItemName);
  const unlikeResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith("/liked-items") &&
      response.request().method() === "DELETE",
  );
  await page.getByRole("menuitem", { name: "Remove like" }).click();
  expect((await unlikeResponse).ok()).toBe(true);
  await expect(
    page.getByRole("button", { name: catalogItemName, exact: true }),
  ).toHaveCount(0);

  await wardrobeToolbar(page)
    .getByRole("button", { name: "Liked only" })
    .click();
  await expectCatalogItemVisible(page);

  await openPersonalItemMenu(page, catalogItemName);
  const removeResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith("/wardrobe/items/from-catalog") &&
      response.request().method() === "DELETE",
  );
  await page
    .getByRole("menuitem", { name: "Remove from Personal items" })
    .click();
  const removeDialog = page.getByRole("dialog", {
    name: "Remove from Personal items?",
  });
  await expect(removeDialog).toBeVisible();
  await removeDialog.getByRole("button", { name: "Remove" }).click();
  expect((await removeResponse).ok()).toBe(true);
  await expect(
    page.getByRole("button", { name: catalogItemName, exact: true }),
  ).toHaveCount(0);
});
