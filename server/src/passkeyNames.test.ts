import assert from "node:assert/strict";
import test from "node:test";
import {
  getDefaultPasskeyName,
  getPasskeyProviderName,
  getUserAgentPasskeyLabel,
  normalizePasskeyAaguid
} from "./passkeyNames.js";

test("passkey provider names are resolved from known AAGUIDs", () => {
  assert.equal(getPasskeyProviderName("BADA5566-A7AA-401F-BD96-45619A55120D"), "1Password");
  assert.equal(getPasskeyProviderName("d548826e-79b4-db40-a3d8-11116f7e8349"), "Bitwarden");
  assert.equal(getPasskeyProviderName("ea9b8d66-4d01-1d21-3ce4-b6b48cb575d4"), "Google Password Manager");
  assert.equal(getPasskeyProviderName("fbfc3007-154e-4ecc-8c0b-6e020557d7bd"), "iCloud Keychain / Apple Passwords");
  assert.equal(getPasskeyProviderName("08987058-cadc-4b81-b6e1-30de50dcbe96"), "Windows Hello");
  assert.equal(getPasskeyProviderName("2fc0579f-8113-47ea-b116-bb5a8db9202a"), "YubiKey");
});

test("passkey AAGUID normalization rejects invalid values", () => {
  assert.equal(normalizePasskeyAaguid(" BADA5566-A7AA-401F-BD96-45619A55120D "), "bada5566-a7aa-401f-bd96-45619a55120d");
  assert.equal(normalizePasskeyAaguid("not-a-guid"), null);
  assert.equal(normalizePasskeyAaguid(null), null);
});

test("passkey user-agent labels use OS and browser names", () => {
  assert.equal(
    getUserAgentPasskeyLabel("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15"),
    "macOS Safari"
  );
  assert.equal(
    getUserAgentPasskeyLabel("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"),
    "Windows Chrome"
  );
  assert.equal(
    getUserAgentPasskeyLabel("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1"),
    "iPhone Safari"
  );
  assert.equal(
    getUserAgentPasskeyLabel("Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36"),
    "Android Chrome"
  );
  assert.equal(
    getUserAgentPasskeyLabel("Mozilla/5.0 (X11; Linux x86_64; rv:126.0) Gecko/20100101 Firefox/126.0"),
    "Linux Firefox"
  );
  assert.equal(getUserAgentPasskeyLabel("unknown"), null);
});

test("default passkey name uses provider, then user-agent, then fallback", () => {
  assert.equal(getDefaultPasskeyName({
    aaguid: "bada5566-a7aa-401f-bd96-45619a55120d",
    userAgent: "unknown"
  }), "1Password");
  assert.equal(getDefaultPasskeyName({
    aaguid: "11111111-2222-3333-4444-555555555555",
    userAgent: "Mozilla/5.0 (X11; Linux x86_64; rv:126.0) Gecko/20100101 Firefox/126.0"
  }), "Linux Firefox");
  assert.equal(getDefaultPasskeyName({ aaguid: null, userAgent: "unknown" }), "Passkey");
});
