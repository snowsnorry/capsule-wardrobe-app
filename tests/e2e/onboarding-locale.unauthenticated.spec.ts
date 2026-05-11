import { expect, test } from "./test";

const E2E_CODE = "654321";

test("unauthenticated locale choice carries into onboarding and profile creation", async ({
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
  await expect(page.getByLabel("Эл. почта")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Отправить код" }),
  ).toBeVisible();

  await page.getByLabel("Эл. почта").fill("playwright@example.test");
  await page.getByRole("button", { name: "Отправить код" }).click();
  await page.getByLabel("Код из письма").fill(E2E_CODE);
  await page.getByRole("button", { name: "Подтвердить" }).click();

  await expect(page.getByText("Шаг 1 · Стилевые предпочтения")).toBeVisible();
  await page.getByRole("button", { name: "Повседневный" }).click();
  await page.getByRole("button", { name: "Минималистичный" }).click();
  await page.getByRole("button", { name: "Далее" }).click();

  await expect(page.getByText("Шаг 2 · Потребности гардероба")).toBeVisible();
  await page.getByRole("button", { name: "Офис" }).click();
  await page.getByRole("button", { name: "Далее" }).click();

  await expect(page.getByText("Шаг 3 · Сезоны")).toBeVisible();
  await page.getByRole("button", { name: "Весна" }).click();
  await page.getByRole("button", { name: "Далее" }).click();

  await expect(page.getByText("Шаг 4 · Для кого")).toBeVisible();
  await page.getByRole("button", { name: "Женщина" }).click();
  await page.getByRole("button", { name: "Начать" }).click();

  await expect(
    page.getByRole("button", { name: "Обновить все" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Капсула", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Поиск", exact: true }),
  ).toBeVisible();

  await page.reload();

  await expect(
    page.getByRole("button", { name: "Капсула", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Поиск", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Эл. почта")).toBeHidden();
});
