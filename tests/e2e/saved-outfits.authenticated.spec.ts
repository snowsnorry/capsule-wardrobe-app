import { expect, test } from "./test";
import type { Page } from "@playwright/test";
import { openCapsuleOutfitSet } from "./outfitImageHelpers";

const originalOutfitName = "E2E saved outfit";
const duplicateOutfitName = "E2E duplicated outfit";
const renamedOutfitName = "E2E renamed outfit";
const addedCatalogItemName = "Sporty navy overshirt";
const copiedOutfitUrl = /\/outfit\/outfit-e2e-1$/;
const duplicatedOutfitUrl = /\/outfit\/outfit-e2e-\d+$/;

async function copyCurrentOutfitSetToSavedOutfit(page: Page) {
  await page.getByRole("button", { name: "Copy to outfits" }).click();
  const copyDialog = page.getByRole("dialog", { name: "Copy to outfits" });
  await expect(copyDialog).toBeVisible();
  await copyDialog.getByRole("button", { name: "Copy" }).click();
  await expect(page.getByText("Outfit copied")).toBeVisible();
  await page.getByRole("button", { name: "Open outfit", exact: true }).click();
  await expect(page).toHaveURL(copiedOutfitUrl);
  await expect(page.getByTestId("outfit-screen")).toBeVisible();
}

async function openOutfitMenu(page: Page) {
  await page
    .getByTestId("outfit-content")
    .getByRole("button", { name: "Open outfit actions" })
    .click();
}

async function saveActiveOutfit(page: Page) {
  await openOutfitMenu(page);
  const saveResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith("/save") &&
      response.request().method() === "POST",
  );
  await page.getByRole("menuitem", { name: "Save", exact: true }).click();
  expect((await saveResponse).ok()).toBe(true);
  await expect(page.getByTestId("active-outfit-unsaved-indicator")).toHaveCount(
    0,
  );
}

async function renameActiveOutfit(page: Page, name: string) {
  await openOutfitMenu(page);
  await page.getByRole("menuitem", { name: "Rename" }).click();
  const dialog = page.getByRole("dialog", { name: "Rename outfit" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("textbox", { name: "Rename outfit" }).fill(name);
  const renameResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith("/rename") &&
      response.request().method() === "PATCH",
  );
  await dialog.getByRole("button", { name: "OK" }).click();
  expect((await renameResponse).ok()).toBe(true);
  await expect(
    page.getByRole("button", { name: `Rename capsule ${name}` }),
  ).toBeVisible();
}

async function duplicateActiveOutfit(page: Page, name: string) {
  await openOutfitMenu(page);
  const duplicateResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith("/duplicate") &&
      response.request().method() === "POST",
  );
  await page.getByRole("menuitem", { name: "Save as..." }).click();
  expect((await duplicateResponse).ok()).toBe(true);
  await expect(page).toHaveURL(duplicatedOutfitUrl);
  await renameActiveOutfit(page, name);
}

async function deleteActiveOutfit(page: Page) {
  await openOutfitMenu(page);
  await page.getByRole("menuitem", { name: "Delete" }).click();
  const dialog = page.getByRole("dialog", { name: "Delete outfit" });
  await expect(dialog).toBeVisible();
  const deleteResponse = page.waitForResponse(
    (response) =>
      /\/outfits\/[^/]+$/.test(new URL(response.url()).pathname) &&
      response.request().method() === "DELETE",
  );
  await dialog.getByRole("button", { name: "Delete" }).click();
  expect((await deleteResponse).ok()).toBe(true);
}

async function setOutfitPin(page: Page, pinned: boolean) {
  await openOutfitMenu(page);
  const pinResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith("/pin") &&
      response.request().method() === "PATCH",
  );
  await page
    .getByRole("menuitem", { name: pinned ? "Pin outfit" : "Unpin outfit" })
    .click();
  expect((await pinResponse).ok()).toBe(true);
}

async function addCatalogItemToOutfit(page: Page, name: string) {
  await page.getByRole("button", { name: "Add items" }).click();
  const dialog = page.getByRole("dialog", { name: "Add items" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("tab", { name: "Catalog" }).click();
  await dialog.getByRole("button", { name: "Sporty" }).click();
  await expect(dialog.getByText("1 results")).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: new RegExp(name) }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: new RegExp(name) }).click();

  const updateResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith("/items") &&
      response.request().method() === "PATCH",
  );
  await dialog.getByRole("button", { name: "Add" }).click();
  expect((await updateResponse).ok()).toBe(true);
  await expect(dialog).toBeHidden();
}

async function openOutfitItemMenu(page: Page, name: string) {
  const card = page
    .getByRole("button", { name, exact: true })
    .locator(
      "xpath=ancestor-or-self::*[contains(@class, 'wardrobe-card-root')][1]",
    );
  await card.hover();
  await card.getByRole("button", { name: "Open product menu" }).click();
}

