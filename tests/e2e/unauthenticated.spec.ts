import { expect, test } from "./test";

test("unauthenticated user can sign in with mocked email code", async ({
  page,
}) => {
  const reset = await page
    .context()
    .request.post("/__e2e/reset", { data: { scenario: "no-profile" } });
  await expect(reset).toBeOK();

  await page.goto("/");

  await expect(
    page.getByText("Capsule Wardrobe", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Email").fill("playwright@example.test");
  await page.getByRole("button", { name: "Send code" }).click();
  await page.getByLabel("Email code").fill("654321");
  await page.getByRole("button", { name: "Verify" }).click();

  await expect(
    page.getByRole("button", { name: "Regenerate all" }),
  ).toBeVisible();
});

test("google sign-in UI keeps email code sign-in usable when provider script is blocked", async ({
  page,
}) => {
  const reset = await page
    .context()
    .request.post("/__e2e/reset", { data: { scenario: "no-profile" } });
  await expect(reset).toBeOK();

  const googleScriptFailed = page.waitForEvent("requestfailed", (request) => {
    return request.url() === "https://accounts.google.com/gsi/client";
  });

  await page.goto("/");

  await googleScriptFailed;
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByRole("button", { name: "Send code" })).toBeDisabled();

  await page.getByLabel("Email").fill("playwright@example.test");
  await expect(page.getByRole("button", { name: "Send code" })).toBeEnabled();
  await page.getByRole("button", { name: "Send code" }).click();
  await page.getByLabel("Email code").fill("654321");
  await page.getByRole("button", { name: "Verify" }).click();

  await expect(
    page.getByRole("button", { name: "Regenerate all" }),
  ).toBeVisible();
});
