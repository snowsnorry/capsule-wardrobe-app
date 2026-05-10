import { expect, test } from "./test";

test("unauthenticated user can sign in with mocked email code", async ({
  page,
}) => {
  const reset = await page
    .context()
    .request.post("/__e2e/reset", { data: { scenario: "no-profile" } });
  await expect(reset).toBeOK();

  await page.goto("/");

  await expect(page.getByText("Capsule Wardrobe")).toBeVisible();
  await page.getByLabel("Email").fill("playwright@example.test");
  await page.getByRole("button", { name: "Send code" }).click();
  await page.getByLabel("Email code").fill("654321");
  await page.getByRole("button", { name: "Verify" }).click();

  await expect(page.getByRole("button", { name: "Next" })).toBeVisible();
});
