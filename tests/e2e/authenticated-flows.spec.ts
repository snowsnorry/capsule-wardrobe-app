import { expect, test } from "./test";
import type { Page } from "@playwright/test";

type ResetAndLogin = (
  scenario?: "with-profile" | "no-profile",
) => Promise<void>;

async function resetAndLoginFresh(
  page: Page,
  resetAndLogin: ResetAndLogin,
  path = "/",
) {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
  await resetAndLogin("with-profile");
  await page.goto(path);
}

async function expectSignedInCapsule(page: Page) {
  await expect(
    page.getByRole("button", { name: "Regenerate all" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Playwright capsule", exact: true }),
  ).toBeVisible();
}

async function expectCapsuleRouteLoaded(page: Page) {
  await expect(
    page.getByRole("button", { name: "Regenerate all" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Navy relaxed shirt", exact: true }),
  ).toBeVisible();
}

async function expectSignInScreen(page: Page) {
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByRole("button", { name: "Send code" })).toBeVisible();
}

async function focusByKeyboard(
  page: Page,
  locator: ReturnType<Page["locator"]>,
) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (
      await locator.evaluate((element) => element === document.activeElement)
    ) {
      return;
    }
    await page.keyboard.press("Tab");
  }
  await expect(locator).toBeFocused();
}

test("authenticated direct routes restore after reload", async ({
  page,
  resetAndLogin,
}) => {
  await resetAndLoginFresh(page, resetAndLogin, "/explore");

  await expect(page).toHaveURL(/\/explore$/);
  await expect(
    page.getByPlaceholder(/Search in natural language/),
  ).toBeVisible();
  await expect(page.getByLabel("Email")).toBeHidden();

  await page.reload();

  await expect(page).toHaveURL(/\/explore$/);
  await expect(
    page.getByPlaceholder(/Search in natural language/),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Capsule" })).toBeVisible();

  await page.goto("/statistics");
  await expect(
    page.getByText("No data available for the current filters."),
  ).toBeVisible();

  await page.reload();

  await expect(page).toHaveURL(/\/statistics$/);
  await expect(
    page.getByText("No data available for the current filters."),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Catalog" })).toBeVisible();
  await expect(page.getByLabel("Email")).toBeHidden();
});

test("sign out clears session and cached authenticated UI", async ({
  page,
  resetAndLogin,
}) => {
  await resetAndLoginFresh(page, resetAndLogin, "/explore");
  await expect(
    page.getByPlaceholder(/Search in natural language/),
  ).toBeVisible();

  await page.getByRole("button", { name: "Open user menu" }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  const dialog = page.getByRole("dialog", { name: "Sign out" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Sign out" }).click();

  await expectSignInScreen(page);
  await expect(page.getByRole("button", { name: "Catalog" })).toBeHidden();

  await page.reload();
  await expectSignInScreen(page);

  await page.goto("/explore");
  await expectSignInScreen(page);
  await expect(
    page.getByRole("button", { name: "Regenerate all" }),
  ).toBeHidden();
});

test("settings account removal requires confirmation and signs the user out", async ({
  page,
  resetAndLogin,
}) => {
  await resetAndLoginFresh(page, resetAndLogin);
  await expectSignedInCapsule(page);

  await page.getByRole("button", { name: "Open user menu" }).click();
  await page.getByRole("menuitem", { name: "Settings" }).click();
  const settingsDialog = page.getByRole("dialog", { name: "Settings" });
  await settingsDialog.getByRole("button", { name: "Account" }).click();
  await settingsDialog.getByRole("button", { name: "Remove account" }).click();

  const removeDialog = page.getByRole("dialog", { name: "Remove account" });
  await expect(removeDialog).toBeVisible();
  const removeButton = removeDialog.getByRole("button", { name: "Remove" });
  await expect(removeButton).toBeDisabled();
  await removeDialog
    .getByRole("textbox", { name: "Confirmation word" })
    .fill("wrong");
  await expect(removeButton).toBeDisabled();
  await removeDialog.getByRole("button", { name: "Copy word" }).click();
  await removeDialog
    .getByRole("textbox", { name: "Confirmation word" })
    .fill("delete");
  await expect(removeButton).toBeEnabled();
  await removeButton.click();

  await expectSignInScreen(page);
  await page.reload();
  await expectSignInScreen(page);
  await page.goto("/explore");
  await expectSignInScreen(page);
});

test("settings save persists profile and locale across reload", async ({
  page,
  resetAndLogin,
}) => {
  await resetAndLoginFresh(page, resetAndLogin);
  await expectSignedInCapsule(page);

  await page.getByRole("button", { name: "Open user menu" }).click();
  await page.getByRole("menuitem", { name: "Settings" }).click();

  const settingsDialog = page.getByRole("dialog", { name: "Settings" });
  await expect(settingsDialog).toBeVisible();
  await settingsDialog.getByRole("combobox", { name: "Language" }).click();
  await page.getByRole("option", { name: "Russian" }).click();
  await settingsDialog.getByRole("button", { name: "Account" }).click();
  await settingsDialog.getByLabel("Name").fill("E2E Phase One User");
  await expect(
    settingsDialog.getByRole("button", { name: "Save" }),
  ).toBeEnabled();
  await settingsDialog.getByRole("button", { name: "Save" }).click();

  await expect(settingsDialog).toBeHidden();
  await expect(
    page.getByRole("button", { name: "Капсула", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Каталог", exact: true }),
  ).toBeVisible();

  await page.reload();

  await expect(
    page.getByRole("button", { name: "Капсула", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Email")).toBeHidden();

  await page.getByRole("button", { name: "Open user menu" }).click();
  await page.getByRole("menuitem", { name: "Настройки" }).click();
  const reloadedSettingsDialog = page.getByRole("dialog", {
    name: "Настройки",
  });
  await reloadedSettingsDialog.getByRole("button", { name: "Аккаунт" }).click();
  await expect(reloadedSettingsDialog.getByLabel("Имя")).toHaveValue(
    "E2E Phase One User",
  );
});

test("PDF export creates a browser download with the server filename", async ({
  page,
  resetAndLogin,
}) => {
  await resetAndLoginFresh(page, resetAndLogin);
  await expectSignedInCapsule(page);

  await page.getByRole("button", { name: "Open capsule menu" }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("menuitem", { name: "Export as PDF" }).click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toBe("Playwright capsule.pdf");
  const downloadPath = await download.path();
  expect(downloadPath).toBeTruthy();
  if (!downloadPath) {
    throw new Error("download_path_missing");
  }
  const stream = await download.createReadStream();
  expect(stream).not.toBeNull();
  let downloadedBytes = 0;
  if (stream) {
    for await (const chunk of stream) {
      downloadedBytes += Buffer.byteLength(chunk);
    }
  }
  expect(downloadedBytes).toBeGreaterThan(0);
  await expect(
    page.getByRole("button", { name: "Regenerate all" }),
  ).toBeEnabled();
});

test("mobile shell supports drawer navigation, filters, and product detail", async ({
  page,
  resetAndLogin,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await resetAndLoginFresh(page, resetAndLogin);
  await expectCapsuleRouteLoaded(page);

  await page.getByRole("button", { name: "Toggle sidebar" }).click();
  await page.getByRole("button", { name: "Catalog" }).click();

  await expect(page).toHaveURL(/\/explore$/);
  await page
    .getByPlaceholder(/Search in natural language/)
    .fill("navy office shirt");
  await page.keyboard.press("Enter");
  await expect(page.getByText("3 results")).toBeVisible();

  await page.getByRole("button", { name: "Open filters" }).click();
  await expect(page.getByRole("heading", { name: "Filters" })).toBeVisible();
  await page.getByRole("button", { name: "Close filters" }).click();
  await expect(page.getByRole("heading", { name: "Filters" })).toBeHidden();

  await page
    .getByRole("button", { name: /Navy relaxed shirt E2E Studio/ })
    .click();
  await expect(page.getByRole("button", { name: "Back" })).toBeVisible();
  await expect(
    page.getByText("A deterministic e2e shirt fixture."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Back" }).click();
  await expect(page.getByText("3 results")).toBeVisible();

  await page.getByRole("button", { name: "Toggle sidebar" }).click();
  await page.getByRole("button", { name: "Capsule" }).click();

  await expect(page).toHaveURL(/\/$/);
  await expectCapsuleRouteLoaded(page);
});

test("desktop sidebar collapse and mobile card layout preferences persist", async ({
  page,
  resetAndLogin,
}) => {
  await resetAndLogin("with-profile");
  await page.goto("/");
  await page.evaluate(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
  await page.reload();
  await expectCapsuleRouteLoaded(page);

  await page.getByRole("button", { name: "Collapse sidebar" }).click();
  await expect(
    page.getByRole("button", { name: "Toggle sidebar" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Collapse sidebar" }),
  ).toBeHidden();
  await expect(
    page.evaluate(() =>
      window.localStorage.getItem("capsule.appSidebarCollapsed"),
    ),
  ).resolves.toBe("true");

  await page.reload();

  await expect(
    page.getByRole("button", { name: "Toggle sidebar" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Collapse sidebar" }),
  ).toBeHidden();
  await expectCapsuleRouteLoaded(page);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("button", { name: "Open capsule menu" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Open capsule menu" }).click();
  await page.getByRole("button", { name: "1 column" }).click();

  await expect(
    page.evaluate(() =>
      window.localStorage.getItem("capsule.mobileCardColumns"),
    ),
  ).resolves.toBe("1");

  await page.reload();

  await expect(
    page.evaluate(() =>
      window.localStorage.getItem("capsule.mobileCardColumns"),
    ),
  ).resolves.toBe("1");
  await expectCapsuleRouteLoaded(page);
});

test("keyboard focus supports critical dialogs and menus", async ({
  page,
  resetAndLogin,
}) => {
  await resetAndLoginFresh(page, resetAndLogin);
  await expectCapsuleRouteLoaded(page);

  const capsuleMenuButton = page.getByRole("button", {
    name: "Open capsule menu",
  });
  await focusByKeyboard(page, capsuleMenuButton);
  await page.keyboard.press("Enter");
  await page.getByRole("menuitem", { name: "Rename" }).press("Enter");

  const renameDialog = page.getByRole("dialog", { name: "Rename capsule" });
  await expect(renameDialog).toBeVisible();
  await expect(renameDialog.getByLabel("Rename capsule")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(renameDialog).toBeHidden();
  await expect(
    page.getByRole("button", { name: "Open capsule menu" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Catalog" }).click();
  await page
    .getByPlaceholder(/Search in natural language/)
    .fill("navy office shirt");
  await page.keyboard.press("Enter");
  await expect(page.getByText("3 results")).toBeVisible();

  const searchResult = page.getByRole("button", {
    name: /Navy relaxed shirt E2E Studio/,
  });
  await searchResult.focus();
  await expect(searchResult).toBeFocused();
  await page.keyboard.press("Enter");

  await expect(
    page.getByRole("link", { name: /Navy relaxed shirt/ }),
  ).toBeVisible();
});
