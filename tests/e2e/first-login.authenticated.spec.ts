import { expect, test } from "./test";

test("authenticated user without a profile can open a new capsule without sign-in", async ({
  page,
  resetAndLogin,
}) => {
  await resetAndLogin("no-profile");

  await page.goto("/capsule");
  await expect(page).toHaveURL(/\/capsule\/capsule-e2e-2$/);

  await expect(
    page.getByRole("button", { name: "Regenerate all" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Rename capsule Playwright new capsule" }),
  ).toBeVisible();
  await expect(page.getByText("Capsules", { exact: true })).toBeVisible();
  await expect(
    page
      .getByTestId("sidebar-navigation-list")
      .getByRole("button", { name: "Personal items" }),
  ).toBeVisible();

  await page.reload();
  await expect(page).toHaveURL(/\/capsule\/capsule-e2e-2$/);

  await expect(
    page.getByRole("button", { name: "Regenerate all" }),
  ).toBeVisible();
  await expect(page.getByLabel("Email")).toBeHidden();
});
