const VOYAGE_API_URL = "https://api.voyageai.com/v1/embeddings";
const DEFAULT_EMBEDDING_MODEL = "voyage-4-large";

type VoyageResponseLike = {
  ok: boolean;
  status?: number;
  text?: () => Promise<string>;
  json?: () => Promise<unknown>;
};

type VoyageFetchLike = (
  input: string,
  init?: RequestInit,
) => Promise<VoyageResponseLike>;

function createVoyageClient({
  fetchImpl = fetch as VoyageFetchLike,
  getVoyageApiKeyImpl = () => {
    const apiKey = process.env.VOYAGE_API_KEY;
    if (!apiKey) {
      throw new Error("VOYAGE_API_KEY is not set");
    }
    return apiKey;
  },
} = {}) {
  async function getPromptEmbeddings(prompt) {
    const response = await fetchImpl(VOYAGE_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getVoyageApiKeyImpl()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: prompt,
        model: DEFAULT_EMBEDDING_MODEL,
        input_type: "query",
      }),
    });

    if (!response.ok) {
      const details = response.text ? await response.text() : "";
      throw new Error(
        `Failed to compute prompt embeddings: ${response.status} ${details}`,
      );
    }

    const payload = (await (response.json
      ? response.json()
      : Promise.resolve({}))) as { data?: Array<{ embedding?: number[] }> };
    const embedding = payload?.data?.[0]?.embedding;
    if (!Array.isArray(embedding) || embedding.length === 0) {
      throw new Error("Failed to compute prompt embeddings");
    }

    return embedding;
  }

  return { getPromptEmbeddings };
}

/**
 * Generates a natural language query optimized for the voyage-4-large model
 * based on user-selected capsule wardrobe filters.
 *
 * @param {Object} userProfile - The filters selected by the user.
 * @param {string} userProfile.audience - 'man', 'woman', or 'any'.
 * @param {string} userProfile.formalityLevel - E.g., 'smart_casual', 'casual'.
 * @param {string|string[]} userProfile.season - E.g., 'autumn' or ['autumn', 'winter'].
 * @param {string} [userProfile.style] - E.g., 'minimalistic' (optional).
 * @param {string} [userProfile.color] - E.g., 'burgundy' (optional).
 * @param {string} [userProfile.pattern] - E.g., 'check' (optional).
 * @returns {string} The semantic query string ready for the embedding model.
 */
function getWardrobePrompt(userProfile = null) {
  const queryParts = [
    `Looking for ${getAudiencePromptText(userProfile)} fashion items and clothing.`,
    `Suitable for a ${userProfile?.formalityLevel || "any"} dress code during the ${getSeasonPromptText(userProfile)} season.`,
  ];

  queryParts.push(...getOptionalPromptParts(userProfile));
  return queryParts.join(" ");
}

function getAudiencePromptText(userProfile) {
  const audienceRaw = userProfile?.audience || "any";
  return audienceRaw === "any"
    ? "versatile (men's and women's)"
    : `${audienceRaw}'s`;
}

function getSeasonPromptText(userProfile) {
  const season = userProfile?.season;
  if (Array.isArray(season) && season.length > 0) {
    return season.join(", ");
  }
  return typeof season === "string" && season.trim() !== "" ? season : "any";
}

function getOptionalPromptParts(userProfile) {
  return [
    getOccasionPromptPart(userProfile),
    userProfile?.style ? `Designed in a ${userProfile.style} style.` : "",
    userProfile?.color ? `Preferred color: ${userProfile.color}.` : "",
    userProfile?.pattern ? `Features a ${userProfile.pattern} pattern.` : "",
    getAdditionalPromptPart(userProfile),
  ].filter(Boolean);
}

function getOccasionPromptPart(userProfile) {
  return Array.isArray(userProfile?.occasions) &&
    userProfile.occasions.length > 0
    ? `Ideal for ${userProfile.occasions.join(", ")}.`
    : "";
}

function getAdditionalPromptPart(userProfile) {
  const additionalText =
    typeof userProfile?.text === "string" ? userProfile.text.trim() : "";
  return additionalText ? `Additional request: ${additionalText}.` : "";
}

const voyageClient = createVoyageClient();
const { getPromptEmbeddings } = voyageClient;

export { createVoyageClient, getPromptEmbeddings, getWardrobePrompt };
