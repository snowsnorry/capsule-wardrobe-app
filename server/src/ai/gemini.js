import { GoogleGenAI } from "@google/genai";

function extractGeminiText(response) {
  const text = response?.candidates?.[0]?.content?.parts?.find((part) => typeof part?.text === "string")?.text;
  if (typeof text === "string" && text.trim()) {
    return text.trim();
  }
  return "";
}

function stripMarkdownCodeFence(raw) {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("```")) {
    return trimmed;
  }

  const withoutStart = trimmed.replace(/^```(?:json)?\s*/i, "");
  const withoutEnd = withoutStart.replace(/\s*```$/, "");
  return withoutEnd.trim();
}

async function callGeminiWardrobe({ model, prompt, allowedCategories, allowedDomains }) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not set");
  }

  const domainRules = allowedDomains.map((domain) => `- ${domain}`).join("\n");
  const enforcedPrompt = `${prompt}\n\nUse only links from these domains:\n${domainRules}`;
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const response = await ai.models.generateContent({
    model,
    contents: enforcedPrompt,
    config: {
      systemInstruction: "Return only valid JSON. Do not include any extra text.",
      tools: [{ googleSearch: {} }],
      temperature: 0.2
    }
  });

  const raw = typeof response.text === "string" ? response.text.trim() : extractGeminiText(response);
  if (!raw) {
    throw new Error("Gemini response does not contain output text");
  }

  let parsed;
  try {
    parsed = JSON.parse(stripMarkdownCodeFence(raw));
  } catch {
    throw new Error("Gemini response is not valid JSON");
  }

  const parsedItems = Array.isArray(parsed) ? parsed : parsed?.items;
  if (!Array.isArray(parsedItems)) {
    throw new Error("Gemini response must contain items array");
  }

  console.log(JSON.stringify(parsedItems, null, 2));
  const allowed = new Set(Array.from(allowedCategories));
  return parsedItems.filter((item) => item && typeof item === "object" && allowed.has(item.category));
}

export { callGeminiWardrobe };
