# Codex Task: Codebase Refactoring for Navigability

Use `docs/refactoring-quality-gate.md` as the source of truth.

## Goal

Improve code readability and navigability without changing behavior.

## Process

1. Run:

```bash
npm run quality:large-files
```

2. Pick the largest application source file that is safe to refactor.
3. Inspect nearby tests and imports.
4. Identify separable responsibilities.
5. Extract cohesive units only:
    * presentational components;
    * hooks;
    * pure helpers;
    * constants;
    * mappers;
    * types.
6. Do not change behavior, UI, API contracts, DB schema, auth/session behavior, env names, or localization semantics.
7. Run the narrowest relevant validation.
8. Run:

```bash
npm run quality:fast
```

9. Summarize:
    * files changed;
    * responsibilities extracted;
    * commands run;
    * remaining risks;
    * next suggested target from quality:large-files.

## Constraints

* Do not split files mechanically.
* Do not introduce barrel files unless there is a clear local benefit.
* Do not introduce new abstractions only to satisfy LOC metrics.
* Do not silence ESLint rules unless justified.
* Do not move shared code across client, server, and shared boundaries without checking dependency direction.