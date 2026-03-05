import ollama from "ollama";

async function getPromptEmbeddings(prompt) {
  const response = await ollama.embeddings({
    model: "embeddinggemma",
    prompt
  });
  const embedding = response?.embedding;
  if (!Array.isArray(embedding) || embedding.length === 0) {
    throw new Error("Failed to compute prompt embeddings");
  }
  return embedding;
}

async function generateJsonWithLlm(prompt) {
  const response = await ollama.generate({
    model: "gemma3:27b",
    prompt,
    format: "json"
  });

  let json;
  try {
    json = JSON.parse(response?.response || "{}");
  } catch {
    throw new Error(`Failed to parse JSON response from ${model}`);
  }

  return { response, json };
}

export { getPromptEmbeddings, generateJsonWithLlm };
