# Application Architecture and Performance Audit

Repeat audit date: 2026-07-05

Goal: reassess the architecture decisions, load resilience, edge-case behavior, and performance of the full-stack capsule wardrobe application after the fixes made from the previous audit. The analysis was a static code review. Read-only sub-agents were used in parallel for the frontend, search/DB/wardrobe, jobs/SSE, and production/API areas. Runtime profiling, load tests, and `EXPLAIN ANALYZE` were not run.

## Overall Findings

- No critical P0/stop-ship issues were found in the repeat static audit.
- Most previous P1 items are closed or materially reduced: product options are no longer scanned before every search, stats have bounded TTL/in-flight cache and concurrency limits, job state + event append are atomic, providerless queued jobs have a reconciler, the MCP handler has an error boundary, production startup has fail-fast preflight, and the Render build/quality gate/streaming proxy/R2 staging/observability baseline have improved.
- The main remaining performance risk is large user-owned lists: Personal items are still loaded and rendered in full, and Personal items report builds the prompt/collage from the whole wardrobe in one pass. Because the report evaluates wardrobe completeness, it must keep full wardrobe coverage; the missing piece is a scalable full-coverage pipeline, not dropping items from the analysis.
- Search/stats no longer look like an immediate architectural defect, but a cold cache miss for stats is still expensive, and the `products` performance contract is not an executable migration and is not backed by an automated plan/benchmark guard.
- Jobs now use `job_runs` as the durable source of truth for capsule generation, selected regeneration, reports, uploads, outfit image generation, outfit-set image generation, crash recovery, cancellation, and client waiting. The remaining job/SSE risk is DB polling cost per stream and broader queue/load policy, not legacy process-local execution state.
- Production readiness is better because of preflight and structured logs, but the Render health check is still the shallow `/health`; `/ready`/`/live`, scoped limits beyond job-event stream caps, and admin/internal metrics access are not complete.

## What Was Actually Closed Since the Previous Audit

- `server/src/searchOptionsCache.ts`: product options are cached with in-flight dedupe; profile-specific `styles` are cached separately.
- `server/src/db/searchStats.ts`: `/search/stats` got a 30s TTL, max 100 entries, in-flight dedupe, and `SEARCH_STATS_QUERY_CONCURRENCY = 4`.
- `server/src/db/sql/products_performance_contract.sql`: a repo-level contract for `products` indexes was added, and search SQL was aligned with indexable array/scalar/vector paths.
- `server/src/db/wardrobe.ts`, `server/src/wardrobeItemDisplay.ts`: `/wardrobe/items` no longer selects `embedding` and returns a list/display projection instead of internal fields.
- `server/src/routes/appBootstrapRoutes.ts`: sidebar bootstrap uses `wardrobeCount`, not the full wardrobe list.
- `server/src/jobs/jobQueue.ts`, `server/src/db/jobRunCreation.ts`, `server/src/db/jobRunLifecycle.ts`: providerless queued jobs, state transitions, and job events are covered by a minimal outbox/reconciler and atomic SQL CTEs.
- `server/src/jobs/jobQueue.ts`, `server/src/jobs/jobWorker.ts`, `server/src/db/jobRunLifecycle.ts`: stale `running` jobs are failed on worker startup with replayable events, unblocking active dedupe after a crash without automatic retry.
- `server/src/jobs/jobHandlers.ts`, `server/src/ai/*ReportService.ts`, AI/LLM/image provider adapters, generation/image runners: job handlers receive cooperative `AbortSignal`, pass it to supported providers, and gate final domain writes after abort/deadline.
- `server/src/jobs/jobHandlers.ts`, `server/src/ai/wardrobeJobService.ts`, `server/src/ai/regenerateSelectedServiceJobs.ts`, `server/src/ai/outfitImages.ts`, `server/src/ai/outfitSetImages.ts`, route modules: capsule generation, selected regeneration, outfit image generation, and outfit-set image generation execute as durable `job_runs`; production wiring no longer depends on process-local AI/image job maps.
- `server/src/routes/jobRoutes.ts`, `client/src/app/useActiveSidebarJobs.ts`: job event streams have server-side max duration/per-user caps, and app-level waiting delegates to the shared timed `waitForJob` watchdog.
- `server/src/jobs/jobWorker.ts`, upload handlers/runners: the worker deadline and `AbortSignal` now reach queued upload child runners.
- `server/src/mcp/mcpRoutes.ts`: the MCP route no longer discards the Promise; `createMcpServer` and transport handling are inside an error boundary.
- `server/src/startupPreflight.ts`, `server/src/serverStartup.ts`: production preflight runs before `ensureTables`/`listen` and validates critical configuration.
- `client/src/api/request.ts`: `getCachedJson` got a bounded LRU/TTL cache.
- `client/src/screens/outfitScreen/useOutfitCatalogPicker.ts`: the outfit catalog picker got a sequence guard against stale response overwrite.
- `client/render-server.js`, `server/src/jobs/stagedUploadStorage.ts`: the client-only Render proxy is stream-friendly for SSE/PDF/attachments, R2 staging no longer reads the staged upload fully into memory, and concurrent sends are limited.
- `server/src/appMiddleware.ts`, `server/src/logger.ts`, `server/src/observabilityMetrics.ts`: a baseline observability layer was added: request id, structured logs, latency/status metrics, release metadata, and a reserved internal metrics endpoint.

