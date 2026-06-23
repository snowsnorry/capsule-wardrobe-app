import { lookup as dnsLookup } from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import { isIP } from "node:net";
import {
  getSafeServerFetchUrl,
  isUnsafeServerFetchAddress,
} from "./serverUrlSecurity.js";
import {
  assertContentLengthUnderLimit,
  createByteLimitedCollector,
} from "./wardrobeUploadByteLimits.js";

type GuardedDnsLookupResult = Array<{ address: string; family: number }>;

type GuardedDnsLookup = (
  hostname: string,
  options: { all: true; verbatim: true },
) => Promise<GuardedDnsLookupResult>;

type GuardedServerFetchResponse = {
  buffer: Buffer;
  headers: Headers;
  status: number;
  url: string;
};

type GuardedNodeRequestInput = {
  address: string;
  errorCode: string;
  family: number;
  maxBytes: number;
  timeoutMs: number;
  url: URL;
};

type GuardedNodeRequestResult =
  | {
      headers: Headers;
      location: string;
      redirect: true;
      status: number;
    }
  | {
      buffer: Buffer;
      headers: Headers;
      redirect: false;
      status: number;
    };

type GuardedNodeRequest = (
  input: GuardedNodeRequestInput,
) => Promise<GuardedNodeRequestResult>;

const DEFAULT_MAX_REDIRECTS = 5;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

function getHeader(headers: Headers, name: string): string {
  return headers.get(name) || "";
}

function isRedirectStatus(status: number): boolean {
  return REDIRECT_STATUSES.has(status);
}

function headersFromIncomingMessage(
  headers: http.IncomingHttpHeaders,
): Headers {
  const result = new Headers();
  for (const [name, value] of Object.entries(headers)) {
    if (Array.isArray(value)) {
      value.forEach((entry) => result.append(name, entry));
    } else if (value !== undefined) {
      result.set(name, String(value));
    }
  }
  return result;
}

function getSafeRedirectUrl(location: string, baseUrl: string): string {
  try {
    return getSafeServerFetchUrl(new URL(location, baseUrl).toString());
  } catch {
    return "";
  }
}

async function resolveGuardedAddress({
  lookupImpl,
  url,
}: {
  lookupImpl: GuardedDnsLookup;
  url: URL;
}) {
  const hostname = url.hostname;
  if (isIP(hostname) && isUnsafeServerFetchAddress(hostname)) {
    throw new Error("unsafe_server_fetch_url");
  }

  const addresses = await lookupImpl(hostname, { all: true, verbatim: true });
  if (
    !addresses.length ||
    addresses.some((entry) => isUnsafeServerFetchAddress(entry.address))
  ) {
    throw new Error("unsafe_server_fetch_dns");
  }

  return addresses[0];
}

async function guardedServerFetchBuffer({
  errorCode,
  lookupImpl = dnsLookup,
  maxBytes,
  maxRedirects = DEFAULT_MAX_REDIRECTS,
  requestImpl = requestUrlWithPinnedAddress,
  timeoutMs,
  url,
}: {
  errorCode: string;
  lookupImpl?: GuardedDnsLookup;
  maxBytes: number;
  maxRedirects?: number;
  requestImpl?: GuardedNodeRequest;
  timeoutMs: number;
  url: string;
}): Promise<GuardedServerFetchResponse> {
  let currentUrl = getSafeServerFetchUrl(url);
  if (!currentUrl) {
    throw new Error("unsafe_server_fetch_url");
  }

  for (
    let redirectCount = 0;
    redirectCount <= maxRedirects;
    redirectCount += 1
  ) {
    const parsedUrl = new URL(currentUrl);
    const address = await resolveGuardedAddress({ lookupImpl, url: parsedUrl });
    const response = await requestImpl({
      address: address.address,
      errorCode,
      family: address.family,
      maxBytes,
      timeoutMs,
      url: parsedUrl,
    });

    if (response.redirect === false) {
      return {
        buffer: response.buffer,
        headers: response.headers,
        status: response.status,
        url: currentUrl,
      };
    }

    if (!isRedirectStatus(response.status)) {
      throw new Error(`server_fetch_failed_${response.status}`);
    }
    if (redirectCount === maxRedirects) {
      throw new Error("server_fetch_too_many_redirects");
    }

    const nextUrl = getSafeRedirectUrl(response.location, currentUrl);
    if (!nextUrl) {
      throw new Error("unsafe_server_fetch_redirect");
    }
    currentUrl = nextUrl;
  }

  throw new Error("server_fetch_too_many_redirects");
}

function requestUrlWithPinnedAddress({
  address,
  errorCode,
  family,
  maxBytes,
  timeoutMs,
  url,
}: GuardedNodeRequestInput): Promise<GuardedNodeRequestResult> {
  return new Promise((resolve, reject) => {
    let settled = false;
    function resolveOnce(result: GuardedNodeRequestResult) {
      if (settled) {
        return;
      }
      settled = true;
      resolve(result);
    }
    function rejectOnce(error: Error) {
      if (settled) {
        return;
      }
      settled = true;
      reject(error);
    }

    const requestImpl =
      url.protocol === "https:" ? https.request : http.request;
    const request = requestImpl(
      url,
      {
        headers: {
          accept: "image/avif,image/webp,image/png,image/jpeg,*/*;q=0.8",
          "user-agent": "capsule-wardrobe-image-fetch/1.0",
        },
        lookup: (_hostname, _options, callback) => {
          callback(null, address, family);
        },
        method: "GET",
        timeout: timeoutMs,
      },
      (response) => {
        const status = response.statusCode || 0;
        const headers = headersFromIncomingMessage(response.headers);
        const location = getHeader(headers, "location");
        if (isRedirectStatus(status) && location) {
          response.resume();
          resolveOnce({ headers, location, redirect: true, status });
          return;
        }

        try {
          assertContentLengthUnderLimit({ errorCode, headers, maxBytes });
        } catch (error) {
          rejectOnce(error instanceof Error ? error : new Error(errorCode));
          response.resume();
          request.destroy(error instanceof Error ? error : undefined);
          return;
        }

        const collector = createByteLimitedCollector(maxBytes, errorCode);
        response.on("data", (chunk: Buffer | string) => {
          try {
            collector.append(
              Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk),
            );
          } catch (error) {
            rejectOnce(error instanceof Error ? error : new Error(errorCode));
            request.destroy(
              error instanceof Error ? error : new Error(errorCode),
            );
          }
        });
        response.on("end", () => {
          resolveOnce({
            buffer: collector.getBuffer(),
            headers,
            redirect: false,
            status,
          });
        });
        response.on("error", rejectOnce);
      },
    );

    request.on("timeout", () => {
      request.destroy(new Error("server_fetch_timeout"));
    });
    request.on("error", rejectOnce);
    request.end();
  });
}

export { guardedServerFetchBuffer };
export type { GuardedDnsLookup, GuardedNodeRequest };
