import { readFileSync } from "node:fs";
import Mustache from "mustache";
import { parse as parseYaml } from "yaml";

type PromptTemplateRole = "system" | "user";

type PromptTemplateMessage = {
  role: PromptTemplateRole;
  content: string;
};

type PromptTemplate = {
  version: number;
  name: string;
  messages: PromptTemplateMessage[];
};

function normalizeTemplateRole(value: unknown): PromptTemplateRole | null {
  const role = typeof value === "string" ? value.trim().toLowerCase() : "";
  return role === "system" || role === "user" ? role : null;
}

function normalizeTemplateContent(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (!Array.isArray(value)) {
    return "";
  }

  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        return "";
      }

      const record = entry as Record<string, unknown>;
      return typeof record.text === "string" ? record.text.trim() : "";
    })
    .filter((part) => part.trim().length > 0)
    .join("\n\n");
}

function parsePromptTemplateYaml(
  source: string,
  sourceName = "prompt template",
): PromptTemplate {
  const parsed = parseYaml(source);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`Invalid ${sourceName}: expected a YAML object`);
  }

  const record = parsed as Record<string, unknown>;
  const version = Number(record.version);
  const name = typeof record.name === "string" ? record.name.trim() : "";
  const messages = Array.isArray(record.messages) ? record.messages : null;

  if (!Number.isInteger(version) || version < 1) {
    throw new Error(`Invalid ${sourceName}: expected positive integer version`);
  }

  if (!name) {
    throw new Error(`Invalid ${sourceName}: expected non-empty name`);
  }

  if (!messages || messages.length === 0) {
    throw new Error(`Invalid ${sourceName}: expected non-empty messages`);
  }

  return {
    version,
    name,
    messages: messages.map((message, index) => {
      if (!message || typeof message !== "object" || Array.isArray(message)) {
        throw new Error(
          `Invalid ${sourceName}: message ${index + 1} must be an object`,
        );
      }

      const messageRecord = message as Record<string, unknown>;
      const role = normalizeTemplateRole(messageRecord.role);
      const content = normalizeTemplateContent(messageRecord.content);

      if (!role) {
        throw new Error(
          `Invalid ${sourceName}: message ${index + 1} has unsupported role`,
        );
      }

      if (!content.trim()) {
        throw new Error(
          `Invalid ${sourceName}: message ${index + 1} has empty content`,
        );
      }

      return {
        role,
        content,
      };
    }),
  };
}

function loadPromptTemplate(templateUrl: URL): PromptTemplate {
  return parsePromptTemplateYaml(
    readFileSync(templateUrl, "utf8"),
    templateUrl.pathname,
  );
}

function getPromptTemplateContent(
  template: PromptTemplate,
  role: PromptTemplateRole,
) {
  return template.messages
    .filter((message) => message.role === role)
    .map((message) => message.content.trim())
    .join("\n\n")
    .trim();
}

function hasTemplateValue(view: Record<string, unknown>, key: string) {
  const path = key
    .split(".")
    .map((part) => part.trim())
    .filter(Boolean);
  if (path.length === 0) {
    return false;
  }

  let current: unknown = view;
  for (const part of path) {
    if (
      !current ||
      typeof current !== "object" ||
      !Object.prototype.hasOwnProperty.call(current, part)
    ) {
      return false;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return true;
}

function getMissingTemplateKeys(
  template: string,
  view: Record<string, unknown>,
) {
  const keys = new Set<string>();
  for (const match of template.matchAll(
    /\{\{\{?\s*([#/^!>&=]?)\s*([^{}\s][^{}]*?)\s*\}?\}\}/g,
  )) {
    const sigil = match[1];
    if (sigil && sigil !== "&") {
      continue;
    }

    const key = String(match[2] || "").trim();
    if (!key || key === "." || key.includes(" ")) {
      continue;
    }
    keys.add(key);
  }

  return [...keys].filter((key) => !hasTemplateValue(view, key));
}

function renderPromptTemplateContent(
  template: string,
  view: Record<string, unknown> = {},
  errorPrefix = "prompt",
) {
  const missingKeys = getMissingTemplateKeys(template, view);
  if (missingKeys.length > 0) {
    throw new Error(
      `Unresolved ${errorPrefix} placeholders: ${missingKeys.map((key) => `{{${key}}}`).join(", ")}`,
    );
  }

  const rendered = Mustache.render(template, view, undefined, {
    escape: (value) => String(value),
  });
  const unresolvedTokens = rendered.match(/\{\{[a-zA-Z0-9_]+\}\}/g);
  if (unresolvedTokens?.length) {
    throw new Error(
      `Unresolved ${errorPrefix} placeholders: ${unresolvedTokens.join(", ")}`,
    );
  }

  return rendered.replace(/\n{3,}/g, "\n\n").trim();
}

export {
  getPromptTemplateContent,
  loadPromptTemplate,
  parsePromptTemplateYaml,
  renderPromptTemplateContent,
};
