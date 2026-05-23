Goal: Make `npm run quality:gate` pass.

You are working in the capsule-wardrobe-app repository.

The repository is a full-stack TypeScript npm-workspaces monorepo. Root scripts are the canonical entrypoint for cross-workspace validation.

Use the existing repository rules from AGENTS.md:
- Prefer minimal diffs.
- Do not refactor unrelated files.
- Preserve workspace boundaries unless the fix requires cross-cutting changes.
- Inspect nearest tests before editing implementation.
- Run validation commands sequentially, not in parallel.
- For Playwright/e2e validation, use the dedicated e2e setup via the root e2e command.
- Never read, search, print, parse, or use `.env` / `.env*` files unless explicitly asked.

## Preflight

Before editing anything:

1. Run:

   git status --short

2. If there are any existing uncommitted or staged changes, stop immediately and report:
   - the current git status;
   - that the working tree must be clean before starting this automated repair loop.

Do not edit files unless the working tree is clean.

## Staged quality-gate commands

Do not start by running the full `npm run quality:gate`.

Run these commands one by one, in this exact order:

1. npm run lint:strict
2. npm run typecheck
3. npm test
4. npm run quality:deps
5. npm run quality:large-files:strict
6. npm run coverage
7. npm run format:check
8. npm run quality:cycles
9. npm run quality:unused
10. npm run test:e2e

## Repair loop for each stage

For each command:

1. Run the command.
2. If it passes, continue to the next command.
3. If it fails:
   - inspect the failure output;
   - inspect the nearest relevant implementation files;
   - inspect the nearest relevant tests where applicable;
   - make the smallest safe fix;
   - do not perform broad cleanup;
   - do not refactor unrelated code;
   - do not change public API contracts unless the failure requires it;
   - do not change i18n-visible text in only one locale;
   - do not change auth, session, CSRF, passkey, MCP OAuth, DB, or deployment behavior incidentally.
4. Rerun the failing command until it passes.
5. If the fix affects TypeScript types or module boundaries, run the narrowest relevant typecheck command before committing.
6. If the fix affects tests, run the narrowest relevant test command before committing.
7. Once the repaired stage passes, commit the minimal relevant diff.

## Commit policy

You may create commits only after a failing stage has been fixed and the relevant validation passes.

Before every commit:

1. Run:

   git status --short

2. Review changed files.
3. Stage only relevant files by explicit path.
4. Do not use:

   git add .

5. Do not commit unrelated files.
6. Do not commit pre-existing user changes.
7. Use one focused commit per repaired gate stage.

Use concise conventional commit messages, for example:

- fix: resolve lint gate failure
- fix: resolve typecheck gate failure
- test: fix failing unit tests
- fix: resolve dependency boundary issue
- fix: reduce oversized source file
- test: restore coverage gate
- style: apply formatting
- fix: resolve circular dependency
- chore: remove unused code
- test: fix e2e gate failure

If `git commit` is blocked by sandbox policy, approval policy, missing Git identity, hooks, or repository state, stop and report:

- the files that should be committed;
- the exact `git add <paths>` command;
- the exact `git commit -m "<message>"` command;
- the validation command that passed.

Do not continue accumulating unrelated fixes without a commit unless committing is blocked.

## Formatting stage

When the staged command is:

npm run format:check

If it fails because files need formatting:

1. Run:

   npm run format

2. Then run:

   npm run format:check

3. If formatting changed files, commit those formatter changes with:

   style: apply formatting

Do not combine formatting-only changes with unrelated logic fixes unless the formatting was produced by a previous focused fix and is limited to the same files.

## Final full gate

After all staged commands pass, run:

npm run quality:gate

If the full gate passes, finish.

If the full gate fails:

1. Inspect the failure.
2. Fix it using the same minimal-diff rules.
3. Rerun:

   npm run quality:gate

4. When it passes, commit the fix with an appropriate conventional commit message.
5. Repeat until `npm run quality:gate` passes.

## Final response

When finished, report:

- final status;
- whether `npm run quality:gate` passed;
- commits created;
- commands run;
- any remaining risks, skipped checks, or manual commit commands if commit was blocked.