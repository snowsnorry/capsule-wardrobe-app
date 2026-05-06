# Refactoring Quality Gate

## Goal

Improve code navigability for future Codex-assisted work without changing application behavior.

## Required validation

Before a refactoring batch is considered complete, run:

```bash
npm run quality:fast
```

For larger batches or before merging, run:

```bash
npm run quality
```

## Metrics

Prefer improving these metrics in touched files:

1. Fewer files above 500 LOC.
2. Touched files should ideally stay below 350 LOC.
3. Functions/components should ideally stay below 80–100 LOC.
4. Cyclomatic complexity should not increase.
5. Nesting depth should not increase.
6. No new circular dependencies.
7. No new lint warnings.
8. No new TypeScript errors.
9. No behavior changes unless explicitly requested.

## Refactoring strategy

Start from:

```bash
npm run quality:large-files
```

For each large file:

1. Identify separate responsibilities.
2. Extract only cohesive units.
3. Prefer these extraction targets:
    * presentational components;
    * custom React hooks;
    * pure helpers;
    * constants;
    * type definitions;
    * API adapters;
    * mappers/normalizers.
4. Keep exports narrow.
5. Avoid mechanical file splitting.
6. Avoid changing UI, API contracts, DB schema, auth/session behavior, environment variable names, or localization semantics.

## Acceptance criteria

A refactoring batch is acceptable only if:

* relevant tests pass;
* npm run typecheck passes;
* npm run lint does not introduce new warnings;
* dependency-cruiser reports no new circular dependencies;
* large touched files become smaller or more cohesive;
* behavior remains unchanged.