import { expect, test } from "./test";
import type { Page, Response } from "@playwright/test";

type SearchRequestLogEntry = {
  query: string;
  gated: boolean;
  released: boolean;
  completed: boolean;
};

const EXPECTED_GLOBAL_EXTERNAL_HOSTS = new Set(["fonts.googleapis.com"]);

function isAllowedE2eUrl(rawUrl: string, baseURL: string | undefined): boolean {
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

function searchResponseMatches(response: Response, query: string): boolean {
  if (!response.url().endsWith("/search/run")) {
    return false;
  }
  if (response.request().method() !== "POST") {
    return false;
  }

  const postData = response.request().postData();
  if (!postData) {
    return false;
  }

  return (JSON.parse(postData) as { query?: unknown }).query === query;
}

async function searchRequestLog(page: Page): Promise<SearchRequestLogEntry[]> {
  const response = await page.context().request.get("/__e2e/search/requests");
  await expect(response).toBeOK();
  const payload = (await response.json()) as {
    requests?: SearchRequestLogEntry[];
  };
  return payload.requests || [];
}

test("search keeps latest results when an older response resolves last", async ({
  page,
  resetAndLogin,
  baseURL,
}) => {
  const firstQuery = "e2e-first query";
  const secondQuery = "e2e-second query";
  const staleResult = page.getByRole("button", {
    name: /Navy relaxed shirt E2E Studio/,
  });
  const latestResult = page.getByRole("button", {
    name: /Sporty navy overshirt E2E Studio/,
  });
  const unexpectedExternalRequests: string[] = [];

  page.on("request", (request) => {
    const url = new URL(request.url());
    if (
      !isAllowedE2eUrl(request.url(), baseURL) &&
      !EXPECTED_GLOBAL_EXTERNAL_HOSTS.has(url.hostname)
    ) {
      unexpectedExternalRequests.push(request.url());
    }
  });

  await resetAndLogin("with-profile");
  await page.goto("/explore");

  const searchInput = page.getByPlaceholder(/Search in natural language/);
  await expect(searchInput).toBeVisible();
  await expect(page.getByText("3 results")).toBeVisible();
  await expect(page.getByRole("progressbar")).toBeHidden();

  const gate = await page.context().request.post("/__e2e/search/delay", {
    data: { query: firstQuery, match: "exact" },
  });
  await expect(gate).toBeOK();

  const firstResponse = page.waitForResponse((response) =>
    searchResponseMatches(response, firstQuery),
  );
  await searchInput.fill(firstQuery);
  await page.keyboard.press("Enter");

  await expect
    .poll(async () => {
      const requests = await searchRequestLog(page);
      return requests.some(
        (request) =>
          request.query === firstQuery &&
          request.gated &&
          !request.released &&
          !request.completed,
      );
    })
    .toBe(true);
  await expect(page.getByRole("progressbar")).toBeVisible();

  const secondResponse = page.waitForResponse((response) =>
    searchResponseMatches(response, secondQuery),
  );
  await searchInput.fill(secondQuery);
  await page.keyboard.press("Enter");
  await secondResponse;

  await expect(searchInput).toHaveValue(secondQuery);
  await expect(page.getByText("1 results")).toBeVisible();
  await expect(latestResult).toBeVisible();
  await expect(staleResult).toBeHidden();

  const release = await page.context().request.post("/__e2e/search/release", {
    data: { query: firstQuery, match: "exact" },
  });
  await expect(release).toBeOK();
  await expect(await release.json()).toMatchObject({
    ok: true,
    released: true,
  });
  await firstResponse;

  await expect
    .poll(async () => {
      const requests = await searchRequestLog(page);
      return requests.some(
        (request) =>
          request.query === firstQuery &&
          request.gated &&
          request.released &&
          request.completed,
      );
    })
    .toBe(true);
  await expect(page.getByRole("progressbar")).toBeHidden();
  await expect(searchInput).toHaveValue(secondQuery);
  await expect(page.getByText("1 results")).toBeVisible();
  await expect(latestResult).toBeVisible();
  await expect(staleResult).toBeHidden();
  expect(unexpectedExternalRequests).toEqual([]);
});
