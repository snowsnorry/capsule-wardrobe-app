import { expect, test } from "./test";

test("authenticated user without a profile lands on a new capsule", async ({
  page,
  resetAndLogin,
}) => {
  await resetAndLogin("no-profile");

  await page.goto("/capsule");

  await expect(
    page.getByRole("button", { name: "Regenerate all" }),
  ).toBeVisible();
  await expect(page.getByText("Step 1")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Rename capsule Playwright new capsule" }),
  ).toBeVisible();
});
