const E2E_BASE_URL = process.env.E2E_BASE_URL || "http://127.0.0.1:5310";

export const E2E_EMAIL = "playwright@example.test";
export const E2E_CODE = "654321";

export function buildE2ePasskeyDependencies() {
  return {
    listPasskeysImpl: async () => [],
    insertPasskeyImpl: async () => null,
    getPasskeyByCredentialIdImpl: async () => null,
    updatePasskeyAuthenticationImpl: async () => null,
    deletePasskeyByIdForEmailImpl: async () => true,
    insertPasskeyChallengeImpl: async () => {},
    consumePasskeyChallengeImpl: async () => null,
    pruneExpiredPasskeyChallengesImpl: async () => {},
    generateRegistrationOptionsImpl: async () => ({
      challenge: "e2e-registration-challenge",
      pubKeyCredParams: [],
      rp: { id: "127.0.0.1", name: "Capsule Wardrobe E2E" },
      user: { id: E2E_EMAIL, name: E2E_EMAIL, displayName: E2E_EMAIL },
    }),
    verifyRegistrationResponseImpl: async () => ({ verified: false }),
    generateAuthenticationOptionsImpl: async () => ({
      challenge: "e2e-authentication-challenge",
      rpId: "127.0.0.1",
      userVerification: "required",
    }),
    verifyAuthenticationResponseImpl: async () => ({ verified: false }),
  };
}

export function e2eImageUrl(name: string): string {
  return `${E2E_BASE_URL}/__e2e/images/${encodeURIComponent(name)}.svg`;
}

export function buildE2eProfile(email = E2E_EMAIL) {
  return {
    id: "profile-e2e",
    email,
    activeCapsuleId: null,
    locale: "en",
    fullname: "Playwright User",
    theme: "system",
    llm: "openai:gpt-5.5",
    imageLlm: "openai:gpt-image-2",
    formalityLevel: "casual",
    style: "minimalistic",
    occasions: ["office"],
    season: ["spring"],
    audience: "woman",
    color: "navy",
    pattern: "solid",
    text: "",
  };
}

export function buildE2eWardrobeItems() {
  return [
    {
      id: "top-e2e",
      name: "Navy relaxed shirt",
      category: "top",
      brand: "E2E Studio",
      price: 79,
      currency: "EUR",
      url: "https://example.test/products/navy-shirt",
      imageUrl: e2eImageUrl("navy-shirt"),
      description: "A deterministic e2e shirt fixture.",
      color: "navy",
      formalityLevel: "casual",
      style: "minimalistic",
      season: ["spring"],
      occasions: ["office"],
      audience: "woman",
      pattern: "solid",
    },
    {
      id: "sporty-overshirt-e2e",
      name: "Sporty navy overshirt",
      category: "top",
      brand: "E2E Studio",
      price: 88,
      currency: "EUR",
      url: "https://example.test/products/sporty-navy-overshirt",
      imageUrl: e2eImageUrl("sporty-navy-overshirt"),
      description: "A deterministic filtered e2e overshirt fixture.",
      color: "navy",
      formalityLevel: "casual",
      style: "sporty",
      season: ["spring"],
      occasions: ["office"],
      audience: "woman",
      pattern: "solid",
    },
    {
      id: "bottom-e2e",
      name: "Straight black trousers",
      category: "bottom",
      brand: "E2E Studio",
      price: 99,
      currency: "EUR",
      url: "https://example.test/products/black-trousers",
      imageUrl: e2eImageUrl("black-trousers"),
      description: "A deterministic e2e trouser fixture.",
      color: "black",
      formalityLevel: "casual",
      style: "minimalistic",
      season: ["spring"],
      occasions: ["office"],
      audience: "woman",
      pattern: "solid",
    },
    {
      id: "shoes-e2e",
      name: "White leather sneakers",
      category: "shoes",
      brand: "E2E Studio",
      price: 120,
      currency: "EUR",
      url: "https://example.test/products/white-sneakers",
      imageUrl: e2eImageUrl("white-sneakers"),
      description: "A deterministic e2e sneaker fixture.",
      color: "white",
      formalityLevel: "casual",
      style: "minimalistic",
      season: ["spring"],
      occasions: ["office"],
      audience: "woman",
      pattern: "solid",
    },
  ];
}

