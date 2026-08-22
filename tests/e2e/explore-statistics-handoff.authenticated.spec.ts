import { expect, test } from "./test";
import type { Page } from "@playwright/test";

type ResetAndLogin = (
  scenario?:
    | "with-profile"
    | "no-profile"
    | "with-saved-search"
    | "with-non-empty-stats",
) => Promise<void>;

async function resetAndLoginFresh(
  page: Page,
  resetAndLogin: ResetAndLogin,
  scenario: "with-profile" | "with-saved-search" | "with-non-empty-stats",
  path = "/capsule/capsule-e2e",
) {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
  await resetAndLogin(scenario);
  await page.goto(path);
}

async function deleteActiveChip(page: Page, field: string) {
  const chip = page.getByTestId(`active-filter-chip-${field}`);
  await expect(chip).toBeVisible();
  await chip.focus();
  await page.keyboard.press("Delete");
}

test("search hydrates saved filters, applies filters, and opens product detail", async ({
  page,
  resetAndLogin,
}) => {
  await resetAndLoginFresh(
    page,
    resetAndLogin,
    "with-saved-search",
    "/explore",
  );

  await expect(page).toHaveURL(/\/explore$/);
  await expect(page.getByPlaceholder(/Search in natural language/)).toHaveValue(
    "saved navy office",
  );
  await expect(page.getByText("Category: Top")).toBeVisible();
  await expect(page.getByText("Accent color: Navy")).toBeVisible();
  await expect(page.getByText("1 results")).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Navy relaxed shirt E2E Studio/ }),
  ).toBeVisible();

  await page
    .getByPlaceholder(/Search in natural language/)
    .fill("navy office layer");
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("button", { name: /Navy relaxed shirt E2E Studio/ }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Sporty" }).click();
  await expect(page.getByText("Style: Sporty")).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Sporty navy overshirt E2E Studio/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Navy relaxed shirt E2E Studio/ }),
  ).toBeHidden();

  await page
    .getByRole("button", { name: /Sporty navy overshirt E2E Studio/ })
    .click();
  await expect(
    page.getByRole("link", { name: /Sporty navy overshirt/ }),
  ).toBeVisible();
  await expect(page.getByText("E2E Studio").last()).toBeVisible();
  await expect(page.getByText("Top", { exact: true }).last()).toBeVisible();
  await expect(
    page.getByText("A deterministic filtered e2e overshirt fixture."),
  ).toBeVisible();
  await expect(
    page.getByRole("img", { name: "Sporty navy overshirt" }),
  ).toHaveAttribute("src", /\/__e2e\/images\/sporty-navy-overshirt\.svg$/);

  await deleteActiveChip(page, "style");
  await expect(page.getByText("Style: Sporty")).toBeHidden();
  await expect(
    page.getByRole("button", { name: /Navy relaxed shirt E2E Studio/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Sporty navy overshirt E2E Studio/ }),
  ).toBeHidden();
});