## Remaining Real Issues

### 1. Personal items screen/report still scale across the whole profile

Key areas:

- `server/src/routes/wardrobeRoutes.ts`
- `server/src/db/wardrobe.ts`
- `server/src/routes/personalItemsReportRoutes.ts`
- `server/src/ai/personalItemsReportService.ts`
- `server/src/ai/personalItemsReportPrompt.ts`
- `client/src/screens/useWardrobeItems.ts`
- `client/src/screens/usePersonalItemsReport.ts`
- `client/src/screens/WardrobeGrid.tsx`

Done:

- `/wardrobe/items` no longer selects `embedding`.
- A lightweight display/list projection is returned externally.
- Sidebar count was moved into `GET /app/bootstrap`.

Remaining:

- `/wardrobe/items` returns the whole profile without pagination/cursor.
- On initial load, the Personal items screen performs at least two unbounded wardrobe-related reads: the list itself and `/wardrobe/items/report`, which reads the whole wardrobe again for a URL-only stale check.
- Personal items screen grid (`client/src/screens/WardrobeGrid.tsx`) renders `items.map(...)` without virtualization/windowing. The virtualization from `99e709a` applies to `client/src/screens/mainScreen/MainScreenWardrobe.tsx` and `MainScreenVirtualWardrobeGrid.tsx`, meaning the main/capsule wardrobe grid, not the Personal items screen.
- Personal report takes the whole wardrobe, puts all report items into one JSON prompt, and builds a collage from all available images in one request path.
- The report staleness snapshot compares only the URL set; metadata/category/image/source changes without URL changes do not make the report stale.
- The `personalItemsReport` dedupe key includes raw user context without a hash/length cap and participates in the indexed active dedupe key.

Impact: large wardrobe profiles will disproportionately increase DB egress, Node heap, JSON parse time, DOM/render cost, and the risk of LLM/image payload failures unless the report is split into full-coverage chunks, summaries, or staged passes.

### 2. Search/stats hot path is mitigated, but not fully closed

Key areas:

- `server/src/searchStore.ts`
- `server/src/searchOptionsCache.ts`
- `server/src/db/searchStats.ts`
- `server/src/db/searchStatsQueries.ts`
- `server/src/db/sql/products_performance_contract.sql`
- `client/src/screens/statisticsScreen/useStatisticsActions.ts`
- `server/src/routes/searchRoutes.ts`
- `server/src/db/likedItems.ts`

Done:

- Product option dictionaries are no longer rebuilt before every search.
- Stats cache has bounded TTL/LRU and in-flight dedupe.
- Stats query concurrency is limited.
- The index contract for the external `products` catalog is documented.

Remaining:

- `products_performance_contract.sql` intentionally is not executed by `ensureTables()`, so production performance depends on applying the indexes manually.
- There are no automated `EXPLAIN`/smoke benchmark checks for search/count/stats.
- A cold stats miss launches a set of separate SQL tasks: total, 12 facets, and price buckets. Cache reduces repeated requests, but not the cost of a unique filter.
- Statistics UI sends `/search/stats` on every facet toggle without debounce/sequence guard; fast clicks can create many unique cache misses.
- `/search/run` and `/wardrobe/items` additionally pull the full list of liked URLs for the user for annotation. For search this looks especially redundant because search SQL already returns `isLiked`.

Impact: p95/p99 should already be better than in the first audit, but with a large catalog and active statistics UI load, the database still remains the main bottleneck.

