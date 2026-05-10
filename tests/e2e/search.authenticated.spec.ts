import { expect, test } from "./test";

test("search screen runs against mocked search data", async ({
  page,
  resetAndLogin,
}) => {
  await resetAndLogin("with-profile");

  await page.goto("/explore");
  await page
    .getByPlaceholder(/Search in natural language/)
    .fill("navy office shirt");
  await page.keyboard.press("Enter");

  await expect(page.getByText("3 results")).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Navy relaxed shirt E2E Studio/ }),
  ).toBeVisible();
});