test("Explore applies, persists, and clears the exact color filter", async ({
  page,
  resetAndLogin,
}) => {
  await resetAndLoginFresh(page, resetAndLogin, "with-profile", "/explore");

  const toggle = page.getByRole("switch", { name: "Enable color matching" });
  await expect(toggle).not.toBeChecked();
  await toggle.check();
  const exactColorInput = page.getByLabel("HEX color");
  const exactColorField = exactColorInput.locator("..");
  const colorSwatch = exactColorField.locator("[data-color-swatch]");
  const [fieldBox, swatchBox] = await Promise.all([
    exactColorField.boundingBox(),
    colorSwatch.boundingBox(),
  ]);
  expect(fieldBox).not.toBeNull();
  expect(swatchBox).not.toBeNull();
  if (fieldBox && swatchBox) {
    const leftGap = swatchBox.x - fieldBox.x;
    const topGap = swatchBox.y - fieldBox.y;
    const bottomGap =
      fieldBox.y + fieldBox.height - swatchBox.y - swatchBox.height;
    expect(leftGap).toBe(topGap);
    expect(leftGap).toBe(bottomGap);
  }
  await exactColorInput.fill("203A5F");

  await expect(page.getByText("Color match: #203a5f")).toBeVisible();
  await expect(page.getByText("2 results")).toBeVisible();
  const exactColorResults = page.getByRole("button", {
    name: /(?:Navy relaxed shirt|Sporty navy overshirt) E2E Studio/,
  });
  await expect(exactColorResults).toHaveCount(2);
  await expect(exactColorResults.nth(0)).toHaveAccessibleName(
    /Navy relaxed shirt/,
  );
  await expect(exactColorResults.nth(1)).toHaveAccessibleName(
    /Sporty navy overshirt/,
  );
  await expect(
    page.getByRole("button", { name: /Straight black trousers E2E Studio/ }),
  ).toBeHidden();

  await page.reload();
  await expect(toggle).toBeChecked();
  await expect(page.getByLabel("HEX color")).toHaveValue("203a5f");
  await expect(page.getByText("2 results")).toBeVisible();

  await deleteActiveChip(page, "exactColor");
  await expect(toggle).not.toBeChecked();
  await expect(page.getByText("3 results")).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Open filters" }).click();
  const mobileToggle = page.getByRole("switch", {
    name: "Enable color matching",
  });
  await mobileToggle.check();
  await page.getByLabel("HEX color").fill("203A5F");
  await page.getByRole("button", { name: "Close filters" }).click();
  await expect(page.getByText("2 results")).toBeVisible();

  await page.getByRole("button", { name: "Open filters" }).click();
  await mobileToggle.uncheck();
  await page.getByRole("button", { name: "Close filters" }).click();
  await expect(page.getByText("3 results")).toBeVisible();
});

test("capsule product card opens product detail without leaving capsule", async ({
  page,
  resetAndLogin,
}) => {
  await resetAndLoginFresh(page, resetAndLogin, "with-profile");

  await expect(
    page.getByRole("button", { name: "Regenerate all" }),
  ).toBeVisible();
  const shirtCard = page.getByRole("button", {
    name: "Navy relaxed shirt",
    exact: true,
  });
  await expect(shirtCard).toBeVisible();
  await shirtCard.click();

  const productDialog = page.getByRole("dialog").filter({
    has: page.getByRole("link", { name: /Navy relaxed shirt/ }),
  });
  await expect(productDialog).toBeVisible();
  await expect(
    productDialog.getByRole("link", { name: /Navy relaxed shirt/ }),
  ).toHaveAttribute("href", "https://example.test/products/navy-shirt");
  await expect(
    productDialog.getByText("A deterministic e2e shirt fixture."),
  ).toBeVisible();
  await productDialog.getByRole("button", { name: "Close" }).click();

  await expect(page).toHaveURL(/\/capsule\/capsule-e2e$/);
  await expect(
    page.getByRole("button", { name: "Regenerate all" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Playwright capsule", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Navy relaxed shirt", exact: true }),
  ).toBeVisible();
});

test("statistics route renders charts and chart clicks update filters", async ({
  page,
  resetAndLogin,
}) => {
  await resetAndLoginFresh(
    page,
    resetAndLogin,
    "with-non-empty-stats",
    "/statistics",
  );

  await expect(page).toHaveURL(/\/statistics$/);
  await expect(page.getByTestId("statistics-summary-card")).toContainText("3");
  await expect(page.getByText("No active filters.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Category" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Accent color" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Style" })).toBeVisible();
  await expect(page.getByTestId("statistics-card")).toHaveCount(3);

  await page.getByRole("button", { name: "Category: Top" }).focus();
  await page.keyboard.press("Enter");

  await expect(page.getByText("Category: Top")).toBeVisible();
  await expect(page.getByTestId("statistics-summary-card")).toContainText("1");
  await expect(page.getByTestId("active-filter-chip-category")).toBeVisible();

  await page.getByRole("button", { name: "Reset" }).last().click();

  await expect(page.getByText("Category: Top")).toBeHidden();
  await expect(page.getByText("No active filters.")).toBeVisible();
  await expect(page.getByTestId("statistics-summary-card")).toContainText("3");
});
