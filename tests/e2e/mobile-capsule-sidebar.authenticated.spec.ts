import { expect, test } from "./test";
import type { Page } from "@playwright/test";

const originalCapsuleName = "Playwright capsule";
const duplicateCapsuleName = "Mobile drawer duplicate capsule";

async function openCapsuleRoute(
  page: Page,
  resetAndLogin: () => Promise<void>,
) {
  await page.setViewportSize({ width: 390, height: 844 });
  await resetAndLogin();
  await page.goto("/capsule/capsule-e2e");
  await page.getByText("Navy relaxed shirt").waitFor({ state: "visible" });
}

async function openCapsuleMenu(page: Page) {
  await page.getByRole("button", { name: "Open capsule menu" }).click();
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
  await dialog.getByRole("textbox", { name: "Save as" }).fill(nextName);
  await dialog.getByRole("button", { name: "OK" }).click();
  await expect(page.getByRole("heading", { name: nextName })).toBeVisible();
}

test("mobile capsule switch closes the sidebar while capsule data is loading", async ({
  page,
  resetAndLogin,
}) => {
  await openCapsuleRoute(page, () => resetAndLogin("with-profile"));
  await saveActiveCapsule(page);
  await duplicateActiveCapsule(page, duplicateCapsuleName);

  let releaseCapsuleFetch: () => void = () => {};
  const capsuleFetchGate = new Promise<void>((resolve) => {
    releaseCapsuleFetch = resolve;
  });
  let delayedCapsuleFetch = false;

  await page.route("**/capsules/capsule-e2e", async (route) => {
    const requestUrl = new URL(route.request().url());
    if (
      !delayedCapsuleFetch &&
      route.request().method() === "GET" &&
      requestUrl.pathname.endsWith("/capsules/capsule-e2e")
    ) {
      delayedCapsuleFetch = true;
      await capsuleFetchGate;
    }
    await route.continue();
  });

  await page.getByRole("button", { name: "Toggle sidebar" }).click();
  const drawerPaper = page.locator(".MuiDrawer-root .MuiDrawer-paper");
  await expect(drawerPaper).toBeVisible();

  await page
    .locator(".MuiDrawer-root")
    .getByRole("button", { name: originalCapsuleName, exact: true })
    .click();

  await expect.poll(() => delayedCapsuleFetch).toBe(true);
  await expect(page).toHaveURL(/\/capsule\/capsule-e2e$/);
  await expect(drawerPaper).toBeHidden();
  await expect(page.getByRole("progressbar")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Toggle sidebar" }),
  ).toBeDisabled();

  releaseCapsuleFetch();

  await expect(
    page.getByRole("heading", { name: originalCapsuleName }),
  ).toBeVisible();
  await expect(page.getByRole("progressbar")).toHaveCount(0);
});
