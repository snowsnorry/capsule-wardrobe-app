import test from "node:test";
import assert from "node:assert/strict";

async function importAppConfig(suffix: string) {
  return import(`./appConfig.ts?${suffix}`);
}

test("appConfig reads environment overrides and auth test mode variants", async () => {
  const original = {
    PORT: process.env.PORT,
    CLIENT_ORIGIN: process.env.CLIENT_ORIGIN,
    NODE_ENV: process.env.NODE_ENV,
    AUTH_TEST_MODE: process.env.AUTH_TEST_MODE,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    PASSKEY_RP_NAME: process.env.PASSKEY_RP_NAME,
    PASSKEY_RP_ID: process.env.PASSKEY_RP_ID,
    PASSKEY_ORIGIN: process.env.PASSKEY_ORIGIN
  };

  try {
    process.env.PORT = "4444";
    process.env.CLIENT_ORIGIN = "https://client.example.test";
    process.env.NODE_ENV = "test";
    process.env.AUTH_TEST_MODE = "YES";
    process.env.GOOGLE_CLIENT_ID = "google-client";
    process.env.PASSKEY_RP_NAME = "Wardrobe";
    process.env.PASSKEY_RP_ID = "example.test";
    process.env.PASSKEY_ORIGIN = "https://example.test";

    const overridden = await importAppConfig("overridden");
    assert.equal(overridden.PORT, "4444");
    assert.equal(overridden.CLIENT_ORIGIN, "https://client.example.test");
    assert.equal(overridden.NODE_ENV, "test");
    assert.equal(overridden.AUTH_TEST_MODE, true);
    assert.equal(overridden.GOOGLE_CLIENT_ID, "google-client");
    assert.equal(overridden.PASSKEY_RP_NAME, "Wardrobe");
    assert.equal(overridden.PASSKEY_RP_ID, "example.test");
    assert.equal(overridden.PASSKEY_ORIGIN, "https://example.test");

    process.env.NODE_ENV = "production";
    process.env.AUTH_TEST_MODE = "true";
    const production = await importAppConfig("production");
    assert.equal(production.AUTH_TEST_MODE, false);
  } finally {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
});