### 3. Jobs crash/cancellation and legacy process-local execution state are closed

Key areas:

- `server/src/jobs/jobQueue.ts`
- `server/src/jobs/jobWorker.ts`
- `server/src/jobs/jobHandlers.ts`
- `server/src/routes/jobRoutes.ts`
- `server/src/db/jobRunLifecycle.ts`
- `server/src/db/jobRunQueries.ts`
- `server/src/db/sql/schema/105_create_job_runs_active_dedupe_index.sql`
- `server/src/ai/wardrobeJobService.ts`
- `server/src/ai/regenerateSelectedServiceJobs.ts`
- `server/src/ai/outfitImages.ts`
- `server/src/ai/outfitSetImages.ts`
- `client/src/app/useActiveSidebarJobs.ts`

Done:

- The crash window between `job_runs` create and provider enqueue is covered by a reconciler for stale queued jobs without a provider id.
- Stale `running` jobs are reconciled to terminal `failed` rows with `job_stale_after_crash` and replayable events on worker startup. They are not automatically retried, avoiding duplicate side effects while unblocking active dedupe.
- State update and event append are now atomic.
- The worker got a per-job deadline.
- Upload child runners, report generation, capsule generation, selected regeneration, outfit image generation, outfit-set image generation, and supported LLM/image provider adapters receive `AbortSignal` and check abort before final writes.
- Full capsule abort/deadline failure no longer writes rollback snapshots after the durable job has already terminalized, preventing old timed-out handlers from overwriting newer state.
- Capsule generation and selected regeneration no longer route production execution through legacy HTTP handlers/process-local generation promises; durable handler functions load state, publish snapshots, update progress, and persist final domain state directly.
- Outfit image and outfit-set image generation are persisted job kinds (`outfitImageGenerate`, `outfitSetImageGenerate`), with route-level queued responses and active dedupe.
- Active dedupe keys for generation/image work include input-state hashes, so changed filters/items do not bind new requests to an older active job for stale inputs.
- Capsule/outfit pending image state is derived from active persisted jobs in production route context, not in-memory registries.
- Account cleanup relies on persisted job cleanup for transient AI/image jobs instead of clearing production legacy maps.
- Legacy server-side service factories, process-local pending registries, and direct execution handlers for capsule generation, selected regeneration, outfit image generation, and outfit-set image generation were removed from production modules. Test/e2e in-memory adapters remain isolated in test/e2e layers.
- `/jobs/:id/events` has server-side max stream duration and a per-user active stream cap.
- The client `waitForJob` helper got a default timeout and server status reconciliation.
- `useActiveSidebarJobs.waitForJobCompletion` delegates to the shared timed `waitForJob` watchdog so local stream/discovery gaps do not hang forever.

Remaining:

- `/jobs/:id/events` still polls the DB once per second per accepted stream. Stream caps bound exposure, but a future push/event-notify path would reduce DB pressure.
- Provider SDKs that do not support abort still cannot always stop the remote call itself; final writes are guarded by cooperative abort checks.

Impact: the regular happy path and crash/timeout recovery are now production-ready for the current single-service architecture. The remaining concern is operational load/backpressure, not correctness of durable job state.

### 4. Production readiness/API integration remains partially incomplete

Key areas:

- `render.yaml`
- `server/src/routes/healthImageRoutes.ts`
- `server/src/appMiddleware.ts`
- `server/src/capsuleHttp.ts`
- `server/src/serverStartup.ts`
- `server/src/mcp/mcpRoutes.ts`
- `server/src/mcp/oauthRoutes.ts`
- `client/render-server.js`

Done:

- Production startup preflight now fail-fast validates required env, HTTPS origins, passkey RP/origin, and MCP OAuth config.
- `/health` and `/healthall` return release metadata.
- Structured request logs and the internal metrics builder exist.
- The client-only Render proxy no longer buffers SSE/PDF/attachment responses.

Remaining:

- Render `healthCheckPath` is still `/health`, and `/health` checks only process liveness. DB readiness remains on `/healthall`; `/live`/`/ready` are not split.
- `/internal/metrics` and `/api/internal/metrics` are reserved, but always return 403; there is no admin/internal auth model for metrics yet.
- Production CORS allow-headers include only `Content-Type, X-CSRF-Token`; browser-based MCP clients with `Authorization`, `Mcp-Session-Id`, `Mcp-Protocol-Version` may fail preflight.
- SPA fallback whitelist does not include all integration prefixes (`/oauth`, `/.well-known`, `/mcp`, `/jobs`), so an integration route miss can return HTML 200 instead of JSON/404.
- Scoped rate limits exist for auth/passkey/oauth register, and job-event SSE streams now have active caps. There are still no separate limits for `/oauth/token`, `/mcp`, report/generate enqueue, or broader queue backpressure.

