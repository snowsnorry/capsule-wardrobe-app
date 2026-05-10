import { expect, test } from "./test";

test("authenticated user without a profile can complete onboarding", async ({
  page,
  resetAndLogin,
}) => {
  await resetAndLogin("no-profile");

  await page.goto("/");

  await page.getByRole("button", { name: "Casual" }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Office" }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Spring" }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Woman" }).click();
  await page.getByRole("button", { name: "Start" }).click();

  await expect(
    page.getByRole("button", { name: "Regenerate all" }),
  ).toBeVisible();
});
