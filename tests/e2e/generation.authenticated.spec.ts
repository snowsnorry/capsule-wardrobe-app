import { expect, test } from "./test";

const readyProducts = [
  "E2E Ready linen blazer",
  "E2E Ready tailored trousers",
  "E2E Ready almond loafers",
];

test("wardrobe regeneration uses mocked server response", async ({
  page,
  resetAndLogin,
}) => {
  await resetAndLogin("with-profile");

  await page.goto("/capsule/capsule-e2e");
  await page.getByRole("button", { name: "Regenerate all" }).click();
  await expect(
    page.getByRole("heading", { name: "Regenerate capsule?" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Regenerate" }).click();

  for (const productName of readyProducts) {
    await expect(
      page.getByRole("button", { name: productName, exact: true }),
    ).toBeVisible();
  }
});
