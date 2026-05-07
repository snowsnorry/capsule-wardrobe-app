import { test, expect } from "vitest";
import {
  getDefaultPasskeyName,
  getPasskeyProviderName,
  getUserAgentPasskeyLabel,
  normalizePasskeyAaguid,
} from "./passkeyNames.js";

test("passkey provider names are resolved from known AAGUIDs", () => {
  expect(getPasskeyProviderName("BADA5566-A7AA-401F-BD96-45619A55120D")).toBe(
    "1Password",
  );
  expect(getPasskeyProviderName("d548826e-79b4-db40-a3d8-11116f7e8349")).toBe(
    "Bitwarden",
  );
  expect(getPasskeyProviderName("ea9b8d66-4d01-1d21-3ce4-b6b48cb575d4")).toBe(
    "Google Password Manager",
  );
  expect(getPasskeyProviderName("fbfc3007-154e-4ecc-8c0b-6e020557d7bd")).toBe(
    "iCloud Keychain / Apple Passwords",
  );
  expect(getPasskeyProviderName("08987058-cadc-4b81-b6e1-30de50dcbe96")).toBe(
    "Windows Hello",
  );
  expect(getPasskeyProviderName("2fc0579f-8113-47ea-b116-bb5a8db9202a")).toBe(
    "YubiKey",
  );
});

test("passkey AAGUID normalization rejects invalid values", () => {
  expect(normalizePasskeyAaguid(" BADA5566-A7AA-401F-BD96-45619A55120D ")).toBe(
    "bada5566-a7aa-401f-bd96-45619a55120d",
  );
  expect(normalizePasskeyAaguid("not-a-guid")).toBe(null);
  expect(normalizePasskeyAaguid(null)).toBe(null);
});

test("passkey user-agent labels use OS and browser names", () => {
  expect(
    getUserAgentPasskeyLabel(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
    ),
  ).toBe("macOS Safari");
  expect(
    getUserAgentPasskeyLabel(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    ),
  ).toBe("Windows Chrome");
  expect(
    getUserAgentPasskeyLabel(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
    ),
  ).toBe("iPhone Safari");
  expect(
    getUserAgentPasskeyLabel(
      "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36",
    ),
  ).toBe("Android Chrome");
  expect(
    getUserAgentPasskeyLabel(
      "Mozilla/5.0 (X11; Linux x86_64; rv:126.0) Gecko/20100101 Firefox/126.0",
    ),
  ).toBe("Linux Firefox");
  expect(getUserAgentPasskeyLabel("unknown")).toBe(null);
});

test("default passkey name uses provider, then user-agent, then fallback", () => {
  expect(
    getDefaultPasskeyName({
      aaguid: "bada5566-a7aa-401f-bd96-45619a55120d",
      userAgent: "unknown",
    }),
  ).toBe("1Password");
  expect(
    getDefaultPasskeyName({
      aaguid: "11111111-2222-3333-4444-555555555555",
      userAgent:
        "Mozilla/5.0 (X11; Linux x86_64; rv:126.0) Gecko/20100101 Firefox/126.0",
    }),
  ).toBe("Linux Firefox");
  expect(getDefaultPasskeyName({ aaguid: null, userAgent: "unknown" })).toBe(
    "Passkey",
  );
});
