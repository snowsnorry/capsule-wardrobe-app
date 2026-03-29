import OpenAI from "openai";

const OPENAI_BASE_URL = "https://api.deepinfra.com/v1/openai";
const DEFAULT_CHAT_MODEL = "meta-llama/Llama-3.3-70B-Instruct-Turbo";
const DEFAULT_EMBEDDING_MODEL = "google/embeddinggemma-300m";
let cachedClient = null;

function createDeepInfraClient({
  createClientImpl = ({ apiKey, baseURL }) => new OpenAI({ apiKey, baseURL }),
  getApiKeyImpl = () => process.env.DEEPINFRA_API_KEY,
  cache = true
} = {}) {
  let localCachedClient = null;

  function getOpenAiClient() {
    if (cache && localCachedClient) {
      return localCachedClient;
    }

    const apiKey = getApiKeyImpl();
    if (!apiKey) {
      throw new Error("DEEPINFRA_API_KEY is not set");
    }

    const client = createClientImpl({
      apiKey,
      baseURL: OPENAI_BASE_URL
    });

    if (cache) {
      localCachedClient = client;
      cachedClient = client;
    }

    return client;
  }

  async function getPromptEmbeddings(prompt) {
    const client = getOpenAiClient();
    const response = await client.embeddings.create({
      model: DEFAULT_EMBEDDING_MODEL,
      input: prompt
    });
    const embedding = response?.data?.[0]?.embedding;
    if (!Array.isArray(embedding) || embedding.length === 0) {
      throw new Error("Failed to compute prompt embeddings");
    }
    return embedding;
  }

  async function generateJsonWithLlm(prompt) {
    const client = getOpenAiClient();
    const { system, user } = splitSystemAndUserPrompt(prompt);

    const response = await client.chat.completions.create({
      model: DEFAULT_CHAT_MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ],
      temperature: 0.2,
      top_p: 0.9,
      frequency_penalty: 0,
      presence_penalty: 0,
      max_tokens: 1000,
      response_format: { type: "json_object" }
    });

    let content = response?.choices?.[0]?.message?.content || "{}";
    let json;
    if (content) {
      content = content.replace(/^[^{]*/, "").replace(/[^}]*$/, "");
    }
    try {
      json = JSON.parse(content);
    } catch {
      throw new Error("Failed to parse JSON response");
    }

    return { response, json };
  }

  return {
    generateJsonWithLlm,
    getOpenAiClient,
    getPromptEmbeddings
  };
}

function splitSystemAndUserPrompt(prompt) {
  const source = String(prompt || "");
  const systemMarker = "System:";
  const userMarker = "User:";
  const systemStart = source.indexOf(systemMarker);
  const userStart = source.indexOf(userMarker);

  if (systemStart === -1 || userStart === -1 || userStart < systemStart) {
    return {
      system: "",
      user: source.trim()
    };
  }

  return {
    system: source.slice(systemStart + systemMarker.length, userStart).trim(),
    user: source.slice(userStart + userMarker.length).trim()
  };
}

const deepInfraClient = createDeepInfraClient();
const {
  generateJsonWithLlm,
  getOpenAiClient,
  getPromptEmbeddings
} = deepInfraClient;

export {
  createDeepInfraClient,
  generateJsonWithLlm,
  getOpenAiClient,
  getPromptEmbeddings,
  splitSystemAndUserPrompt
};
