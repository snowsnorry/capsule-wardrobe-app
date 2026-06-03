import { expect, test } from "./test";
import type { Page } from "@playwright/test";

const primaryScrollTargetSelector = '[data-app-primary-scroll-target="true"]';

async function openCapsuleRoute(
  page: Page,
  resetAndLogin: () => Promise<void>,
) {
  await resetAndLogin();
  await page.goto("/");
  await page.getByText("Navy relaxed shirt").waitFor({ state: "visible" });
}

async function saveActiveCapsule(page: Page) {
  await page.getByRole("button", { name: "Open capsule menu" }).click();
  await page.getByRole("menuitem", { name: "Save" }).click();
  await expect(
    page.getByTestId("active-capsule-unsaved-indicator"),
  ).toHaveCount(0);
}

async function duplicateActiveCapsule(page: Page, name: string) {
  await page.getByRole("button", { name: "Open capsule menu" }).click();
  await page.getByRole("menuitem", { name: "Save as..." }).click();

  const dialog = page.getByRole("dialog", { name: "Save as" });
  await dialog.getByRole("textbox", { name: "Save as" }).fill(name);
  await dialog.getByRole("button", { name: "OK" }).click();
  await expect(
    page.getByRole("button", { name: `Rename capsule ${name}` }),
  ).toBeVisible();
}

async function expectWheelScrollsPrimaryTarget(
  page: Page,
  point: { x: number; y: number },
) {
  const scrollTarget = page.locator(primaryScrollTargetSelector);
  const initialScrollTop = await scrollTarget.evaluate((element) =>
    element instanceof HTMLElement ? element.scrollTop : 0,
  );

  await page.mouse.move(point.x, point.y);
  await page.mouse.wheel(0, 500);

  await expect
    .poll(() =>
      scrollTarget.evaluate((element) =>
        element instanceof HTMLElement ? element.scrollTop : 0,
      ),
    )
    .toBeGreaterThan(initialScrollTop);
}

async function openMobileLongPressMenu(page: Page, cardName: string) {
  const card = page.getByRole("button", {
    name: cardName,
    exact: true,
  });
  const cardBox = await card.boundingBox();
  expect(cardBox).not.toBeNull();
  const point = {
    x: Math.floor((cardBox?.x ?? 0) + (cardBox?.width ?? 0) / 2),
    y: Math.floor((cardBox?.y ?? 0) + (cardBox?.height ?? 0) / 2),
  };

  await card.dispatchEvent("pointerdown", {
    bubbles: true,
    button: 0,
    buttons: 1,
    cancelable: true,
    clientX: point.x,
    clientY: point.y,
    pointerId: 77,
    pointerType: "touch",
  });
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();

  return { dialog, point };
}

async function expectNativeContextMenuSuppressed(page: Page) {
  const previewImage = page.getByRole("dialog").locator("img").first();
  await expect(previewImage).toBeVisible();
  await expect(
    previewImage.evaluate((image) => {
      const event = new MouseEvent("contextmenu", {
        bubbles: true,
        cancelable: true,
        button: 2,
      });
      image.dispatchEvent(event);
      return event.defaultPrevented;
    }),
  ).resolves.toBe(true);
}

async function expectOverlayScrollLockCleared(page: Page) {
  await expect(page.locator(".MuiModal-root")).toHaveCount(0);
  await expect
    .poll(() =>
      page.evaluate(() => ({
        overflow: document.body.style.overflow,
        paddingRight: document.body.style.paddingRight,
      })),
    )
    .toEqual({ overflow: "", paddingRight: "" });
}

test.describe("mouse wheel scrolling", () => {
  test("scrolls the active capsule when the wheel starts over desktop sidebar after switching capsules", async ({
    page,
    resetAndLogin,
  }) => {
    await page.setViewportSize({ width: 1440, height: 960 });
    await openCapsuleRoute(page, () => resetAndLogin("with-profile"));
    await saveActiveCapsule(page);
    await duplicateActiveCapsule(page, "Wheel duplicate capsule");
    await page.setViewportSize({ width: 1440, height: 520 });

    const originalCapsuleRow = page.getByRole("button", {
      name: "Playwright capsule",
      exact: true,
    });
    const rowBox = await originalCapsuleRow.boundingBox();
    expect(rowBox).not.toBeNull();
    await originalCapsuleRow.click();
    await expect(
      page.getByRole("button", { name: "Rename capsule Playwright capsule" }),
    ).toBeVisible();

    await expectWheelScrollsPrimaryTarget(page, {
      x: Math.floor((rowBox?.x ?? 0) + (rowBox?.width ?? 0) / 2),
      y: Math.floor((rowBox?.y ?? 0) + (rowBox?.height ?? 0) / 2),
    });
  });

  test("scrolls the active capsule after closing a mobile long-press menu", async ({
    page,
    resetAndLogin,
  }) => {
    await page.setViewportSize({ width: 390, height: 640 });
    await openCapsuleRoute(page, () => resetAndLogin("with-profile"));

    const { point } = await openMobileLongPressMenu(page, "Navy relaxed shirt");
    await page.keyboard.press("Escape");
    await expectOverlayScrollLockCleared(page);

    await expectWheelScrollsPrimaryTarget(page, point);
  });

  test("suppresses native image context menu before closing the mobile long-press menu", async ({
    page,
    resetAndLogin,
  }) => {
    await page.setViewportSize({ width: 390, height: 640 });
    await openCapsuleRoute(page, () => resetAndLogin("with-profile"));

    const { point } = await openMobileLongPressMenu(page, "Navy relaxed shirt");
    await expectNativeContextMenuSuppressed(page);
    await page.mouse.click(8, 8);
    await expectOverlayScrollLockCleared(page);

    await expectWheelScrollsPrimaryTarget(page, point);
  });
});
