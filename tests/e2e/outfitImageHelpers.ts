import type { Locator, Page } from "@playwright/test";
import { expect } from "./test";

const EXPECTED_GLOBAL_EXTERNAL_HOSTS = new Set(["fonts.googleapis.com"]);

function isAllowedE2eUrl(rawUrl: string, baseURL: string | undefined): boolean {
  const url = new URL(rawUrl);
  if (!["http:", "https:"].includes(url.protocol)) {
    return true;
  }

  const base = new URL(baseURL || "http://127.0.0.1:5310");
  return (
    url.origin === base.origin ||
    ["127.0.0.1", "localhost", "::1"].includes(url.hostname)
  );
}

export function collectUnexpectedExternalRequests(
  page: Page,
  baseURL: string | undefined,
): string[] {
  const unexpectedExternalRequests: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (
      !isAllowedE2eUrl(request.url(), baseURL) &&
      !EXPECTED_GLOBAL_EXTERNAL_HOSTS.has(url.hostname)
    ) {
      unexpectedExternalRequests.push(request.url());
    }
  });
  return unexpectedExternalRequests;
}

export async function openCapsuleOutfitSet(page: Page) {
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto("/capsule/capsule-e2e");
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

export async function expectOutfitImage(page: Page, sourcePattern: RegExp) {
  const image = page.getByTestId("outfit-set-image");
  await expectImageLoaded(image);
  await expect(image).toHaveAttribute("src", sourcePattern);
  return image;
}

export async function expectOutfitImageEmpty(page: Page) {
  await expect(page.getByTestId("outfit-set-image")).toHaveCount(0);
  await expect(page.getByTestId("outfit-set-image-placeholder")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Create image" }),
  ).toBeVisible();
}
