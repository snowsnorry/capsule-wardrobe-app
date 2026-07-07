import { expect, test } from "./test";

const readyProducts = [
  "E2E Ready linen blazer",
  "E2E Ready tailored trousers",
  "E2E Ready almond loafers",
];
const originalProducts = [
  "Navy relaxed shirt",
  "Straight black trousers",
  "White leather sneakers",
];

test("wardrobe regeneration replaces old items and persists the ready state", async ({
  page,
  resetAndLogin,
}) => {
  await resetAndLogin("with-profile");

  await page.goto("/capsule/capsule-e2e");
  for (const productName of originalProducts) {
    await expect(
      page.getByRole("button", { name: productName, exact: true }),
    ).toBeVisible();
  }

  await page.getByRole("button", { name: "Regenerate all" }).click();
  await expect(
    page.getByRole("heading", { name: "Regenerate capsule?" }),
  ).toBeVisible();
  const regenerationResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith("/capsules/capsule-e2e/regenerate") &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Regenerate" }).click();
  await regenerationResponse;

  for (const productName of readyProducts) {
    await expect(
      page.getByRole("button", { name: productName, exact: true }),
    ).toBeVisible();
  }
  for (const productName of originalProducts) {
    await expect(
      page.getByRole("button", { name: productName, exact: true }),
    ).toHaveCount(0);
  }
  await expect(page.getByRole("progressbar")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Regenerate all" }),
  ).toBeEnabled();

  await page.reload();
  await expect(
    page.getByRole("button", { name: "Regenerate all" }),
  ).toBeVisible();
  for (const productName of readyProducts) {
    await expect(
      page.getByRole("button", { name: productName, exact: true }),
    ).toBeVisible();
  }
  for (const productName of originalProducts) {
    await expect(
      page.getByRole("button", { name: productName, exact: true }),
    ).toHaveCount(0);
  }
});
