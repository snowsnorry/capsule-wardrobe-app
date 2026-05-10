import { expect, test } from "./test";

test("authenticated app opens past the sign-in screen", async ({
  page,
  resetAndLogin,
}) => {
  await resetAndLogin("with-profile");

  await page.goto("/");

  await expect(
    page.getByRole("button", { name: "Regenerate all" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Playwright capsule", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Navy relaxed shirt", exact: true }),
  ).toBeVisible();
});

test("browser network guard blocks unexpected external requests", async ({
  page,
  resetAndLogin,
}) => {
  await resetAndLogin("with-profile");
  await page.goto("/");

  const result = await page.evaluate(async () => {
    try {
      await fetch("https://example.com/should-be-blocked");
      return "allowed";
    } catch {
      return "blocked";
    }
  });

  expect(result).toBe("blocked");
});