Impact: deploy is now less likely to start with invalid production config, but it can still be "green" during a runtime dependency problem; browser MCP/integration diagnostics can be noisy.

### 5. Frontend scale/correctness: the main risks narrowed

Key areas:

- `client/src/api/request.ts`
- `client/src/app/useAppLifecycleEffects.ts`
- `client/src/app/buildAppControllerModel.ts`
- `client/src/screens/WardrobeGrid.tsx`
- `client/src/screens/mainScreen/MainScreenWardrobe.tsx`
- `client/src/screens/mainScreen/MainScreenVirtualWardrobeGrid.tsx`
- `client/src/screens/mainScreen/MainScreenHelpers.tsx`
- `client/src/screens/outfitScreen/outfitCardLayoutStorage.ts`
- `client/src/i18n/LocaleProvider.tsx`
- `client/src/app/usePasskeyPrompt.ts`

Done:

- The app model/effects are narrower: the previous broad dependency on the full `appState` was not confirmed after the fixes.
- Route-level lazy loading, lazy dialogs/snackbars, and vendor chunks remain in good shape.
- `getCachedJson` is bounded.
- The outfit catalog picker is protected against stale response overwrite.
- The audit-listed `localStorage` paths (`AppSidebarShell`, `WardrobeCardLayoutStorage`, `statisticsFilterStorage`) became best-effort.

Remaining:

- Personal items screen grid (`client/src/screens/WardrobeGrid.tsx`) is not virtualized and depends on unbounded `/wardrobe/items`.
- Several less critical `localStorage` helpers are still without `try/catch` (`LocaleProvider`, `MainScreenHelpers`, `outfitCardLayoutStorage`, `usePasskeyPrompt`). This is an edge correctness risk in blocked storage/private mode, but not a high-impact performance blocker.

Impact: the frontend initial architecture is fine; the real frontend problems will mostly appear with large Personal items profiles and rare storage-restricted browsers.

## Potential Bugs and Shortcomings

1. Report freshness is URL-only.
   - Files: `server/src/routes/personalItemsReportRoutes.ts`, `server/src/db/personalItemsReports.ts`
   - Risk: the report is treated as current after metadata/image/category/source changes if the URL does not change.

2. API fallback can return SPA HTML for an integration route miss.
   - Files: `server/src/capsuleHttp.ts`, `server/src/serverStartup.ts`
   - Risk: OAuth/MCP/job clients receive misleading 200 HTML instead of a diagnosable 404/JSON.

3. CORS preflight is incomplete for browser-based MCP.
   - File: `server/src/appMiddleware.ts`
   - Risk: a browser client with bearer token/session headers will not pass preflight.

4. Job-event SSE streams still poll per stream.
   - File: `server/src/routes/jobRoutes.ts`
   - Risk: caps limit active streams, but accepted streams still create constant DB QPS and socket pressure.

5. Remaining `localStorage` helpers can throw.
   - Files: `client/src/i18n/LocaleProvider.tsx`, `client/src/screens/mainScreen/MainScreenHelpers.tsx`, `client/src/screens/outfitScreen/outfitCardLayoutStorage.ts`, `client/src/app/usePasskeyPrompt.ts`
   - Risk: blocked storage/private mode breaks mount or layout persistence paths.

6. Full liked URL list fetch is used in hot paths.
   - Files: `server/src/routes/searchRoutes.ts`, `server/src/routes/wardrobeRoutes.ts`, `server/src/db/likedItems.ts`
   - Risk: profiles with many liked items increase unnecessary DB egress and response work.

## Improvement Recommendations

### P1 - First

1. Finish wardrobe pagination/cursor and full-coverage report scaling.
   - Add cursor/pageSize for `/wardrobe/items` and client Personal items loading.
   - For the report path, preserve analysis over the complete wardrobe while using chunking, per-category/per-attribute aggregation, summary precomputation, or staged generation.
   - Remove the double unbounded read on initial Personal items screen load: stale check should use a cheap fingerprint/count/version, not the full list.

