import { Buffer } from "node:buffer";
import type { Locator, Page } from "@playwright/test";
import { expect, test } from "./test";

type FilePayload = Extract<
  Parameters<Locator["setInputFiles"]>[0],
  { name: string }
>;

const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMB/atcw3kAAAAASUVORK5CYII=",
  "base64",
);
const catalogItemName = "Navy relaxed shirt";
const searchResultName = /Navy relaxed shirt E2E Studio/;

function buildPngUpload(name: string): FilePayload {
  return {
    name,
    mimeType: "image/png",
    buffer: TINY_PNG,
  };
}

async function openWardrobe(page: Page) {
  await page.goto("/personal-items");
  await expect(
    page.getByRole("button", { name: "Upload item photo" }),
  ).toBeVisible();
}

async function expectUploadedFilterSelected(page: Page) {
  await expect(
    page.getByRole("button", { name: "Uploaded", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
}

function wardrobeToolbar(page: Page) {
  return page.getByTestId("wardrobe-toolbar");
}

function personalItemCard(page: Page, name: string | RegExp) {
  const itemButton = page.getByRole("button", { name, exact: true });
  return itemButton.locator(
    "xpath=ancestor-or-self::*[contains(@class, 'wardrobe-card-root')][1]",
  );
}

async function expectPersonalItemVisible(page: Page, name: string | RegExp) {
  await expect(page.getByRole("button", { name, exact: true })).toBeVisible();
}

async function expectPersonalItemHidden(page: Page, name: string | RegExp) {
  await expect(page.getByRole("button", { name, exact: true })).toHaveCount(0);
}

async function uploadWardrobeFiles(page: Page, files: FilePayload[]) {
  await page.getByRole("button", { name: "Upload item photo" }).click();

  const dialog = page.getByRole("dialog", {
    name: "Upload personal item photos",
  });
  await expect(dialog).toBeVisible();

  await page.locator('input[type="file"]').setInputFiles(files);
  await expect(
    dialog.getByText(new RegExp(`^${files.length} files, `)),
  ).toBeVisible();
  for (const file of files) {
    await expect(dialog.getByText(file.name, { exact: true })).toBeVisible();
  }

  const uploadResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().includes("/wardrobe/items/upload"),
  );
  await dialog.getByRole("button", { name: "Upload" }).click();
  const uploadResponse = await uploadResponsePromise;
  expect(uploadResponse.status()).toBe(202);
  expect(
    (await uploadResponse.json()) as { job?: { status?: string } },
  ).toEqual(
    expect.objectContaining({
      job: expect.objectContaining({ status: "completed" }),
    }),
  );

  await expect(dialog).toBeHidden();
  await expectUploadedFilterSelected(page);
}

async function uploadWardrobeUrls(page: Page, urls: string[]) {
  await page.getByRole("button", { name: "Choose upload method" }).click();
  await page.getByRole("menuitem", { name: "Upload image URL" }).click();

  const dialog = page.getByRole("dialog", {
    name: "Upload product image URLs",
  });
  await expect(dialog).toBeVisible();

  for (const [index, url] of urls.entries()) {
    await dialog
      .getByRole("textbox", { name: `Product image URL ${index + 1}` })
      .fill(url);
  }

  const uploadResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().includes("/wardrobe/items/upload-url"),
  );
  await dialog.getByRole("button", { name: "Upload image URLs" }).click();
  const uploadResponse = await uploadResponsePromise;
  expect(uploadResponse.status()).toBe(202);
  expect(
    (await uploadResponse.json()) as { job?: { status?: string } },
  ).toEqual(
    expect.objectContaining({
      job: expect.objectContaining({ status: "completed" }),
    }),
  );

  await expect(dialog).toBeHidden();
  await expectUploadedFilterSelected(page);
}

async function expectUploadedItemVisible(page: Page, index: number) {
  await expect(
    page.getByRole("button", {
      name: `Uploaded e2e item ${index}`,
      exact: true,
    }),
  ).toBeVisible();
}

async function saveAndLikeCatalogItemFromSearch(page: Page) {
  await page.goto("/explore");
  await page
    .getByPlaceholder(/Search in natural language/)
    .fill("navy office shirt");
  await page.keyboard.press("Enter");

  await expect(page.getByText("3 results")).toBeVisible();
  await expect(
    page.getByRole("button", { name: searchResultName }),
  ).toBeVisible();

  const detail = page.getByTestId("product-detail-content");
  await detail.getByRole("button", { name: "Product actions" }).click();
  const saveResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith("/wardrobe/items/from-catalog") &&
      response.request().method() === "POST",
  );
  await page.getByRole("menuitem", { name: "Save to Personal items" }).click();
  expect((await saveResponse).ok()).toBe(true);

  await detail.getByRole("button", { name: "Product actions" }).click();
  const likeResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith("/liked-items") &&
      response.request().method() === "POST",
  );
  await page.getByRole("menuitem", { name: "Like" }).click();
  expect((await likeResponse).ok()).toBe(true);
}

