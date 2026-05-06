# Codex Task: Refactor for Codebase Navigability

## Goal

Improve code readability, module cohesion, and navigability for future Codex-assisted work without changing application behavior.

Use Codex `/goal` mode for this task.

The goal is not to reduce line count mechanically. The goal is to make the codebase easier to understand, modify, and validate.

## Authoritative hard gate

The goal is **not complete** until this command exits with status code `0`:

```bash
npm run quality:gate
```

Do not mark the goal as complete if `npm run quality:gate` fails for any reason.

Do not treat warnings as acceptable. A successful final state means:

- ESLint reports zero errors and zero warnings;
- TypeScript reports zero errors;
- tests pass;
- dependency-cruiser reports no dependency violations;
- the large-file strict gate reports no files above the configured LOC threshold.

## Required final validation

Run this before marking the goal complete:

```bash
npm run quality:gate
```

Also run the diagnostic report:

```bash
npm run quality:large-files
```

`quality:large-files` is used for reporting and prioritization. The authoritative pass/fail command is `quality:gate`.

## Recommended package scripts

The repository should expose scripts with this behavior:

```json
{
  "scripts": {
    "lint": "eslint .",
    "lint:strict": "eslint . --max-warnings=0",
    "lint:fix": "eslint . --fix",
    "quality:large-files": "find client/src server/src shared -type f \\( -name \"*.ts\" -o -name \"*.tsx\" -o -name \"*.js\" -o -name \"*.jsx\" \\) -not -path \"*/node_modules/*\" -not -path \"*/dist/*\" -not -path \"*/build/*\" -exec wc -l {} + | sort -nr | head -40",
    "quality:large-files:strict": "node scripts/check-large-files.mjs",
    "quality:deps": "depcruise client/src server/src shared --config .dependency-cruiser.cjs",
    "quality:gate": "npm run lint:strict && npm run typecheck && npm test && npm run quality:deps && npm run quality:large-files:strict",
    "quality": "npm run quality:gate && npm run quality:large-files"
  }
}
```

If the current repository uses different script names for typecheck or tests, adapt the script names but preserve the same semantics.

## Lint warning policy

Lint warnings are not acceptable in the final state.

Do not ignore, suppress, hide, or bypass lint warnings.

Forbidden unless explicitly approved by the user:

- adding `eslint-disable`;
- adding `eslint-disable-next-line`;
- adding `eslint-disable-file`;
- weakening lint rules;
- changing lint rules from `error` or `warn` to `off`;
- moving files into ESLint `ignores`;
- excluding source files from the lint scope;
- using `--quiet` to hide warnings;
- increasing `--max-warnings` above `0`;
- deleting code only to silence warnings without checking behavior;
- changing TypeScript settings to avoid lint or type errors.

The correct fix for a lint warning is to improve the code, remove dead code safely, narrow types, split responsibilities, or adjust the implementation pattern.

## Large-file policy

Large files must be split by logical architectural responsibility, not by arbitrary line count.

Valid extraction boundaries:

- presentational UI components;
- container/state orchestration components;
- custom React hooks;
- pure helper functions;
- constants/configuration;
- type definitions;
- API adapters;
- mappers/normalizers;
- validation logic;
- domain-specific utilities;
- test fixtures or test helpers, when relevant.

Invalid extraction patterns:

- splitting a file into `part1`, `part2`, `misc`, `stuff`, `helpers2`, or similar vague modules;
- moving unrelated functions together only to reduce LOC;
- creating broad barrel files that obscure dependencies;
- introducing abstractions with no domain meaning;
- moving code across `client`, `server`, and `shared` boundaries without architectural justification;
- splitting a cohesive component into many tiny files when that makes navigation worse.

Reducing LOC is not sufficient. The resulting module boundaries must be more coherent than before.


## Test file policy

When production code is split into new files, the related tests must be split or added using matching logical boundaries.

The test structure should make it obvious which production module is covered by which test module.

Preferred naming patterns:

- `foo.ts` -> `foo.test.ts`;
- `foo.tsx` -> `foo.test.tsx`;
- `useFoo.ts` -> `useFoo.test.ts`;
- `FooPanel.tsx` -> `FooPanel.test.tsx`;
- `fooMapper.ts` -> `fooMapper.test.ts`.

When extracting logic from a large file:

1. Move or create tests for the extracted logic into a corresponding test file.
2. Keep tests close to the module they cover, following the repository's existing test placement style.
3. Preserve existing coverage for behavior that remains in the original file.
4. Prefer focused tests for pure helpers, mappers, validators, hooks, and state orchestration logic.
5. Keep integration-style tests at the original boundary when they validate behavior across several extracted modules.
6. Update imports in existing tests after moving code.
7. Do not leave all coverage in a large legacy test file if the production code has been split into clear modules.

Valid outcomes:

