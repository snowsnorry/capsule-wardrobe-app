import { expect, test } from "./test";
import {
  collectUnexpectedExternalRequests,
  expectOutfitImage,
  expectOutfitImageEmpty,
  openCapsuleOutfitSet,
} from "./outfitImageHelpers";

test("capsule outfit set image preview delete generate and reload persistence works through the UI", async ({
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