async function removeOutfitItem(page: Page, name: string) {
  await openOutfitItemMenu(page, name);
  await page.getByRole("menuitem", { name: "Delete" }).click();
  const dialog = page.getByRole("dialog", { name: "Remove item" });
  await expect(dialog).toBeVisible();
  const updateResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith("/items") &&
      response.request().method() === "PATCH",
  );
  await dialog.getByRole("button", { name: "Remove" }).click();
  expect((await updateResponse).ok()).toBe(true);
}

async function revertActiveOutfit(page: Page) {
  await openOutfitMenu(page);
  await page.getByRole("menuitem", { name: "Revert" }).click();
  const dialog = page.getByRole("dialog", { name: "Revert changes" });
  await expect(dialog).toBeVisible();
  const revertResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith("/revert") &&
      response.request().method() === "POST",
  );
  await dialog.getByRole("button", { name: "Revert" }).click();
  expect((await revertResponse).ok()).toBe(true);
}

async function createSavedOutfitFromCapsule(page: Page) {
  await openCapsuleOutfitSet(page);
  await copyCurrentOutfitSetToSavedOutfit(page);
  await renameActiveOutfit(page, originalOutfitName);
}

test("saved outfit lifecycle supports add save reload rename duplicate pin revert and delete", async ({
  page,
  resetAndLogin,
}) => {
  await resetAndLogin("with-profile");
  await createSavedOutfitFromCapsule(page);

  await addCatalogItemToOutfit(page, addedCatalogItemName);
  await expect(
    page.getByTestId("active-outfit-unsaved-indicator"),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: addedCatalogItemName, exact: true }),
  ).toBeVisible();

  await saveActiveOutfit(page);
  await page.reload();
  await expect(page).toHaveURL(copiedOutfitUrl);
  await expect(
    page.getByRole("button", { name: addedCatalogItemName, exact: true }),
  ).toBeVisible();

  await renameActiveOutfit(page, renamedOutfitName);
  await duplicateActiveOutfit(page, duplicateOutfitName);

  await setOutfitPin(page, true);
  await setOutfitPin(page, false);

  await removeOutfitItem(page, addedCatalogItemName);
  await expect(
    page.getByTestId("active-outfit-unsaved-indicator"),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: addedCatalogItemName, exact: true }),
  ).toHaveCount(0);

  await revertActiveOutfit(page);
  await expect(page.getByTestId("active-outfit-unsaved-indicator")).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("button", { name: addedCatalogItemName, exact: true }),
  ).toBeVisible();

  await deleteActiveOutfit(page);
  await expect(page).toHaveURL(/\/personal-items$/);
  await expect(
    page.getByRole("button", { name: "Upload item photo" }),
  ).toBeVisible();

  await page.goto("/outfit/outfit-e2e-1");
  await expect(
    page.getByRole("button", { name: `Rename capsule ${renamedOutfitName}` }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: addedCatalogItemName, exact: true }),
  ).toBeVisible();
});

test("saved outfit report regenerates deletes and exports as PDF", async ({
  page,
  resetAndLogin,
}) => {
  await resetAndLogin("with-profile");
  await createSavedOutfitFromCapsule(page);

  const generateResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith("/outfits/outfit-e2e-1/report") &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Analyze" }).click();
  expect((await generateResponse).ok()).toBe(true);

  const report = page.getByTestId("outfit-report");
  await expect(report).toBeVisible();
  await expect(report.getByText("This outfit is ready to wear.")).toBeVisible();
  await report.getByRole("button", { name: "Show details" }).click();
  await expect(report.getByText("E2E mock report generated.")).toBeVisible();

  await page.reload();
  await expect(report).toBeVisible();
  await expect(report.getByText("This outfit is ready to wear.")).toBeVisible();

  await openOutfitMenu(page);
  const pdfResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith("/outfits/outfit-e2e-1/pdf") &&
      response.request().method() === "POST",
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
      response.url().endsWith("/outfits/outfit-e2e-1/report") &&
      response.request().method() === "POST",
  );
  await page.getByRole("menuitem", { name: "Regenerate report" }).click();
  expect((await regenerateResponse).ok()).toBe(true);
  await expect(report.getByText("This outfit is ready to wear.")).toBeVisible();

  await report.getByRole("button", { name: "Open report actions" }).click();
  const deleteResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith("/outfits/outfit-e2e-1/report") &&
      response.request().method() === "DELETE",
  );
  await page.getByRole("menuitem", { name: "Delete" }).click();
  expect((await deleteResponse).ok()).toBe(true);
  await expect(report).toHaveCount(0);
});