- extracted helper `buildCapsulePayload.ts` is covered by `buildCapsulePayload.test.ts`;
- extracted hook `useCapsuleFilters.ts` is covered by `useCapsuleFilters.test.ts` or an existing hook-level test file with an explicit matching scope;
- extracted presentational component `CapsuleSettingsPanel.tsx` is covered by `CapsuleSettingsPanel.test.tsx` when it contains meaningful conditional rendering or user interactions;
- original screen-level tests remain only for end-to-end behavior of the composed screen.

Invalid outcomes:

- extracting several modules but leaving all tests in the old monolithic `Screen.test.tsx` without module-specific coverage;
- creating vague test files such as `helpers.test.ts`, `misc.test.ts`, `utils2.test.ts`, or `refactor.test.ts`;
- deleting or weakening tests to make refactoring easier;
- changing test expectations to match accidental behavior changes;
- skipping tests for extracted pure logic because the old integration test still happens to pass.

Test splitting should follow the same architectural logic as production code splitting. The goal is traceable coverage, not more files for their own sake.

## Diagnostic commands

Before choosing a refactoring target, run:

```bash
npm run quality:large-files
```

Use the output to identify high-impact targets.

Prefer targets that are:

- large application source files;
- files with mixed responsibilities;
- files with complex components/functions;
- files with high nesting or repeated conditional logic;
- files frequently imported by other modules;
- files likely to block future Codex work.

## Refactoring priorities

Prioritize by impact:

1. Files above the configured strict LOC threshold.
2. Files that mix UI, state, API calls, mapping, validation, and side effects.
3. Components/functions above 100 LOC.
4. Files with high nesting or repeated conditional logic.
5. Files frequently imported by other modules.
6. Files that Codex would need to understand for future feature work.

Target state:

- no files above the configured strict LOC threshold;
- application files preferably below 350 LOC over time;
- functions/components preferably below 80-100 LOC;
- no increase in lint warnings;
- no increase in dependency cycles;
- clearer responsibility boundaries.

These are guiding metrics, not permission to split code mechanically.

## Allowed refactoring moves

Prefer these changes:

- extract presentational React components;
- extract custom hooks from large components;
- extract pure helper functions;
- extract constants/configuration;
- extract type definitions;
- extract mappers/normalizers;
- split API/client logic from UI logic;
- split state orchestration from rendering;
- reduce deeply nested conditionals;
- remove unused imports and dead code when safe;
- improve local naming when it clarifies intent.

## Forbidden behavior changes

Do not change behavior unless explicitly requested.

Do not change:

- UI behavior;
- visual design;
- API contracts;
- database schema;
- auth/session behavior;
- environment variable names;
- localization keys or translation semantics;
- route names;
- persistence format;
- generated capsule structure;
- existing test expectations unless they are clearly coupled to moved code and behavior remains identical.

Do not introduce:

- circular dependencies;
- broad barrel files;
- global state as a convenience refactor;
- new libraries unless explicitly justified;
- abstractions whose only purpose is reducing line count;
- mechanical file splitting that makes navigation worse.

## Sub-agent policy

Sub-agents may be used for validation after code changes.

Allowed sub-agent responsibilities:

- run lint/typecheck/tests/quality commands;
- inspect failing output;
- identify the likely source of failures;
- report whether failures are caused by the current diff or pre-existing issues.

Sub-agents should not make code changes unless explicitly assigned a separate implementation task.

The main agent remains responsible for:

- interpreting validation failures;
- applying fixes;
- keeping the diff scoped;
- deciding whether the batch is complete;
- ensuring `npm run quality:gate` exits with status code `0`.

## Batch discipline

Work in small, reviewable batches.

Default batch size:

- one large file; or
- one cohesive responsibility extracted from a large file; or
- one tightly related cluster of files.

After each batch:

1. Run the narrowest relevant test.
2. Run `npm run lint:strict`.
3. Run `npm run typecheck`.
4. Run broader checks if the touched area is cross-cutting.

Do not continue refactoring new areas while validation is red.

## Failure handling

If a validation command fails:

1. Determine whether the failure is caused by the current diff.
2. If caused by the current diff, fix it before continuing.
3. If pre-existing, document it clearly with a command output summary.
4. Do not mark the goal complete while the authoritative hard gate fails.
5. Do not silence lint rules to pass the gate unless the user explicitly approves it.
6. Do not weaken TypeScript settings.
7. Do not hide warnings by changing scripts.

## Reporting format

At the end of each batch, report:

- files changed;
- responsibilities extracted;
- tests added, moved, or updated;
- behavior changes: yes/no;
- commands run;
- validation result;
- remaining warnings/errors, if any;
- large-file report delta;
- next recommended refactoring target.

## Completion definition

The `/goal` is complete only when:

- `npm run quality:gate` exits with status code `0`;
- ESLint has zero errors and zero warnings;
- TypeScript has zero errors;
- tests pass;
- dependency-cruiser reports no dependency violations;
- the large-file strict gate passes;
- no behavior changes are introduced;
- touched code has clearer module boundaries;
- extracted logic has corresponding tests with matching names or clearly justified existing coverage;
- final report identifies remaining high-value refactoring targets, if any.

If any of these conditions is not met, the goal is not complete.
