import { test, expect } from "vitest";
import {
  getPromptTemplateContent,
  parsePromptTemplateYaml,
  renderPromptTemplateContent
} from "./promptTemplates.js";

test("parsePromptTemplateYaml parses system and user messages", () => {
  const template = parsePromptTemplateYaml(`
version: 1
name: sample
messages:
  - role: system
    content: |
      System {{value}}
  - role: user
    content: |
      User {{value}}
`);

  expect(template.name).toBe("sample");
  expect(getPromptTemplateContent(template, "system")).toBe("System {{value}}");
  expect(getPromptTemplateContent(template, "user")).toBe("User {{value}}");
});

test("parsePromptTemplateYaml supports user-only templates", () => {
  const template = parsePromptTemplateYaml(`
version: 1
name: image_generation
messages:
  - role: user
    content: |
      Draw {{description}}
`);

  expect(getPromptTemplateContent(template, "system")).toBe("");
  expect(getPromptTemplateContent(template, "user")).toBe("Draw {{description}}");
});

test("renderPromptTemplateContent renders Mustache placeholders without HTML escaping", () => {
  const rendered = renderPromptTemplateContent("JSON: {{payload}}", {
    payload: "{\"name\":\"A&B\",\"items\":[\"<top>\"]}"
  });

  expect(rendered).toBe("JSON: {\"name\":\"A&B\",\"items\":[\"<top>\"]}");
});

test("renderPromptTemplateContent throws for unresolved placeholders", () => {
  expect(() => renderPromptTemplateContent("Hello {{name}} {{missing}}", { name: "Ada" }, "test prompt")).toThrow(/Unresolved test prompt placeholders: \{\{missing\}\}/);
});

test("parsePromptTemplateYaml rejects invalid messages", () => {
  expect(() => parsePromptTemplateYaml(`
version: 1
name: bad
messages:
  - role: assistant
    content: Nope
`)).toThrow(/unsupported role/);
});
