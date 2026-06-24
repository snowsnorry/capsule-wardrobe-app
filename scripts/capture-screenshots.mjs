import { Buffer } from "node:buffer";
import { spawn } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { chromium, expect } from "@playwright/test";

const ROOT_DIR = process.cwd();
const OUTPUT_DIR = path.join(ROOT_DIR, "screenshots");
const PORT = Number(process.env.SCREENSHOT_PORT || 5318);
const HMR_PORT = Number(process.env.SCREENSHOT_HMR_PORT || 24688);
const BASE_URL = `http://127.0.0.1:${PORT}`;
const SCREENSHOT_IMAGE_URL =
  process.env.SCREENSHOT_IMAGE_URL ||
  "https://assets.capsule-wardrobe.org/wardrobe/f2641a1885a7ae72/10aabb25-57ee-44f8-9bef-dace449e7d7f-6debe3c08665582a3ebf78dca471bf8f663f769f195379a252d4060bc66a8018_clean_640.webp";
const E2E_CAPSULE_PATH = "/capsule/capsule-e2e";
const DESKTOP_VIEWPORT = { width: 1440, height: 960 };
const MOBILE_VIEWPORT = { width: 390, height: 844 };
const HEALTH_TIMEOUT_MS = 120_000;
const SERVER_STOP_TIMEOUT_MS = 5_000;
const ALLOWED_EXTERNAL_HOSTS = new Set([
  "fonts.googleapis.com",
  "fonts.gstatic.com",
]);

function appUrl(pathname) {
  return new URL(pathname, BASE_URL).toString();
}

function isAllowedUrl(rawUrl) {
  const url = new URL(rawUrl);
  if (!["http:", "https:"].includes(url.protocol)) {
    return true;
  }

  const base = new URL(BASE_URL);
  return (
    url.origin === base.origin ||
    ["127.0.0.1", "localhost", "::1"].includes(url.hostname) ||
    ALLOWED_EXTERNAL_HOSTS.has(url.hostname)
  );
}

