import { Buffer } from "node:buffer";
import type { FilePayload, Page } from "@playwright/test";
import { expect, test } from "./test";

const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMB/atcw3kAAAAASUVORK5CYII=",
  "base64",
);

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
  expect(uploadResponse.status()).toBe(200);

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
