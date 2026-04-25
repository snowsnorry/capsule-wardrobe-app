import test from "node:test";
import assert from "node:assert/strict";
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

  assert.equal(template.name, "sample");
  assert.equal(getPromptTemplateContent(template, "system"), "System {{value}}");
  assert.equal(getPromptTemplateContent(template, "user"), "User {{value}}");
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

  assert.equal(getPromptTemplateContent(template, "system"), "");
  assert.equal(getPromptTemplateContent(template, "user"), "Draw {{description}}");
});

test("renderPromptTemplateContent renders Mustache placeholders without HTML escaping", () => {
  const rendered = renderPromptTemplateContent("JSON: {{payload}}", {
    payload: "{\"name\":\"A&B\",\"items\":[\"<top>\"]}"
  });

  assert.equal(rendered, "JSON: {\"name\":\"A&B\",\"items\":[\"<top>\"]}");
});

test("renderPromptTemplateContent throws for unresolved placeholders", () => {
  assert.throws(
    () => renderPromptTemplateContent("Hello {{name}} {{missing}}", { name: "Ada" }, "test prompt"),
    /Unresolved test prompt placeholders: \{\{missing\}\}/
  );
});

test("parsePromptTemplateYaml rejects invalid messages", () => {
  assert.throws(
    () => parsePromptTemplateYaml(`
version: 1
name: bad
messages:
  - role: assistant
    content: Nope
`),
    /unsupported role/
  );
});
