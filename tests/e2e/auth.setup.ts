import { mkdirSync } from "node:fs";
import path from "node:path";
import { expect, test as setup } from "@playwright/test";

const authFile = path.join(process.cwd(), "tests/e2e/.auth/user.json");

setup("authenticate e2e user", async ({ request }) => {
  const reset = await request.post("/__e2e/reset", {
    data: { scenario: "with-profile" },
  });
  await expect(reset).toBeOK();

  const login = await request.post("/__e2e/login");
  await expect(login).toBeOK();

  mkdirSync(path.dirname(authFile), { recursive: true });
  await request.storageState({ path: authFile });
});
