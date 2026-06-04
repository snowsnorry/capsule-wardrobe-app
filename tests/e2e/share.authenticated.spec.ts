import type { Page } from "@playwright/test";
import { expect, test } from "./test";

const sharedCapsuleName = "Shared Capsule E2E";
const importedCapsuleName = `${sharedCapsuleName} (1)`;
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
  await expectActiveCapsule(page, nextName);
}

async function expectActiveCapsule(page: Page, name: string) {
  await expect(
    page.getByRole("button", { name: `Rename capsule ${name}` }),
  ).toBeVisible();
}

async function expectCapsuleListed(page: Page, name: string) {
  await expect(page.getByRole("button", { name, exact: true })).toBeVisible();
}

test("share link copies to clipboard and import route activates the shared capsule", async ({
  baseURL,
  context,
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

  await context.grantPermissions(["clipboard-read", "clipboard-write"], {
    origin: baseURL,
  });
  await resetAndLogin("with-profile");
  await openApp(page);

  await renameActiveCapsule(page, sharedCapsuleName);

  await openCapsuleMenu(page);
  await page.getByRole("menuitem", { name: "Share" }).click();

  const shareDialog = page.getByRole("dialog", { name: "Share capsule" });
  await expect(shareDialog).toBeVisible();
  await expect(
    shareDialog.getByText("Your share link is ready."),
  ).toBeVisible();
  await expect(
    shareDialog.getByRole("link", { name: sharedCapsuleName }),
  ).toHaveAttribute("href", /\/share\/e2e-share-/);

  await shareDialog.getByRole("button", { name: "Copy share link" }).click();
  const copiedShareUrl = await page.evaluate(() =>
    navigator.clipboard.readText(),
  );
  const copiedUrl = new URL(copiedShareUrl);
  const baseUrl = new URL(baseURL || "http://127.0.0.1:5310");
  expect(copiedUrl.origin).toBe(baseUrl.origin);
  expect(copiedUrl.pathname).toMatch(/^\/share\/e2e-share-\d+$/);

  await page.goto(copiedShareUrl);

  const importDialog = page.getByRole("dialog", {
    name: "Save shared capsule?",
  });
  await expect(importDialog).toBeVisible();
  await expect(importDialog).toContainText(
    `Save capsule "${sharedCapsuleName}" to your capsules?`,
  );
  await importDialog.getByRole("button", { name: "Save capsule" }).click();

  await expect(page).toHaveURL(/\/capsule\/.+$/);
  await expect(importDialog).toHaveCount(0);
  await expectActiveCapsule(page, importedCapsuleName);
  await expectCapsuleListed(page, importedCapsuleName);
  await expectCapsuleListed(page, sharedCapsuleName);

  await page.reload();

  await expectActiveCapsule(page, importedCapsuleName);
  await expectCapsuleListed(page, importedCapsuleName);
  expect(externalRequests).toEqual([]);
});
