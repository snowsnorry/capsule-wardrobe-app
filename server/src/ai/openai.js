import OpenAI from "openai";

function extractResponseText(response) {
  if (typeof response?.output_text === "string" && response.output_text.trim()) {
    return response.output_text.trim();
  }

  for (const outputItem of response?.output || []) {
    for (const contentItem of outputItem?.content || []) {
      if (contentItem?.type === "output_text" && typeof contentItem?.text === "string") {
        return contentItem.text.trim();
      }
    }
  }

  return "";
}

async function callOpenAiWardrobe({ model, prompt, allowedCategories, allowedDomains }) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await client.responses.create({
    model,
    input: [
      {
        role: "system",
        content: "Return only valid JSON. Do not include any extra text."
      },
      {
        role: "user",
        content: prompt
      }
    ],
    tools: [
      {
        type: "web_search",
        filters: { allowed_domains: allowedDomains }
      }
    ],
    tool_choice: "auto",
    include: ["web_search_call.action.sources"],
    text: {
      format: {
        type: "json_schema",
        name: "wardrobe_items",
        schema: {
          type: "object",
          additionalProperties: false,
          required: ["items"],
          properties: {
            items: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                required: ["category", "link"],
                properties: {
                  category: {
                    type: "string",
                    enum: Array.from(allowedCategories)
                  },
                  link: {
                    type: "string"
                  }
                }
              }
            }
          }
        }
      }
    }
  });

  const raw = extractResponseText(response);
  if (!raw) {
    throw new Error("OpenAI response does not contain output text");
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("OpenAI response is not valid JSON");
  }

  const parsedItems = Array.isArray(parsed) ? parsed : parsed?.items;
  if (!Array.isArray(parsedItems)) {
    throw new Error("OpenAI response must contain items array");
  }

  return parsedItems;
}

export { callOpenAiWardrobe };
