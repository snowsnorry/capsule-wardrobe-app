import { expect, test } from "./test";
import type { Page } from "@playwright/test";

const originalCapsuleName = "Lifecycle original capsule";
const duplicateCapsuleName = "Lifecycle duplicate capsule";
const createdCapsuleName = "Lifecycle saved capsule";

async function openApp(page: Page) {
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto("/capsule/capsule-e2e");
  await expect(
    page.getByRole("button", { name: "Regenerate all" }),
  ).toBeVisible();
}

async function openCapsuleMenu(page: Page) {
  await page.getByRole("button", { name: "Open capsule menu" }).click();
}

async function renameActiveCapsule(page: Page, nextName: string) {
  await openCapsuleMenu(page);
  await page.getByRole("menuitem", { name: "Rename" }).click();
  const dialog = page.getByRole("dialog", { name: "Rename capsule" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("textbox", { name: "Rename capsule" }).fill(nextName);
  await dialog.getByRole("button", { name: "OK" }).click();
  await expect(
    page.getByRole("button", { name: `Rename capsule ${nextName}` }),
  ).toBeVisible();
}

async function saveActiveCapsule(page: Page) {
  await openCapsuleMenu(page);
  await page.getByRole("menuitem", { name: "Save" }).click();
  await expect(
    page.getByTestId("active-capsule-unsaved-indicator"),
  ).toHaveCount(0);
}

async function duplicateActiveCapsule(page: Page, nextName: string) {
  await openCapsuleMenu(page);
  await page.getByRole("menuitem", { name: "Save as..." }).click();
  const dialog = page.getByRole("dialog", { name: "Save as" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("textbox", { name: "Save as" }).fill(nextName);
  await dialog.getByRole("button", { name: "OK" }).click();
  await expect(
    page.getByRole("button", { name: `Rename capsule ${nextName}` }),
  ).toBeVisible();
}

async function deleteActiveCapsule(page: Page) {
  await openCapsuleMenu(page);
  await page.getByRole("menuitem", { name: "Delete" }).click();
  await expect(
    page.getByRole("dialog", { name: "Delete capsule" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Delete" }).click();
}

async function expectActiveCapsule(page: Page, name: string) {
  await expect(
    page.getByRole("button", { name: `Rename capsule ${name}` }),
  ).toBeVisible();
}

async function expectCreatedCapsuleReady(page: Page) {
  await expect(
    page.getByRole("button", {
      name: /^Rename capsule (?:<New capsule>|Playwright new capsule(?: \(\d+\))?)$/,
    }),
  ).toBeEnabled({ timeout: 20_000 });
  await expect(
    page.getByRole("button", { name: "Open capsule menu" }),
  ).toBeEnabled();
}

async function expectCapsuleListed(page: Page, name: string) {
  await expect(page.getByRole("button", { name, exact: true })).toBeVisible();
}

test("capsule create rename save and reload persistence works through the UI", async ({
  page,
  resetAndLogin,
}) => {
  await resetAndLogin("with-profile");
  await openApp(page);

  await page.getByRole("button", { name: "New capsule" }).click();
  await expectCreatedCapsuleReady(page);

  await renameActiveCapsule(page, createdCapsuleName);
  await saveActiveCapsule(page);

  await page.reload();

  await expectActiveCapsule(page, createdCapsuleName);
  await expectCapsuleListed(page, createdCapsuleName);
  await expect(
    page.getByRole("button", { name: "Regenerate all" }),
  ).toBeVisible();
});

test("capsule draft filter change can be reverted and stays reverted after reload", async ({
  page,
  resetAndLogin,
}) => {
  await resetAndLogin("with-profile");
  await openApp(page);

  await renameActiveCapsule(page, originalCapsuleName);
  await saveActiveCapsule(page);
  await expect(page.getByTestId("capsule-summary")).not.toContainText("Summer");

  await page.getByRole("button", { name: "Summer" }).click();
  await expect(page.getByRole("button", { name: "Apply" })).toBeEnabled();
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(
    page.getByTestId("active-capsule-unsaved-indicator"),
  ).toBeVisible();
  await expect(page.getByTestId("capsule-summary")).toContainText("Summer");

  await openCapsuleMenu(page);
  await page.getByRole("menuitem", { name: "Revert" }).click();
  await expect(
    page.getByRole("dialog", { name: "Revert changes" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Revert" }).click();

  await expect(
    page.getByTestId("active-capsule-unsaved-indicator"),
  ).toHaveCount(0);
  await expect(page.getByTestId("capsule-summary")).not.toContainText("Summer");
  await expect(
    page.getByRole("button", { name: "Navy relaxed shirt", exact: true }),
  ).toBeVisible();

  await page.reload();

  await expectActiveCapsule(page, originalCapsuleName);
  await expect(
    page.getByTestId("active-capsule-unsaved-indicator"),
  ).toHaveCount(0);
  await expect(page.getByTestId("capsule-summary")).not.toContainText("Summer");
});

test("capsule duplicate select delete fallback and reload persistence work through the UI", async ({
  page,
  resetAndLogin,
}) => {
  await resetAndLogin("with-profile");
  await openApp(page);

  await renameActiveCapsule(page, originalCapsuleName);
  await saveActiveCapsule(page);
  await duplicateActiveCapsule(page, duplicateCapsuleName);

  await expectCapsuleListed(page, originalCapsuleName);
  await expectCapsuleListed(page, duplicateCapsuleName);
  await expectActiveCapsule(page, duplicateCapsuleName);

  await page
    .getByRole("button", { name: originalCapsuleName, exact: true })
    .click();
  await expectActiveCapsule(page, originalCapsuleName);
  await page
    .getByRole("button", { name: duplicateCapsuleName, exact: true })
    .click();
  await expectActiveCapsule(page, duplicateCapsuleName);

  await deleteActiveCapsule(page);

  await expect(
    page.getByRole("button", { name: duplicateCapsuleName, exact: true }),
  ).toHaveCount(0);
  await expect(page).toHaveURL(/\/personal-items$/);
  await expectCapsuleListed(page, originalCapsuleName);
  await expect(
    page.getByRole("button", { name: `Rename capsule ${originalCapsuleName}` }),
  ).toHaveCount(0);

  await page.reload();

  await expect(
    page.getByRole("button", { name: duplicateCapsuleName, exact: true }),
  ).toHaveCount(0);
  await expectCapsuleListed(page, originalCapsuleName);
  await expect(
    page.getByRole("button", { name: `Rename capsule ${originalCapsuleName}` }),
  ).toHaveCount(0);
});
