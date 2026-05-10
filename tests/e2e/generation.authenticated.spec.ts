import { expect, test } from "./test";

test("wardrobe regeneration uses mocked server response", async ({
  page,
  resetAndLogin,
}) => {
  await resetAndLogin("with-profile");

  await page.goto("/");
  await page.getByRole("button", { name: "Regenerate all" }).click();
  await expect(
    page.getByRole("heading", { name: "Regenerate capsule?" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Regenerate" }).click();

  await expect(
    page.getByRole("link", { name: "Navy relaxed shirt", exact: true }),
  ).toBeVisible();
});