2. Apply and control the `products` performance contract.
   - Apply indexes on a staging/temporary branch and then production after separate approval.
   - Add plan/benchmark smoke checks for search/count/stats on a representative catalog size.
   - For stats, consider a rollup/materialized path or batched query plan if cold misses remain expensive.

3. Limit `personalItemsReport` context and improve freshness.
   - Store a report item fingerprint by id/source/updatedAt/category/image metadata instead of a URL-only set.
   - Consider an explicit user-context length cap for report generation payloads.

Done in this pass:

- Finish the job crash/cancellation model.
- Close legacy process-local AI/image job state from production code and remove obsolete server-side legacy service modules.
- Bound active `personalItemsReport` dedupe keys with a SHA-256 context hash so DB indexes no longer store raw user context.

### P2 - After Hot Paths Stabilize

1. Split `/live` and `/ready`.
   - Keep `/live` as cheap process health.
   - Have `/ready` check DB and minimal runtime dependencies.
   - Move the Render health check to the readiness endpoint or add a separate alert on `/healthall`.

2. Finish the metrics/admin path.
   - Wire `buildInternalMetricsSnapshotImpl` only after an admin/internal auth model exists.
   - Revisit the email hash policy before exporting logs beyond a trusted boundary: use keyed HMAC or remove the hash if user correlation in logs is not needed.

3. Close integration HTTP edges.
   - Add CORS allow headers for `Authorization`, `Mcp-Session-Id`, `Mcp-Protocol-Version` where browser MCP clients are actually supported.
   - Extend API-ish fallback prefixes to `/oauth`, `/.well-known`, `/mcp`, `/jobs`.

4. Add scoped rate limits and active caps.
   - `/oauth/token`, `/mcp` initialize/session requests, report/generate enqueue, upload enqueue.
   - For SSE: active stream metrics and, if DB polling cost becomes material, a lower-QPS event delivery model.

5. Virtualize the Personal items screen grid.
   - Use the existing `MainScreenVirtualWardrobeGrid` approach or server-side pagination/windowing.
   - Solve API pagination first, so virtualization is not only reducing DOM while payloads remain full.

6. Remove unnecessary full liked list fetch in hot paths.
   - For search, use `isLiked` from the SQL result.
   - For wardrobe annotation, make a scoped lookup by the URL set of the current page/batch after pagination.

7. Close the remaining `localStorage` edge paths.
   - Wrap the remaining read/write operations in best-effort helpers.
   - This is low priority, but cheap cleanup.

## What Already Works Well Enough

- Centralized Express assembly: `server/src/appFactory.ts`, `server/src/appRouteContext.ts`, `server/src/appRoutes.ts`.
- Security controls: trusted-origin guard, CSRF guard, auth/passkey rate limiters, Helmet/CSP production path.
- Passkey/WebAuthn stores challenges DB-backed and single-use.
- MCP OAuth preserves the read-only model, PKCE, token validation, and refresh-token rotation.
- SSRF protection for URL image import: guarded fetch with DNS/IP checks, redirect validation, byte caps, and timeout.
- E2E isolation: dedicated server with in-memory dependencies and no real DB/email/LLM requirements.
- Lazy frontend loading: route screens, dialogs, and snackbars are split from the initial route.
- Vite chunking: React, MUI, and Recharts are split into manual vendor chunks.
- Heavy processing isolation: upload/PDF/image paths use child processes or concurrency guards in several places.
- The observability baseline is already sufficient as a foundation; it does not need to be expanded without an admin/internal access model.

## Checks Worth Adding Separately

- Load test for `/search/run`, `/search/stats`, `/wardrobe/items`, `/wardrobe/items/report`, `/jobs/:id/events` on realistic catalog/profile sizes.
- DB `EXPLAIN (ANALYZE, BUFFERS)` for search/count/stats queries after applying `products` indexes.
- Browser profiling for Personal items screen grid with 500/1000/3000 personal items.
- Failure-injection tests for worker timeout with an uncancellable provider, SSE disconnect/reconnect, profile delete cleanup failure, and high-concurrency job-event streams.
- Production readiness tests for `/live`/`/ready` and missing/misconfigured env.

## Recommended Work Order

1. Wardrobe pagination/cursor + full-coverage report chunking/aggregation/fingerprint.
2. Products index rollout + search/stats plan/benchmark guard.
3. Readiness/metrics/admin + CORS/fallback integration fixes.
4. SSE/rate-limit/backpressure metrics and lower-QPS delivery if needed.
5. Personal items screen grid virtualization after API pagination.
