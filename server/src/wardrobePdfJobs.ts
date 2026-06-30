import { getProfile } from "./profileStore.js";
import { getProductsByUrlsInOrder } from "./db.js";
import { sortWardrobeItems } from "../../shared/wardrobeOrder.js";
import { runWithImageWorkSlot } from "./ai/imagePipeline.js";
import type {
  WardrobePdfBuildChildOptions,
  WardrobePdfJobState,
} from "./ai/types.js";
import {
  createWardrobePdfGenerationKey,
  getPdfLocale,
  getStoredWardrobeItems,
  type ProductLike,
  type ProfileWithPdfResult,
  type UpdateProfilePdfImpl,
  type WardrobePdfJobOptions,
} from "./wardrobePdfCore.js";
import { buildWardrobePdfInChild } from "./wardrobePdfChildRunner.js";
import { logError, logWarn } from "./logger.js";
import { createDownloadWardrobePdf } from "./wardrobePdfDownload.js";
import {
  deleteWardrobePdfJob,
  getWardrobePdfJob,
  isCurrentWardrobePdfJob,
  scheduleWardrobePdfJobCleanup,
  setWardrobePdfJob,
} from "./wardrobePdfJobRegistry.js";

type WardrobePdfJobManagerDeps = {
  getProfileByEmail?: typeof getProfile;
  getProfilePdfByEmail?: (
    email: string,
  ) => Promise<Buffer | Uint8Array | number[] | null>;
  getProfileWithPdfByEmail?:
    ((email: string) => Promise<ProfileWithPdfResult>) | null;
  updateProfilePdfByEmail?: UpdateProfilePdfImpl;
  getProducts?: typeof getProductsByUrlsInOrder;
  buildPdfInChild?: (
    products: ProductLike[],
    locale?: string,
    options?: WardrobePdfBuildChildOptions,
  ) => Promise<Buffer>;
};

type StartWardrobePdfJobDeps = Required<
  Pick<
    WardrobePdfJobManagerDeps,
    | "getProfileByEmail"
    | "updateProfilePdfByEmail"
    | "getProducts"
    | "buildPdfInChild"
  >
>;
type WardrobePdfItemLike = { url?: unknown };

function createLoadProfileWithPdf({
  getProfileByEmail,
  getProfilePdfByEmail,
  getProfileWithPdfByEmail,
}: Required<
  Pick<WardrobePdfJobManagerDeps, "getProfileByEmail" | "getProfilePdfByEmail">
> &
  Pick<WardrobePdfJobManagerDeps, "getProfileWithPdfByEmail">) {
  const loadProfileWithPdf =
    getProfileWithPdfByEmail ||
    (async (email) => ({
      profile: await getProfileByEmail(email),
      pdf: await getProfilePdfByEmail(email),
    }));

  return loadProfileWithPdf as (email: string) => Promise<ProfileWithPdfResult>;
}

function resolveWardrobePdfJobInput(
  email: string,
  job: WardrobePdfJobState,
  options: {
    resolvedItems: WardrobePdfItemLike[];
    resolvedLocale: string;
    locale: string | null;
    getProfileByEmail: typeof getProfile;
  },
) {
  return (async () => {
    if (options.resolvedItems.length > 0 && options.locale) {
      return {
        items: options.resolvedItems,
        pdfLocale: options.resolvedLocale,
      };
    }

    const profile = await options.getProfileByEmail(email);
    return {
      items: sortWardrobeItems(getStoredWardrobeItems(profile)),
      pdfLocale: getPdfLocale(profile?.locale),
    };
  })();
}

async function buildAndStoreWardrobePdf({
  email,
  job,
  items,
  pdfLocale,
  expectedItems,
  expectedLocale,
  getProducts,
  buildPdfInChild,
  updateProfilePdfByEmail,
}: {
  email: string;
  job: WardrobePdfJobState;
  items: WardrobePdfItemLike[];
  pdfLocale: string;
  expectedItems: unknown;
  expectedLocale: string | null;
  getProducts: typeof getProductsByUrlsInOrder;
  buildPdfInChild: (
    products: ProductLike[],
    locale?: string,
    options?: WardrobePdfBuildChildOptions,
  ) => Promise<Buffer>;
  updateProfilePdfByEmail: UpdateProfilePdfImpl;
}) {
  const productUrls = items
    .map((item) => String(item?.url || "").trim())
    .filter(Boolean);
  if (productUrls.length === 0) {
    throw new Error("wardrobe_pdf_items_missing");
  }

  const products = await getProducts(productUrls);
  const foundUrls = new Set(
    products.map((product) => String(product?.url || "")),
  );
  const missingUrls = productUrls.filter((url) => !foundUrls.has(url));
  if (missingUrls.length > 0) {
    logWarn(
      "[wardrobe-pdf][missing-products]",
      JSON.stringify({ email, missingUrls }),
    );
  }

  if (products.length === 0) {
    throw new Error("wardrobe_pdf_products_missing");
  }

  const pdfBuffer = await runWithImageWorkSlot("wardrobe-pdf-build", () =>
    buildPdfInChild(products, pdfLocale, { totalStartedAt: job.startedAt }),
  );

  if (!isCurrentWardrobePdfJob(email, job)) {
    return;
  }

  const updatedProfile = await updateProfilePdfByEmail(email, pdfBuffer, {
    expectedItems,
    expectedLocale,
  });
  job.status = "completed";
  job.updatedAt = Date.now();
  if (!updatedProfile) {
    return;
  }
}

