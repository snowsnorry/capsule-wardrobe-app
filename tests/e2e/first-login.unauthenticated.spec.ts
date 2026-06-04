import { expect, test } from "./test";

const E2E_CODE = "654321";

test("first login keeps the selected Russian locale and opens the app", async ({
  page,
}) => {
  const reset = await page
    .context()
    .request.post("/__e2e/reset", { data: { scenario: "no-profile" } });
  await expect(reset).toBeOK();
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  await page.goto("/");

  await page.getByRole("button", { name: "Language" }).click();
  await page.getByRole("menuitem", { name: "🇷🇺 Russian" }).click();
  await expect(page.getByRole("button", { name: "Язык" })).toBeVisible();

  await page.getByLabel("Эл. почта").fill("playwright@example.test");
  await page.getByRole("button", { name: "Отправить код" }).click();
  await page.getByLabel("Код из письма").fill(E2E_CODE);
  await page.getByRole("button", { name: "Подтвердить" }).click();

  await expect(
    page.getByRole("button", { name: "Обновить все" }),
  ).toBeVisible();
  await expect(page.getByText("Шаг 1")).toHaveCount(0);
  await expect(page.getByText("Капсулы", { exact: true })).toBeVisible();
  await expect(page.getByText("Каталог", { exact: true })).toBeVisible();

  await page.reload();

  await expect(page.getByText("Капсулы", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Эл. почта")).toBeHidden();
});