test("uploads one wardrobe image", async ({ page, resetAndLogin }) => {
  await resetAndLogin("with-profile");
  await openWardrobe(page);

  await uploadWardrobeFiles(page, [buildPngUpload("linen-shirt.png")]);

  await expect(page.getByText("No saved items yet")).toBeHidden();
  await expectUploadedItemVisible(page, 1);

  await page.reload();

  await expectUploadedItemVisible(page, 1);
});

test("opens personal items on the canonical URL", async ({
  page,
  resetAndLogin,
}) => {
  await resetAndLogin("with-profile");

  await page.goto("/");

  await expect(page).toHaveURL(/\/personal-items$/);

  await page.goto("/personal-items");

  await expect(page).toHaveURL(/\/personal-items$/);
  await expect(
    page.getByRole("button", { name: "Upload item photo" }),
  ).toBeVisible();
});

test("uploads five wardrobe images at once", async ({
  page,
  resetAndLogin,
}) => {
  await resetAndLogin("with-profile");
  await openWardrobe(page);

  await uploadWardrobeFiles(page, [
    buildPngUpload("linen-shirt.png"),
    buildPngUpload("navy-trousers.png"),
    buildPngUpload("cotton-jacket.png"),
    buildPngUpload("white-sneakers.png"),
    buildPngUpload("canvas-bag.png"),
  ]);

  for (let index = 1; index <= 5; index += 1) {
    await expectUploadedItemVisible(page, index);
  }
  await expect(
    page.getByRole("button", { name: /^Uploaded e2e item [1-5]$/ }),
  ).toHaveCount(5);
});

test("uploads a personal item from an image URL and persists it", async ({
  page,
  resetAndLogin,
}) => {
  await resetAndLogin("with-profile");
  await openWardrobe(page);

  await uploadWardrobeUrls(page, [
    "https://example.test/images/personal-linen-shirt.jpg",
  ]);

  await expect(page.getByText("No saved items yet")).toBeHidden();
  await expectUploadedItemVisible(page, 1);

  await page.reload();

  await expectUploadedFilterSelected(page);
  await expectUploadedItemVisible(page, 1);
});

test("edits reloads and deletes an uploaded personal item", async ({
  page,
  resetAndLogin,
}) => {
  await resetAndLogin("with-profile");
  await openWardrobe(page);
  await uploadWardrobeFiles(page, [buildPngUpload("linen-shirt.png")]);

  await page
    .getByRole("button", { name: "Uploaded e2e item 1", exact: true })
    .click();
  const detail = page.getByTestId("product-detail-content");
  await expect(detail).toBeVisible();
  await detail.getByRole("button", { name: "Product actions" }).click();
  await page.getByRole("menuitem", { name: "Edit" }).click();

  const updatedName = "Edited e2e linen shirt";
  const updatedDescription = "Edited metadata from the e2e detail form.";
  await page.getByRole("textbox", { name: "Name" }).fill(updatedName);
  await page
    .getByRole("textbox", { name: "Description" })
    .fill(updatedDescription);
  await page.getByRole("textbox", { name: "Brand" }).fill("E2E Tailoring");

  const updateResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "PATCH" &&
      response.url().includes("/wardrobe/items/uploaded/uploaded-e2e-1"),
  );
  await page.getByRole("button", { name: "Apply" }).click();
  expect((await updateResponse).ok()).toBe(true);

  await expect(detail.getByText(updatedName)).toBeVisible();
  await expect(detail.getByText(updatedDescription)).toBeVisible();
  await page.getByRole("button", { name: "Close" }).click();
  await expectPersonalItemVisible(page, updatedName);

  await page.reload();
  await expectUploadedFilterSelected(page);
  await expectPersonalItemVisible(page, updatedName);

  await page.getByRole("button", { name: updatedName, exact: true }).click();
  await expect(page.getByTestId("product-detail-content")).toContainText(
    updatedDescription,
  );
  await page.getByRole("button", { name: "Close" }).click();

  const card = personalItemCard(page, updatedName);
  await card.hover();
  await card.getByRole("button", { name: "Open product menu" }).click();
  await page.getByRole("menuitem", { name: "Delete item" }).click();

  const deleteDialog = page.getByRole("dialog", {
    name: "Delete uploaded item?",
  });
  await expect(deleteDialog).toBeVisible();
  const deleteResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "DELETE" &&
      response.url().includes("/wardrobe/items/uploaded/uploaded-e2e-1"),
  );
  await deleteDialog.getByRole("button", { name: "Delete" }).click();
  expect((await deleteResponse).ok()).toBe(true);
  await expectPersonalItemHidden(page, updatedName);
});

