import OpenAI from "openai";

const OPENAI_BASE_URL = "https://api.deepinfra.com/v1/openai";
const DEFAULT_CHAT_MODEL = "google/gemma-3-27b-it";
const DEFAULT_EMBEDDING_MODEL = "google/embeddinggemma-300m";
let cachedClient = null;

function getOpenAiClient() {
  if (cachedClient) {
    return cachedClient;
  }

  const apiKey = process.env.DEEPINFRA_API_KEY;
  if (!apiKey) {
    throw new Error("DEEPINFRA_API_KEY is not set");
  }

  cachedClient = new OpenAI({
    apiKey,
    baseURL: OPENAI_BASE_URL
  });
  return cachedClient;
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
    temperature: 0.4,
    response_format: {"type": "json_object"}
  });

  let content = response?.choices?.[0]?.message?.content || "{}";
  let json;
  if(content) {
    content = content.replace(/^[^{]*/, "").replace(/[^}]*$/, "");
  }
  try {
    json = JSON.parse(content);
  } catch {
    throw new Error(`Failed to parse JSON response`);
  }

  return { response, json };
}

export { generateJsonWithLlm, getPromptEmbeddings };
