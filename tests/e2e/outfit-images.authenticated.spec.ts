import type { Locator, Page } from "@playwright/test";
import { expect, test } from "./test";

function isLocalRequest(rawUrl: string) {
  const url = new URL(rawUrl);
  return (
    !["http:", "https:"].includes(url.protocol) ||
    ["127.0.0.1", "localhost", "::1"].includes(url.hostname)
  );
}

function isKnownBaselineExternalRequest(rawUrl: string) {
  return rawUrl.startsWith(
    "https://fonts.googleapis.com/css2?family=Leckerli+One&display=swap",
  );
}

async function openApp(page: Page) {
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Regenerate all" }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Outfit 1" }).click();
}

async function expectImageLoaded(image: Locator) {
  await expect(image).toBeVisible();
  await expect
    .poll(() =>
      image.evaluate((element) => {
        const img = element as HTMLImageElement;
        return img.complete && img.naturalWidth > 0 && img.naturalHeight > 0;
      }),
    )
    .toBe(true);
}

async function expectOutfitImage(page: Page, sourcePattern: RegExp) {
  const image = page.getByTestId("outfit-set-image");
  await expectImageLoaded(image);
  await expect(image).toHaveAttribute("src", sourcePattern);
  return image;
}

async function expectOutfitImageEmpty(page: Page) {
  await expect(page.getByTestId("outfit-set-image")).toHaveCount(0);
  await expect(page.getByTestId("outfit-set-image-placeholder")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Create image" }),
  ).toBeVisible();
}

test("outfit set image preview delete generate and reload persistence works through the UI", async ({
  page,
  resetAndLogin,
}) => {
  const unexpectedExternalRequests: string[] = [];
  page.on("request", (request) => {
    if (
      !isLocalRequest(request.url()) &&
      !isKnownBaselineExternalRequest(request.url())
    ) {
      unexpectedExternalRequests.push(request.url());
    }
  });

  await resetAndLogin("with-profile");
  await openApp(page);

  await expectOutfitImage(page, /\/__e2e\/images\/outfit-set\.svg$/);

  await page
    .getByRole("button", { name: "Open outfit 1 image preview" })
    .click();
  await expect(page.getByTestId("outfit-set-image-dialog")).toBeVisible();
  await expect(
    page.getByTestId("outfit-set-image-dialog").getByRole("img", {
      name: "Outfit set 1",
    }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Close" }).click();
  await expect(page.getByTestId("outfit-set-image-dialog")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Regenerate all" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Delete image" }).click();
  const deleteDialog = page.getByRole("dialog").filter({
    has: page.getByRole("heading", { name: "Delete image" }),
  });
  await expect(deleteDialog).toBeVisible();
  await deleteDialog.getByRole("button", { name: "Delete" }).click();
  await expectOutfitImageEmpty(page);

  await page.reload();
  await expect(
    page.getByRole("button", { name: "Regenerate all" }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Outfit 1" }).click();
  await expectOutfitImageEmpty(page);

  await page.getByRole("button", { name: "Create image" }).click();
  await expectOutfitImage(
    page,
    /\/__e2e\/images\/generated-outfit-set-capsule-e2e-0-1\.svg$/,
  );

  await page.reload();
  await expect(
    page.getByRole("button", { name: "Regenerate all" }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Outfit 1" }).click();
  await expectOutfitImage(
    page,
    /\/__e2e\/images\/generated-outfit-set-capsule-e2e-0-1\.svg$/,
  );

  expect(unexpectedExternalRequests).toEqual([]);
});
