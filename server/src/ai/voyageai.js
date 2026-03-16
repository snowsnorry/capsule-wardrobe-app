const VOYAGE_API_URL = "https://api.voyageai.com/v1/embeddings";
const DEFAULT_EMBEDDING_MODEL = "voyage-4-large";

function getVoyageApiKey() {
  const apiKey = process.env.VOYAGE_API_KEY;
  if (!apiKey) {
    throw new Error("VOYAGE_API_KEY is not set");
  }
  return apiKey;
}

async function getPromptEmbeddings(prompt) {
  const response = await fetch(VOYAGE_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getVoyageApiKey()}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      input: prompt,
      model: DEFAULT_EMBEDDING_MODEL,
      input_type: "query"
    })
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Failed to compute prompt embeddings: ${response.status} ${details}`);
  }

  const payload = await response.json();
  const embedding = payload?.data?.[0]?.embedding;
  if (!Array.isArray(embedding) || embedding.length === 0) {
    throw new Error("Failed to compute prompt embeddings");
  }

  return embedding;
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
  // 1. Process the audience field to make it read naturally
  const audienceRaw = userProfile?.audience || "any";
  let audienceText = "versatile (men's and women's)";
  
  if (audienceRaw !== 'any') {
    audienceText = `${audienceRaw}'s`;
  }

  // 2. Process the formality level
  const formality = userProfile?.formalityLevel || "any";

  // 3. Process seasons (handles both an array of strings and a single string)
  let seasonsText = 'any';
  if (Array.isArray(userProfile?.season) && userProfile?.season.length > 0) {
    seasonsText = userProfile.season.join(", ");
  } else if (typeof userProfile?.season === "string" && userProfile.season.trim() !== "") {
    seasonsText = userProfile.season;
  }

  // 4. Build the core query parts using semantic phrases 
  // that match the structure of the document embeddings
  const queryParts = [
    `Looking for ${audienceText} fashion items and clothing.`,
    `Suitable for a ${formality} dress code during the ${seasonsText} season.`
  ];

  // 5. Process wardrobe occasions dynamically
  let occasionsText = '';
  if (Array.isArray(userProfile?.occasions) && userProfile?.occasions.length > 0) {
    occasionsText = userProfile.occasions.join(", ");
  }
  
  // Aligning with the document embedding structure: "Ideal for {occasions}."
  if (occasionsText) {
    queryParts.push(`Ideal for ${occasionsText}.`);
  }

  // 5. Dynamically append optional fields if they are provided by the user
  if (userProfile?.style) {
    queryParts.push(`Designed in a ${userProfile?.style} style.`);
  }

  if (userProfile?.color) {
    queryParts.push(`Preferred color: ${userProfile.color}.`);
  }

  if (userProfile?.pattern) {
    queryParts.push(`Features a ${userProfile?.pattern} pattern.`);
  }

  // 6. Combine all parts into a single cohesive paragraph
  return queryParts.join(' ');
}

export { getPromptEmbeddings, getWardrobePrompt };
