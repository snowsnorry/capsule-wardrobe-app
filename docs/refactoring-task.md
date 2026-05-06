# Codex Task: Refactor for Codebase Navigability

## Goal

Improve code readability, module cohesion, and navigability for future Codex-assisted work without changing application behavior.

Use Codex `/goal` mode for this task.

## Primary exit criteria

The goal is complete only when all gate checks pass:

```bash
npm run lint
npm run typecheck
npm test
npm run quality:deps
```

If the project has a combined quality command, also run:

```bash
npm run quality
```

Important: `quality:large-files` is a diagnostic report, not a pass/fail gate unless it is explicitly implemented to fail on thresholds.

## Diagnostic commands

Before choosing a refactoring target, run:

```bash
npm run quality:large-files
```

Use the output to identify the largest and most complex files.

Prefer targets that are:

- large application source files;
- files with mixed responsibilities;
- files with complex components/functions;
- files that are likely to block future Codex work.

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
- deciding whether the batch is complete.

## Batch discipline

Work in small, reviewable batches.

Default batch size:

- one large file;
- one cohesive responsibility extracted from a large file;
- one tightly related cluster of files.

After each batch:

1. Run the narrowest relevant test.
2. Run `npm run lint`.
3. Run `npm run typecheck`.
4. Run broader checks if the touched area is cross-cutting.

Do not continue refactoring new areas while validation is red.

## Architectural decomposition rule

Split code only along logical architectural boundaries.

Allowed decomposition patterns:

- UI rendering separated from state orchestration;
- presentational components separated from container components;
- custom hooks separated from JSX-heavy components;
- pure helpers separated from side-effectful code;
- API/client logic separated from UI logic;
- mappers/normalizers separated from request or rendering code;
- constants/configuration separated from runtime logic;
- shared domain types separated from implementation details.

Do not split files arbitrarily just to reduce line count.

A split is valid only if the resulting files have clear responsibilities and meaningful names.

Bad refactoring examples:

- moving random functions to `utils.ts` without a coherent domain;
- creating generic `helpers.ts` files as dumping grounds;
- splitting one component into multiple files where each file still depends on most of the original context;
- extracting code that immediately requires broad bidirectional imports;
- introducing barrel files that obscure dependency direction.

Good refactoring examples:

- `SearchScreen.tsx` delegates filter state to `useSearchFilters.ts`;
- rendering-only item cards move to `WardrobeItemCard.tsx`;
- capsule payload transformation moves to `capsuleMappers.ts`;
- reusable type guards move to a focused domain helper;
- API request construction moves out of React components.

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
- remove unused imports and dead code;
- improve local naming when it clarifies intent.

## Forbidden changes

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

## ESLint warning policy

Do not add ignore comments for lint warnings.

Forbidden patterns include:

```ts
// eslint-disable-next-line
// eslint-disable-line
/* eslint-disable */
```

Do not weaken or remove ESLint rules to make a batch pass.

Do not ignore files, directories, or patterns merely because they produce warnings.

Do not hide warnings by moving code into ignored paths.

The only acceptable exception is a narrow, explicitly justified disable for a false positive that cannot reasonably be fixed without making the code worse. If such an exception is unavoidable, document:

- the exact rule;
- the exact line or block;
- why the warning is a false positive;
- why a code-level fix would be worse.

Prefer fixing warnings directly.

## Refactoring priorities

Prioritize by impact:

1. Files above 500 LOC.
2. Files that mix UI, state, API calls, mapping, validation, and side effects.
3. Components/functions above 100 LOC.
4. Files with high nesting or repeated conditional logic.
5. Files frequently imported by other modules.
6. Files that Codex would need to understand for future feature work.

Target state:

- application files preferably below 350 LOC;
- functions/components preferably below 80–100 LOC;
- no increase in lint warnings;
- no increase in dependency cycles;
- clearer responsibility boundaries.

These are guiding metrics, not reasons to split code mechanically.

## Validation protocol

For every batch, report the exact commands run and their results.

Minimum final validation:

```bash
npm run lint
npm run typecheck
npm test
npm run quality:deps
```

If available:

```bash
npm run quality
```

Also run:

```bash
npm run quality:large-files
```

Use it to report whether the refactoring improved the large-file inventory.

## Failure handling

If a validation command fails:

1. Determine whether the failure is caused by the current diff.
2. If caused by the current diff, fix it before continuing.
3. If pre-existing, document it clearly with command output summary.
4. Do not silence lint rules to pass the gate unless there is a narrow, justified false-positive reason.
5. Do not weaken TypeScript settings.

## Reporting format

At the end of each batch, report:

- files changed;
- responsibilities extracted;
- architectural boundaries introduced or clarified;
- behavior changes: yes/no;
- commands run;
- validation result;
- remaining warnings/errors, if any;
- large-file report delta;
- next recommended refactoring target.

## Completion definition

The `/goal` is complete when:

- `npm run lint` passes;
- `npm run typecheck` passes;
- `npm test` passes;
- `npm run quality:deps` passes;
- `npm run quality` passes if configured as a gate;
- no new circular dependencies are introduced;
- no behavior changes are introduced;
- no new lint ignores are introduced for warnings;
- touched code has clearer logical architectural boundaries;
- the final report identifies remaining high-value refactoring targets.
