import { expect, test } from "./test";

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
