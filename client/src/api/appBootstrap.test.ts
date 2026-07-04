import { beforeEach, describe, expect, test, vi } from "vitest";

const requestApi = vi.hoisted(() => ({
  requestJson: vi.fn(),
}));

vi.mock("./request", () => requestApi);
vi.mock("./config", () => ({ API_BASE_URL: "https://api.example.test" }));

import { fetchAppBootstrap } from "./appBootstrap";

describe("app bootstrap API", () => {
  beforeEach(() => {
    requestApi.requestJson.mockReset();
    requestApi.requestJson.mockResolvedValue({ ok: true });
  });

  test("fetches the unified app bootstrap endpoint", async () => {
    await fetchAppBootstrap();

    expect(requestApi.requestJson).toHaveBeenCalledWith(
      "https://api.example.test/app/bootstrap",
      {
        credentials: "include",
      },
    );
  });
});
