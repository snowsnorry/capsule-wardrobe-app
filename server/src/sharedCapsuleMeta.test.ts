import assert from "node:assert/strict";
import { test } from "node:test";
import { injectSharedCapsuleMetaTags } from "./sharedCapsuleMeta.js";

function request(path: string, host = "client.example.test") {
  return {
    path,
    protocol: "https",
    originalUrl: path,
    get: (name: string) => (name === "host" ? host : undefined)
  };
}

test("injectSharedCapsuleMetaTags injects escaped Open Graph tags for share routes", async () => {
  const html = "<html><head><title>Capsule</title></head><body></body></html>";
  const result = await injectSharedCapsuleMetaTags(html, request("/share/share%201"), async (shareId: string) => {
    assert.equal(shareId, "share 1");
    return {
      title: "Spring & <Summer>",
      description: 'Quote "safe"',
      image: "https://cdn.example.test/image.jpg"
    };
  });

  assert.match(result, /property="og:title" content="Spring &amp; &lt;Summer&gt;"/);
  assert.match(result, /property="og:description" content="Quote &quot;safe&quot;"/);
  assert.match(result, /property="og:url" content="https:\/\/client\.example\.test\/share\/share%201"/);
});

test("injectSharedCapsuleMetaTags leaves non-share and missing metadata responses unchanged", async () => {
  const html = "<html><head></head><body></body></html>";
  const loader = async () => ({ title: "unused" });

  assert.equal(await injectSharedCapsuleMetaTags(html, request("/capsule"), loader), html);
  assert.equal(await injectSharedCapsuleMetaTags(html, request("/share/missing"), async () => null), html);
  assert.equal(
    await injectSharedCapsuleMetaTags(html, request("/share/no-host", ""), async () => ({ title: "No host" })),
    '<html><head>    <meta property="og:title" content="No host" />\n    <meta property="og:description" content="" />\n    <meta property="og:image" content="" />\n    <meta property="og:url" content="/share/no-host" />\n    <meta property="og:type" content="website" />\n  </head><body></body></html>'
  );
});
