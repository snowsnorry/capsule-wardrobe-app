import { expect, test } from "./test";
import type { Page } from "@playwright/test";
import {
  collectUnexpectedExternalRequests,
  expectOutfitImage,
  expectOutfitImageEmpty,
  openCapsuleOutfitSet,
} from "./outfitImageHelpers";

async function copyCurrentOutfitSetToSavedOutfit(page: Page) {
  await page.getByRole("button", { name: "Copy to outfits" }).click();
  const copyDialog = page.getByRole("dialog", { name: "Copy to outfits" });
  await expect(copyDialog).toBeVisible();
  await copyDialog.getByRole("button", { name: "Copy" }).click();
  await expect(page.getByText("Outfit copied")).toBeVisible();
  await page.getByRole("button", { name: "Open outfit", exact: true }).click();
  await expect(page).toHaveURL(/\/outfit\/outfit-e2e-1$/);
}

test("saved outfit image delete generate and reload persistence works through the UI", async ({
  baseURL,
  page,
  resetAndLogin,
}) => {
  const unexpectedExternalRequests = collectUnexpectedExternalRequests(
    page,
    baseURL,
  );

  await resetAndLogin("with-profile");
  await openCapsuleOutfitSet(page);
  await copyCurrentOutfitSetToSavedOutfit(page);
  await expectOutfitImage(page, /\/__e2e\/images\/copied-saved-outfit\.svg$/);

  await page.getByRole("button", { name: "Delete image" }).click();
  const savedDeleteDialog = page.getByRole("dialog").filter({
    has: page.getByRole("heading", { name: "Delete image" }),
  });
  await expect(savedDeleteDialog).toBeVisible();
  await savedDeleteDialog.getByRole("button", { name: "Delete" }).click();
  await expectOutfitImageEmpty(page);

  await page.getByRole("button", { name: "Create image" }).click();
  await expectOutfitImage(
    page,
    /\/__e2e\/images\/generated-saved-outfit-outfit-e2e-1-\d+\.svg$/,
  );

  await page.reload();
  await expectOutfitImage(
    page,
    /\/__e2e\/images\/generated-saved-outfit-outfit-e2e-1-\d+\.svg$/,
  );

  expect(unexpectedExternalRequests).toEqual([]);
});