function buildE2eRegeneratedWardrobeItems() {
  return [
    {
      id: "ready-top-e2e",
      name: "E2E Ready linen blazer",
      category: "top",
      brand: "E2E Ready Studio",
      price: 149,
      currency: "EUR",
      url: "https://example.test/products/ready-linen-blazer",
      imageUrl: e2eImageUrl("ready-linen-blazer"),
      description: "A deterministic e2e ready-state blazer fixture.",
      color: "sage",
      formalityLevel: "formal",
      style: "minimalistic",
      season: ["spring"],
      occasions: ["office"],
      audience: "woman",
      pattern: "solid",
    },
    {
      id: "ready-bottom-e2e",
      name: "E2E Ready tailored trousers",
      category: "bottom",
      brand: "E2E Ready Studio",
      price: 119,
      currency: "EUR",
      url: "https://example.test/products/ready-tailored-trousers",
      imageUrl: e2eImageUrl("ready-tailored-trousers"),
      description: "A deterministic e2e ready-state trouser fixture.",
      color: "charcoal",
      formalityLevel: "formal",
      style: "minimalistic",
      season: ["spring"],
      occasions: ["office"],
      audience: "woman",
      pattern: "solid",
    },
    {
      id: "ready-shoes-e2e",
      name: "E2E Ready almond loafers",
      category: "shoes",
      brand: "E2E Ready Studio",
      price: 135,
      currency: "EUR",
      url: "https://example.test/products/ready-almond-loafers",
      imageUrl: e2eImageUrl("ready-almond-loafers"),
      description: "A deterministic e2e ready-state loafer fixture.",
      color: "almond",
      formalityLevel: "formal",
      style: "minimalistic",
      season: ["spring"],
      occasions: ["office"],
      audience: "woman",
      pattern: "solid",
    },
  ];
}

export function buildE2eRegeneratedWardrobe() {
  return {
    items: buildE2eRegeneratedWardrobeItems(),
    outfitSets: [
      {
        itemIds: ["ready-top-e2e", "ready-bottom-e2e", "ready-shoes-e2e"],
        image: e2eImageUrl("ready-outfit-set"),
        imageObsolete: false,
      },
    ],
    rawSelectionText: "Mocked e2e ready regeneration response",
    swimwearReasoning: null,
    swimwearRawSelectionText: null,
  };
}

export function buildE2eCapsule() {
  return {
    id: "capsule-e2e",
    name: "Playwright capsule",
    draft: {
      filters: {
        formalityLevel: "casual",
        style: "minimalistic",
        occasions: ["office"],
        season: ["spring"],
        audience: "woman",
        color: "navy",
        pattern: "solid",
        text: "",
      },
      data: {
        wardrobe: {
          items: buildE2eWardrobeItems(),
          outfitSets: [
            {
              itemIds: ["top-e2e", "bottom-e2e", "shoes-e2e"],
              image: e2eImageUrl("outfit-set"),
              imageObsolete: false,
            },
          ],
          rawSelectionText: "Mocked e2e wardrobe response",
          swimwearReasoning: null,
          swimwearRawSelectionText: null,
        },
        rejectedUrls: [],
      },
    },
    saved: null,
    status: "new",
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
  };
}

export function buildE2eEmptyWardrobeCapsule() {
  const capsule = buildE2eCapsule();
  return {
    ...capsule,
    name: "Empty Playwright capsule",
    draft: {
      ...capsule.draft,
      data: {
        wardrobe: {
          items: [],
          outfitSets: [],
          rawSelectionText: null,
          swimwearReasoning: null,
          swimwearRawSelectionText: null,
        },
        rejectedUrls: [],
      },
    },
  };
}

export function buildE2eSearchPayload(payload: Record<string, unknown> = {}) {
  return {
    query: "",
    brand: [],
    priceMin: null,
    priceMax: null,
    audience: [],
    category: [],
    season: [],
    formalityLevel: [],
    style: [],
    occasions: [],
    color: [],
    pattern: [],
    silhouette: [],
    fit: [],
    closureType: [],
    page: 1,
    ...payload,
  };
}

export function buildE2eSavedSearchPayload() {
  return buildE2eSearchPayload({
    query: "saved navy office",
    category: ["top"],
    color: ["navy"],
  });
}

export function buildE2eSearchStats(payload: { category?: unknown } = {}) {
  const category =
    Array.isArray(payload.category) && payload.category.includes("top")
      ? [{ value: "top", count: 1 }]
      : [
          { value: "top", count: 2 },
          { value: "bottom", count: 1 },
        ];
  const total = category.reduce((sum, row) => sum + row.count, 0);

  return {
    total,
    stats: {
      category,
      color:
        total === 1
          ? [{ value: "navy", count: 1 }]
          : [
              { value: "navy", count: 2 },
              { value: "black", count: 1 },
            ],
      style:
        total === 1
          ? [{ value: "minimalistic", count: 1 }]
          : [
              { value: "minimalistic", count: 2 },
              { value: "sporty", count: 1 },
            ],
    },
    priceBuckets: [],
  };
}

export function buildE2eSearchOptions() {
  return {
    brands: [{ value: "e2e-studio", label: "E2E Studio" }],
    categories: ["top", "bottom", "shoes"],
    seasons: ["spring", "summer"],
    formalityLevels: ["casual", "formal"],
    styles: ["minimalistic", "sporty"],
    occasions: ["office", "date_night"],
    audience: ["woman", "man", "all"],
    colors: ["navy", "black", "white"],
    patterns: ["solid", "striped"],
    silhouettes: ["straight"],
    fits: ["regular"],
    closureTypes: ["buttons"],
    priceRange: { min: 10, max: 250 },
  };
}