async function runWardrobePdfJob({
  email,
  job,
  expectedItems,
  expectedLocale,
  resolvedItems,
  resolvedLocale,
  locale,
  getProfileByEmail,
  getProducts,
  buildPdfInChild,
  updateProfilePdfByEmail,
}: {
  email: string;
  job: WardrobePdfJobState;
  expectedItems: unknown;
  expectedLocale: string | null;
  resolvedItems: WardrobePdfItemLike[];
  resolvedLocale: string;
  locale: string | null;
} & StartWardrobePdfJobDeps) {
  const { items, pdfLocale } = await resolveWardrobePdfJobInput(email, job, {
    resolvedItems,
    resolvedLocale,
    locale,
    getProfileByEmail,
  });

  await buildAndStoreWardrobePdf({
    email,
    job,
    items,
    pdfLocale,
    expectedItems,
    expectedLocale,
    getProducts,
    buildPdfInChild,
    updateProfilePdfByEmail,
  });
}

function createStartWardrobePdfJob({
  getProfileByEmail,
  updateProfilePdfByEmail,
  getProducts,
  buildPdfInChild,
}: StartWardrobePdfJobDeps) {
  function startWardrobePdfJob(
    email: string,
    { wardrobePayload = null, locale = null }: WardrobePdfJobOptions = {},
  ) {
    const expectedItems = wardrobePayload ?? null;
    const expectedLocale = locale ?? null;
    const resolvedItems = sortWardrobeItems(
      wardrobePayload && !Array.isArray(wardrobePayload)
        ? getStoredWardrobeItems({ items: wardrobePayload })
        : getStoredWardrobeItems({ items: wardrobePayload }),
    );
    const resolvedLocale = getPdfLocale(locale);
    const generationKey = createWardrobePdfGenerationKey({
      items: resolvedItems,
      locale: resolvedLocale,
    });
    const existing = getWardrobePdfJob(email);

    if (
      existing?.status === "pending" &&
      existing.generationKey === generationKey
    ) {
      return existing;
    }

    const job: WardrobePdfJobState = {
      status: "pending",
      updatedAt: Date.now(),
      startedAt: Date.now(),
      generationKey,
      error: null,
      promise: null,
    };
    setWardrobePdfJob(email, job);

    job.promise = (async () => {
      try {
        await runWardrobePdfJob({
          email,
          job,
          expectedItems,
          expectedLocale,
          resolvedItems,
          resolvedLocale,
          locale,
          getProfileByEmail,
          getProducts,
          buildPdfInChild,
          updateProfilePdfByEmail,
        });
      } catch (error) {
        if (!isCurrentWardrobePdfJob(email, job)) {
          return;
        }
        job.status = "failed";
        job.updatedAt = Date.now();
        job.error = error;
        logError("[wardrobe-pdf][job]", error);
      } finally {
        scheduleWardrobePdfJobCleanup(email, job);
      }
    })();

    return job;
  }

  return startWardrobePdfJob;
}

function createEnsureWardrobePdfJob({
  getProfileByEmail,
  startWardrobePdfJob,
}: {
  getProfileByEmail: typeof getProfile;
  startWardrobePdfJob: (
    email: string,
    options?: WardrobePdfJobOptions,
  ) => WardrobePdfJobState;
}) {
  async function resolveEnsureOptions(
    email: string,
    options: WardrobePdfJobOptions,
  ) {
    const wardrobePayload = options.wardrobePayload || null;
    const locale = options.locale || null;

    if (wardrobePayload && locale) {
      return { wardrobePayload, locale };
    }

    const profile = await getProfileByEmail(email);
    if (!profile) {
      return null;
    }

    return {
      wardrobePayload: wardrobePayload || profile.items,
      locale: locale || String(profile.locale || "en"),
    };
  }

  async function ensureWardrobePdfJob(
    email: string,
    options: WardrobePdfJobOptions = {},
  ) {
    const existing = getWardrobePdfJob(email);
    if (existing?.status === "pending") {
      return existing;
    }

    if (existing?.status === "failed") {
      deleteWardrobePdfJob(email);
    }

    const resolvedOptions = await resolveEnsureOptions(email, options);
    if (!resolvedOptions) {
      return null;
    }

    const items = sortWardrobeItems(
      getStoredWardrobeItems({ items: resolvedOptions.wardrobePayload }),
    );
    if (items.length === 0) {
      return null;
    }

    return startWardrobePdfJob(email, resolvedOptions);
  }

  return ensureWardrobePdfJob;
}

export function createWardrobePdfJobManager({
  getProfileByEmail = getProfile,
  getProfilePdfByEmail = async () => null,
  getProfileWithPdfByEmail = null,
  updateProfilePdfByEmail = async () => ({ email: "unknown@example.com" }),
  getProducts = getProductsByUrlsInOrder,
  buildPdfInChild = buildWardrobePdfInChild,
}: WardrobePdfJobManagerDeps = {}) {
  const loadProfileWithPdf = createLoadProfileWithPdf({
    getProfileByEmail,
    getProfilePdfByEmail,
    getProfileWithPdfByEmail,
  });
  const startWardrobePdfJob = createStartWardrobePdfJob({
    getProfileByEmail,
    updateProfilePdfByEmail,
    getProducts,
    buildPdfInChild,
  });
  const ensureWardrobePdfJob = createEnsureWardrobePdfJob({
    getProfileByEmail,
    startWardrobePdfJob,
  });
  const downloadWardrobePdf = createDownloadWardrobePdf({
    loadProfileWithPdf,
    ensureWardrobePdfJob,
  });

  return {
    startWardrobePdfJob,
    ensureWardrobePdfJob,
    getWardrobePdfJob,
    downloadWardrobePdf,
  };
}
