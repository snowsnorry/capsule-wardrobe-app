import { test, expect } from "vitest";
import { injectSharedCapsuleMetaTags } from "./sharedCapsuleMeta.js";

function request(path: string, host = "client.example.test") {
  return {
    path,
    protocol: "https",
    originalUrl: path,
    get: (name: string) => (name === "host" ? host : undefined),
  };
}

test("injectSharedCapsuleMetaTags injects escaped Open Graph tags for share routes", async () => {
  const html = "<html><head><title>Capsule</title></head><body></body></html>";
  const result = await injectSharedCapsuleMetaTags(
    html,
    request("/share/share%201"),
    async (shareId: string) => {
      expect(shareId).toBe("share 1");
      return {
        title: "Spring & <Summer>",
        description: 'Quote "safe"',
        image: "https://cdn.example.test/image.jpg",
      };
    },
    { clientOrigin: "https://client.example.test" },
  );

  expect(result).toMatch(
    /property="og:title" content="Spring &amp; &lt;Summer&gt;"/,
  );
  expect(result).toMatch(
    /property="og:description" content="Quote &quot;safe&quot;"/,
  );
  expect(result).toMatch(
    /property="og:url" content="https:\/\/client\.example\.test\/share\/share%201"/,
  );
});

test("injectSharedCapsuleMetaTags builds og:url from CLIENT_ORIGIN instead of request host", async () => {
  const html = "<html><head></head><body></body></html>";
  const result = await injectSharedCapsuleMetaTags(
    html,
    request("/share/share%201?ref=preview", "evil.example.test"),
    async () => ({
      title: "Pinned origin",
      description: "Uses configured origin",
    }),
    { clientOrigin: "https://client.example.test/" },
  );

  expect(result).toMatch(
    /property="og:url" content="https:\/\/client\.example\.test\/share\/share%201\?ref=preview"/,
  );
  expect(result).not.toContain("evil.example.test");
});

test("injectSharedCapsuleMetaTags leaves non-share and missing metadata responses unchanged", async () => {
  const html = "<html><head></head><body></body></html>";
  const loader = async () => ({ title: "unused" });

  expect(
    await injectSharedCapsuleMetaTags(html, request("/capsule"), loader),
  ).toBe(html);
  expect(
    await injectSharedCapsuleMetaTags(
      html,
      request("/share/missing"),
      async () => null,
    ),
  ).toBe(html);
  expect(
    await injectSharedCapsuleMetaTags(
      html,
      request("/share/no-host", ""),
      async () => ({ title: "No host" }),
      { clientOrigin: "https://client.example.test" },
    ),
  ).toBe(
    '<html><head>    <meta property="og:title" content="No host" />\n    <meta property="og:description" content="" />\n    <meta property="og:image" content="" />\n    <meta property="og:url" content="https://client.example.test/share/no-host" />\n    <meta property="og:type" content="website" />\n  </head><body></body></html>',
  );
});