test("generates regenerates deletes and exports the Personal items report", async ({
  page,
  resetAndLogin,
}) => {
  await resetAndLogin("with-profile");
  await openWardrobe(page);
  await uploadWardrobeFiles(page, [buildPngUpload("linen-shirt.png")]);

  const generateResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().endsWith("/wardrobe/items/report"),
  );
  await wardrobeToolbar(page).getByRole("button", { name: "Analyze" }).click();
  expect((await generateResponse).ok()).toBe(true);

  const report = page.getByTestId("personal-items-report");
  await expect(report).toBeVisible();
  await expect(
    report.getByRole("heading", { name: "Personal items report" }),
  ).toBeVisible();
  await expect(
    report.getByText("E2E personal items report #1 for 1 item."),
  ).toBeVisible();

  await page.reload();
  await expectUploadedFilterSelected(page);
  await expect(report).toBeVisible();
  await expect(
    report.getByText("E2E personal items report #1 for 1 item."),
  ).toBeVisible();

  await page.getByRole("button", { name: "Open Personal items menu" }).click();
  const pdfResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().includes("/wardrobe/items/pdf"),
  );
  await page.getByRole("menuitem", { name: "Export as PDF" }).click();
  const pdf = await pdfResponse;
  expect(pdf.ok()).toBe(true);
  await expect
    .poll(() => pdf.headers()["content-type"])
    .toContain("application/pdf");

  await report.getByRole("button", { name: "Open report actions" }).click();
  const regenerateResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().endsWith("/wardrobe/items/report"),
  );
  await page.getByRole("menuitem", { name: "Regenerate report" }).click();
  expect((await regenerateResponse).ok()).toBe(true);
  await expect(
    report.getByText("E2E personal items report #2 for 1 item."),
  ).toBeVisible();
  await expect(
    report.getByText("E2E personal items report #1 for 1 item."),
  ).toHaveCount(0);

  await report.getByRole("button", { name: "Open report actions" }).click();
  const deleteResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "DELETE" &&
      response.url().endsWith("/wardrobe/items/report"),
  );
  await page.getByRole("menuitem", { name: "Delete" }).click();
  expect((await deleteResponse).ok()).toBe(true);
  await expect(report).toHaveCount(0);
});

test("filters mixed Personal items by source liked state and persists filters", async ({
  page,
  resetAndLogin,
}) => {
  await resetAndLogin("with-profile");
  await openWardrobe(page);
  await uploadWardrobeFiles(page, [buildPngUpload("linen-shirt.png")]);
  await saveAndLikeCatalogItemFromSearch(page);

  await page.goto("/personal-items");
  await wardrobeToolbar(page)
    .getByRole("button", { name: "All", exact: true })
    .click();
  await expectPersonalItemVisible(page, "Uploaded e2e item 1");
  await expectPersonalItemVisible(page, catalogItemName);

  await wardrobeToolbar(page)
    .getByRole("button", { name: "Uploaded", exact: true })
    .click();
  await expectPersonalItemVisible(page, "Uploaded e2e item 1");
  await expectPersonalItemHidden(page, catalogItemName);

  await wardrobeToolbar(page)
    .getByRole("button", { name: "Catalog", exact: true })
    .click();
  await expectPersonalItemHidden(page, "Uploaded e2e item 1");
  await expectPersonalItemVisible(page, catalogItemName);

  await wardrobeToolbar(page)
    .getByRole("button", { name: "Liked only" })
    .click();
  await expect(
    wardrobeToolbar(page).getByRole("button", { name: "Liked only" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expectPersonalItemVisible(page, catalogItemName);

  await wardrobeToolbar(page)
    .getByRole("button", { name: "All", exact: true })
    .click();
  await expectPersonalItemVisible(page, catalogItemName);
  await expectPersonalItemHidden(page, "Uploaded e2e item 1");

  await page.reload();
  await expect(
    wardrobeToolbar(page).getByRole("button", { name: "All", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    wardrobeToolbar(page).getByRole("button", { name: "Liked only" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expectPersonalItemVisible(page, catalogItemName);
  await expectPersonalItemHidden(page, "Uploaded e2e item 1");
});