function createServerProcess() {
  const server = spawn("npm", ["--workspace", "server", "run", "dev:e2e"], {
    cwd: ROOT_DIR,
    detached: true,
    env: {
      ...process.env,
      PORT: String(PORT),
      CLIENT_ORIGIN: BASE_URL,
      E2E_BASE_URL: BASE_URL,
      E2E_VITE_HMR_PORT: String(HMR_PORT),
      npm_config_loglevel: "silent",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  server.stdout.on("data", (chunk) => {
    process.stdout.write(`[screenshots:server] ${chunk}`);
  });
  server.stderr.on("data", (chunk) => {
    process.stderr.write(`[screenshots:server] ${chunk}`);
  });

  return server;
}

async function waitForHealth(server) {
  const deadline = Date.now() + HEALTH_TIMEOUT_MS;
  let lastError;

  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error(`e2e server exited with code ${server.exitCode}`);
    }

    try {
      const response = await fetch(appUrl("/health"));
      if (response.ok) {
        return;
      }
      lastError = new Error(`health returned ${response.status}`);
    } catch (error) {
      lastError = error;
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(
    `Timed out waiting for ${appUrl("/health")}: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`,
  );
}

async function stopServer(server) {
  if (server.exitCode !== null || !server.pid) {
    return;
  }

  const stopped = new Promise((resolve) => {
    server.once("exit", resolve);
  });

  try {
    process.kill(-server.pid, "SIGTERM");
  } catch (error) {
    if (error?.code !== "ESRCH") {
      throw error;
    }
  }

  const timeout = new Promise((resolve) => {
    setTimeout(resolve, SERVER_STOP_TIMEOUT_MS);
  });
  await Promise.race([stopped, timeout]);

  if (server.exitCode === null) {
    try {
      process.kill(-server.pid, "SIGKILL");
    } catch (error) {
      if (error?.code !== "ESRCH") {
        throw error;
      }
    }
  }
}

async function prepareOutputDir() {
  await rm(OUTPUT_DIR, { recursive: true, force: true });
  await mkdir(path.join(OUTPUT_DIR, "light"), { recursive: true });
  await mkdir(path.join(OUTPUT_DIR, "dark"), { recursive: true });
}

async function loadScreenshotImage() {
  const response = await fetch(SCREENSHOT_IMAGE_URL);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch screenshot image ${SCREENSHOT_IMAGE_URL}: ${response.status}`,
    );
  }

  return {
    body: Buffer.from(await response.arrayBuffer()),
    contentType: response.headers.get("content-type") || "image/webp",
  };
}

async function createScreenshotContext(
  browser,
  colorScheme,
  viewport,
  imageAsset,
) {
  const context = await browser.newContext({
    colorScheme,
    reducedMotion: "reduce",
    viewport,
  });

  await context.route("**/*", async (route) => {
    if (route.request().resourceType() === "image") {
      await route.fulfill({
        body: imageAsset.body,
        contentType: imageAsset.contentType,
      });
      return;
    }

    if (isAllowedUrl(route.request().url())) {
      await route.continue();
      return;
    }

    await route.abort("blockedbyclient");
  });

  return context;
}

async function resetAndLogin(context, scenario) {
  const reset = await context.request.post(appUrl("/__e2e/reset"), {
    data: { scenario },
  });
  await expect(reset).toBeOK();

  const login = await context.request.post(appUrl("/__e2e/login"));
  await expect(login).toBeOK();
}

async function openPage(
  context,
  pathname,
  scenario,
  viewport = DESKTOP_VIEWPORT,
) {
  await context.setDefaultTimeout(15_000);
  await context.setDefaultNavigationTimeout(30_000);
  await resetAndLogin(context, scenario);
  const page = await context.newPage();
  await page.setViewportSize(viewport);
  await page.goto(appUrl(pathname));
  return page;
}

async function screenshot(page, theme, filename) {
  const outputPath = path.join(OUTPUT_DIR, theme, filename);
  await page.screenshot({
    path: outputPath,
    fullPage: true,
    animations: "disabled",
  });
  console.log(`Captured ${path.relative(ROOT_DIR, outputPath)}`);
}

async function captureCapsule(context, theme) {
  const page = await openPage(context, E2E_CAPSULE_PATH, "with-profile");
  await expect(
    page.getByRole("button", { name: "Regenerate all" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Navy relaxed shirt", exact: true }),
  ).toBeVisible();
  await screenshot(page, theme, "01-capsule.png");
  await page.close();
}

async function uploadWardrobeFiles(page, imageAsset) {
  await page.getByRole("button", { name: "Upload item photo" }).click();
  const dialog = page.getByRole("dialog", {
    name: "Upload personal item photos",
  });
  await expect(dialog).toBeVisible();
  await page.locator('input[type="file"]').setInputFiles([
    {
      name: "linen-shirt.webp",
      mimeType: imageAsset.contentType,
      buffer: imageAsset.body,
    },
    {
      name: "navy-trousers.webp",
      mimeType: imageAsset.contentType,
      buffer: imageAsset.body,
    },
    {
      name: "white-sneakers.webp",
      mimeType: imageAsset.contentType,
      buffer: imageAsset.body,
    },
  ]);
  await expect(dialog.getByText(/^3 files, /)).toBeVisible();

  const uploadResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().includes("/wardrobe/items/upload"),
  );
  await dialog.getByRole("button", { name: "Upload" }).click();
  await uploadResponse;
  await expect(dialog).toBeHidden();
}

async function capturePersonalItems(context, theme, imageAsset) {
  const page = await openPage(context, "/personal-items", "with-profile");
  await expect(
    page.getByRole("button", { name: "Upload item photo" }),
  ).toBeVisible();
  await uploadWardrobeFiles(page, imageAsset);
  await expect(
    page.getByRole("button", { name: "Uploaded e2e item 1", exact: true }),
  ).toBeVisible();
  await screenshot(page, theme, "02-personal-items.png");
  await page.close();
}

async function captureExplore(context, theme) {
  const page = await openPage(context, "/explore", "with-saved-search");
  await expect(page.getByPlaceholder(/Search in natural language/)).toHaveValue(
    "saved navy office",
  );
  await expect(page.getByText("Category: Top")).toBeVisible();
  await expect(page.getByText("Accent color: Navy")).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Navy relaxed shirt E2E Studio/ }),
  ).toBeVisible();
  await screenshot(page, theme, "03-explore-search.png");
  await page.close();
}

async function captureStatistics(context, theme) {
  const page = await openPage(context, "/statistics", "with-non-empty-stats");
  await expect(page.getByTestId("statistics-summary-card")).toContainText("3");
  await expect(page.getByTestId("statistics-card")).toHaveCount(3);

  if (theme === "dark") {
    await page.getByRole("button", { name: "Category: Top" }).first().focus();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("active-filter-chip-category")).toBeVisible();
    await screenshot(page, theme, "04-statistics-selected-chip.png");
  } else {
    await screenshot(page, theme, "04-statistics.png");
  }

  await page.close();
}

async function captureProductDetail(context, theme) {
  const page = await openPage(context, E2E_CAPSULE_PATH, "with-profile");
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
  await screenshot(page, theme, "05-product-detail-dialog.png");
  await page.close();
}

async function captureSettings(context, theme) {
  const page = await openPage(context, E2E_CAPSULE_PATH, "with-profile");
  await expect(
    page.getByRole("button", { name: "Regenerate all" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Open user menu" }).click();
  await page.getByRole("menuitem", { name: "Settings" }).click();
  const settingsDialog = page.getByRole("dialog", { name: "Settings" });
  await expect(settingsDialog).toBeVisible();
  await expect(
    settingsDialog.getByRole("button", { name: "Save" }),
  ).toBeDisabled();
  await screenshot(
    page,
    theme,
    theme === "dark"
      ? "06-settings-dialog-disabled-save.png"
      : "06-settings-dialog.png",
  );
  await page.close();
}

async function captureMobileFilterDialog(
  browser,
  colorScheme,
  theme,
  imageAsset,
) {
  const context = await createScreenshotContext(
    browser,
    colorScheme,
    MOBILE_VIEWPORT,
    imageAsset,
  );
  const page = await openPage(
    context,
    E2E_CAPSULE_PATH,
    "with-profile",
    MOBILE_VIEWPORT,
  );
  await expect(
    page.getByRole("button", { name: "Regenerate all" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Open filters" }).click();
  await expect(page.getByRole("heading", { name: "Filters" })).toBeVisible();
  await expect(
    page.getByLabel("Capsule settings").getByText("Filters have not changed."),
  ).toBeVisible();
  await screenshot(
    page,
    theme,
    theme === "dark"
      ? "07-mobile-filter-dialog-disabled-controls.png"
      : "07-mobile-filter-dialog.png",
  );
  await context.close();
}

async function captureTheme(browser, theme, imageAsset) {
  const colorScheme = theme;
  const context = await createScreenshotContext(
    browser,
    colorScheme,
    DESKTOP_VIEWPORT,
    imageAsset,
  );

  await captureCapsule(context, theme);
  await capturePersonalItems(context, theme, imageAsset);
  await captureExplore(context, theme);
  await captureStatistics(context, theme);
  await captureProductDetail(context, theme);
  await captureSettings(context, theme);
  await context.close();

  await captureMobileFilterDialog(browser, colorScheme, theme, imageAsset);
}

async function main() {
  await prepareOutputDir();
  const server = createServerProcess();
  let browser;

  try {
    const imageAsset = await loadScreenshotImage();
    await waitForHealth(server);
    browser = await chromium.launch({ headless: true });
    await captureTheme(browser, "light", imageAsset);
    await captureTheme(browser, "dark", imageAsset);
    console.log(
      `Screenshots written to ${path.relative(ROOT_DIR, OUTPUT_DIR)}/`,
    );
  } finally {
    await browser?.close();
    await stopServer(server);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
