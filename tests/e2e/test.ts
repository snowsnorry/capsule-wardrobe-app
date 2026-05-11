import { expect, test as base } from "@playwright/test";
import type { Page } from "@playwright/test";

type E2eScenario =
  | "with-profile"
  | "no-profile"
  | "with-saved-search"
  | "with-non-empty-stats"
  | "empty-wardrobe";
type E2eFixtures = {
  resetAndLogin: (scenario?: E2eScenario) => Promise<void>;
};

function isAllowedUrl(rawUrl: string, baseURL: string | undefined): boolean {
  const url = new URL(rawUrl);
  if (!["http:", "https:"].includes(url.protocol)) {
    return true;
  }

  const base = new URL(baseURL || "http://127.0.0.1:5310");
  return (
    url.origin === base.origin ||
    ["127.0.0.1", "localhost", "::1"].includes(url.hostname)
  );
}

async function blockExternalNetwork(page: Page, baseURL: string | undefined) {
  await page.route("**/*", async (route) => {
    const url = route.request().url();
    if (isAllowedUrl(url, baseURL)) {
      await route.continue();
      return;
    }

    await route.abort("blockedbyclient");
  });
}

export const test = base.extend<E2eFixtures>({
  page: async ({ page, baseURL }, use) => {
    await blockExternalNetwork(page, baseURL);
    await use(page);
  },
  resetAndLogin: async ({ page }, use) => {
    await use(async (scenario = "with-profile") => {
      const reset = await page
        .context()
        .request.post("/__e2e/reset", { data: { scenario } });
      await expect(reset).toBeOK();
      const login = await page.context().request.post("/__e2e/login");
      await expect(login).toBeOK();
    });
  },
});

export { expect };
