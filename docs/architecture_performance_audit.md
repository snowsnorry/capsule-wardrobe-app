# Архитектурный и performance-аудит приложения

Дата: 2026-07-01

Цель: оценить архитектурные решения, устойчивость под нагрузкой, поведение в краевых случаях и производительность full-stack capsule wardrobe приложения. Анализ проводился статически по коду, с раздельными суб-агентами по frontend/React, backend/API, DB/search/AI и deployment/ops. Дополнительно был запущен `npm --workspace client run build`; полноценные load tests и runtime profiling не запускались.

## Общие выводы

- Критичных P0/stop-ship проблем по результатам статического аудита не найдено.
- Архитектура уже достаточно зрелая: монорепозиторий разделен на client/server/shared, Express собирается через app factory и route context, security middleware централизованы, e2e path изолирован, long-running операции частично вынесены в persisted jobs, тяжелая обработка изображений/PDF уходит в child processes.
- Самый вероятный bottleneck под нагрузкой - база данных, особенно `products` search/options/stats и personal wardrobe/report paths. На большом каталоге или больших профилях приложение начнет упираться в DB CPU/IO, объем JSON payload и память раньше, чем в React rendering.
- Frontend имеет хорошие базовые решения: route-level `React.lazy`, lazy dialogs/snackbars, Vite manual chunks, lazy image loading. Основные frontend-риски связаны не с initial architecture, а с ростом данных: невиртуализированные grids, широкая app model, много свежих objects/handlers на render, unbounded client cache.
- Production path рабочий для single-service Render deployment, но readiness/observability/backpressure пока слабые. Для стабильной работы под реальной нагрузкой нужны fail-fast config validation, более честный health/readiness, отдельный worker или жесткие caps, scoped rate limits и метрики.
- Масштабирование сейчас лучше рассматривать как vertical/single-service baseline. Horizontal scale потребует обязательного external storage для staged uploads, worker separation, queue reconciliation, stream-friendly proxy path и более явных DB/index contracts.

## Проблемные места

### 1. Search/options/stats - основной hot path

`searchStore` перед выполнением поиска загружает option dictionaries, а stats route запускает count/facet/price bucket запросы параллельно:

- `server/src/searchStore.ts`
- `server/src/db/searchStats.ts`
- `server/src/db/productOptions.ts`
- `server/src/db/sql/search_product_items.sql`
- `server/src/db/sql/search_product_count.sql`

Риски:

- 12 option queries по `products` перед search могут давать постоянный DB load даже для частых UI-действий.
- Stats запускает много facet scans параллельно. Это ускоряет один запрос, но под конкурентной нагрузкой может резко поднять DB CPU/IO.
- `search_product_items.sql` и `search_product_count.sql` строят динамические CTE вокруг `products`, lexical score, vector score и count. Без явно гарантированных индексов на `products` это плохо масштабируется.
- В app-owned schema нет assets для `products` table/indexes, поэтому performance contract для внешнего каталога не закреплен в репозитории.

Последствие: p95/p99 latency поиска и статистики будет расти нелинейно при увеличении каталога и числа пользователей.

### 2. Personal wardrobe и reports читают слишком много данных

Ключевые места:

- `server/src/db/wardrobe.ts`
- `server/src/routes/wardrobeRoutes.ts`
- `server/src/ai/personalItemsReportService.ts`
- `server/src/ai/personalItemsReportPrompt.ts`
- `client/src/screens/WardrobeGrid.tsx`
- `client/src/screens/WardrobeScreen.tsx`

Риски:

- `/wardrobe/items` возвращает весь профиль без pagination/cursor.
- `listWardrobeItemsByEmail` выбирает `embedding` и полные rows, хотя наружу embedding не отдается.
- Personal report строит prompt/collage/context по всему wardrobe без жесткого лимита или chunking.
- Sidebar count получает полный список personal items только ради `items.length`.
- Frontend grid мапит весь список карточек без virtualization/windowing.

Последствие: большие wardrobe-профили будут давать рост DB egress, памяти Node, времени JSON parse на клиенте, DOM/render cost и риск LLM failures из-за token/image payload.

### 3. Jobs, queue и SSE не полностью готовы к сбоям и high concurrency

Ключевые места:

- `server/src/jobs/jobQueue.ts`
- `server/src/jobs/pgBossQueueBackend.ts`
- `server/src/jobs/jobWorker.ts`
- `server/src/routes/jobRoutes.ts`
- `server/src/jobs/jobStore.ts`
- `client/src/api/jobs.ts`
- `client/src/app/useActiveSidebarJobs.ts`

Риски:

- Job enqueue не атомарен: сначала создается `job_runs` record, затем вызывается provider enqueue. Crash между шагами может оставить `queued` job без provider job id, а active dedupe будет блокировать повторный запуск.
- Queue backend передает `AbortSignal`, но worker/handlers не доводят его до upload child runners и provider calls.
- `/jobs/:id/events` делает DB polling раз в секунду на каждый SSE stream. Несколько вкладок и несколько активных jobs быстро превращаются в постоянный DB QPS.
- Job state update и event append не выглядят как единая транзакционная операция, поэтому replay/SSE может пропустить финальное событие при частичном сбое.
- На клиенте `waitForJob`/waiters могут ждать бесконечно, если terminal event не придет и caller не передаст abort.

Последствие: stuck jobs, занятые worker slots, лишние retries, рост socket/DB pressure и неустойчивый progress UI при сбоях.

### 4. Legacy in-memory AI jobs

Ключевые места:

- `server/src/ai/wardrobeJobService.ts`
- `server/src/ai/regenerateSelectedServiceJobs.ts`
- `server/src/ai/outfitSetImages.ts`
- `server/src/ai/outfitImages.ts`

Риски:

- Часть image/regeneration jobs остается process-local.
- Pending jobs могут жить слишком долго: TTL применяется не ко всем состояниям, retry может возвращать старую pending job.
- Deploy/restart теряет состояние process-local jobs.

Последствие: пользователи могут видеть вечные pending состояния, а multi-instance deployment будет вести себя недетерминированно.

### 5. Frontend rendering и React model scale

Ключевые места:

- `client/src/app/useAppControllerModel.ts`
- `client/src/app/buildAppControllerModel.ts`
- `client/src/app/useAppHandlers.ts`
- `client/src/app/useAppLifecycleEffects.ts`
- `client/src/app/AppRouteContent.tsx`
- `client/src/components/ClothingCardRoot.tsx`
- `client/src/screens/WardrobeGrid.tsx`
- `client/src/components/tremor/BarChart.tsx`

Положительно:

- Route-level lazy loading уже есть.
- MUI/Recharts/React вынесены в отдельные chunks.
- Изображения карточек используют `loading="lazy"` и `decoding="async"`.

Риски:

- App-level model собирается как большой набор nested objects/actions; многие объекты и handlers создаются заново на каждый render.
- Некоторые effects зависят от широких object references вроде `appState`.
- Grids и chart rows не виртуализированы и не всегда ограничены top-N.
- `getCachedJson` использует module-level `Map` без max size/eviction.
- SearchScreen защищен от stale responses sequence guard'ом, но Outfit catalog picker аналогичной защиты не имеет.

Последствие: при сотнях/тысячах items и частых state updates появятся лишние re-render cascades, медленный scroll, рост памяти в долгих сессиях и stale UI при быстрых поисковых действиях.

### 6. Production readiness, deployment и observability

Ключевые места:

- `render.yaml`
- `server/src/appConfig.ts`
- `server/src/routes/healthImageRoutes.ts`
- `server/src/serverStartup.ts`
- `server/src/appDependencies.ts`
- `server/src/logger.ts`

Риски:

- Render health check использует `/health`, который возвращает только `{ ok: true }`; DB проверяется на `/healthall`.
- В production есть localhost defaults для `CLIENT_ORIGIN`, `PASSKEY_RP_ID`, `PASSKEY_ORIGIN`; часть auth/email config падает lazy только в первом пользовательском flow.
- Schema bootstrap выполняется перед `listen`, что удобно для dev, но может увеличивать cold start и скрывать migration latency.
- Web process и pg-boss worker живут в одном service по умолчанию. AI/image/PDF jobs могут влиять на HTTP latency.
- Observability минимальная: нет структурированных request logs, request id, latency metrics, queue metrics endpoint.
- `quality:gate` не включает production build; Render build использует `npm install --include=dev` вместо lockfile-strict `npm ci --include=dev`.

Последствие: deploy может быть "green", но фактически сломан по DB/auth; production incidents будет сложнее диагностировать; job bursts могут ухудшать HTTP.

### 7. API/integration edge cases

Ключевые места:

- `server/src/mcp/mcpRoutes.ts`
- `server/src/appMiddleware.ts`
- `server/src/serverStartup.ts`
- `client/render-server.js`

Риски:

- MCP `/mcp` route отбрасывает Promise через `void`, а часть `createMcpServer` вызовов находится до `try`. Ошибка может стать unhandled rejection или hung request.
- CORS allow headers не включают `Authorization` и MCP-specific headers, что может ломать browser-based MCP clients на preflight.
- API-ish fallback whitelist не включает все integration prefixes (`/oauth`, `/.well-known`, `/mcp`), поэтому route miss может вернуть SPA HTML 200 вместо ожидаемого JSON/404.
- `client/render-server.js`, если используется как client-only proxy, буферизует upstream response целиком; это плохо для SSE и больших download/PDF responses.

## Найденные потенциальные баги

### P1

1. MCP request handler может не обработать ошибку корректно.
   - Файлы: `server/src/mcp/mcpRoutes.ts`
   - Суть: Promise route handler отбрасывается, `createMcpServer` частично вызывается вне `try`.
   - Риск: unhandled rejection, hung MCP request, нестабильность процесса.

2. Job enqueue может оставить stuck queued job.
   - Файлы: `server/src/jobs/jobQueue.ts`, `server/src/db/jobs.ts`
   - Суть: DB job создается до provider enqueue.
   - Риск: crash между шагами оставит active dedupe lock без реального provider job.

3. Worker cancellation не доведен до job handlers.
   - Файлы: `server/src/jobs/pgBossQueueBackend.ts`, `server/src/jobs/jobWorker.ts`, `server/src/routes/wardrobeFileUploadRoute.ts`, `server/src/routes/wardrobeUrlUploadRoute.ts`
   - Суть: `AbortSignal` существует на уровне queue backend, но upload/LLM handlers фактически получают `signal: undefined`.
   - Риск: stuck worker slots и неконтролируемая длительность jobs.

4. Profile delete может вернуть ошибку после фактического удаления.
   - Файлы: `server/src/routes/profileMutationHandlers.ts`, `server/src/db/profiles.ts`
   - Суть: DB deletion и transient cleanup/R2/cookie cleanup разделены неидеально.
   - Риск: пользователь получает 503 или странное session состояние после частично успешного удаления.

5. Outfit catalog picker подвержен stale response overwrite.
   - Файл: `client/src/screens/outfitScreen/useOutfitCatalogPicker.ts`
   - Суть: search response всегда пишет state после `await`, без sequence/abort guard.
   - Риск: более старый ответ может перетереть новый при быстрых фильтрах/пагинации.

6. `personalItemsReport` dedupe key может быть слишком длинным.
   - Файл: `server/src/routes/personalItemsReportRoutes.ts`
   - Суть: raw user context входит в `dedupeKey`.
   - Риск: btree index bloat или DB error на размере index tuple; параллельно растет prompt payload.

7. Production config может silently default to localhost.
   - Файл: `server/src/appConfig.ts`
   - Суть: `CLIENT_ORIGIN`, `PASSKEY_RP_ID`, `PASSKEY_ORIGIN` имеют localhost defaults.
   - Риск: production deploy стартует, но auth/passkey/CORS ломаются в runtime.

### P2

1. `localStorage` операции без `try/catch` могут сломать mount.
   - Файлы: `client/src/components/AppSidebarShell.tsx`, `client/src/screens/WardrobeCardLayoutStorage.ts`, `client/src/screens/statisticsScreen/statisticsFilterStorage.ts`
   - Риск: blocked storage/quota/private mode приводит к runtime exception.

2. Job state и job event append не выглядят атомарными.
   - Файл: `server/src/jobs/jobStore.ts`
   - Риск: SSE/replay может не увидеть финальное событие после частичного сбоя.

3. Personal report stale check сравнивает только URL set.
   - Файлы: `server/src/routes/personalItemsReportRoutes.ts`, `server/src/db/personalItemsReports.ts`
   - Риск: отчет считается актуальным после изменения metadata/image/category без изменения URL.

4. App-side uniqueness для capsule/outfit names может проиграть race condition.
   - Файлы: `server/src/capsuleStoreNaming.ts`, `server/src/db/sql/schema/042_create_capsules_email_lower_name_index.sql`
   - Риск: параллельный create/rename может создать дубликаты, если уникальность имени является invariant.

5. `getCachedJson` cache key учитывает только method+url.
   - Файл: `client/src/api/request.ts`
   - Риск: если появится GET с тем же URL, но разными headers/options, cache может вернуть неверный payload.

6. R2 staging читает файл целиком в память.
   - Файл: `server/src/jobs/stagedUploadStorage.ts`
   - Риск: RSS spikes при нескольких upload по 10MB и concurrent staging.

7. `/health` слишком поверхностный для readiness.
   - Файлы: `server/src/routes/healthImageRoutes.ts`, `render.yaml`
   - Риск: Render считает service healthy при сломанной DB/queue path.

8. API fallback может вернуть SPA HTML для integration route miss.
   - Файлы: `server/src/capsuleHttp.ts`, `server/src/serverStartup.ts`
   - Риск: OAuth/MCP clients получают misleading 200 HTML вместо диагностируемого 404/JSON.

## Рекомендации по улучшению

### P1 - сначала

1. [x] Закрепить performance contract для `products`.
   - Добавить/задокументировать обязательные индексы: `url/id`, `category`, scalar facets, GIN для arrays, vector HNSW/IVFFLAT для embeddings, trigram/tsvector для lexical search.
   - Добавить query plan checks или smoke benchmark для search/count/stats на representative catalog size.
   - Ожидаемый эффект: снижение DB CPU/IO и более предсказуемый p95/p99.
   - Статус 2026-07-01: repo-level contract добавлен в `server/src/db/sql/products_performance_contract.sql`, search SQL выровнен под индексируемые array predicates и `vector(1024)` semantic distance path.
   - Neon production (`purple-frog-30056878`, branch `production`) подтверждает риск: `products` содержит примерно 38 970 строк, `embedding` имеет 1024 измерения, установлен `vector`, но нет `pg_trgm`/`pg_stat_statements`; текущие планы для facet count, lexical contains и semantic nearest-neighbor используют `Seq Scan`/`Sort`.
   - Production migration по контрактным индексам подготовлена как отдельные `CREATE INDEX CONCURRENTLY` statements и должна применяться на временной Neon branch, затем на production только после отдельного approval.

2. [ ] Кэшировать options и переработать stats.
   - Option dictionaries кэшировать с TTL/version или materialized view.
   - Facet stats вынести в rollup/materialized tables либо ограничить параллелизм.
   - Где UX допускает, заменить exact `total` на `limit + 1`/`hasMore`.
   - Ожидаемый эффект: меньше повторных full scans по `products`.

3. [ ] Ввести pagination/cursor и lightweight projections для wardrobe.
   - `/wardrobe/items` должен иметь paginated/list projection без `embedding`.
   - Sidebar count заменить на lightweight count endpoint/bootstrap field.
   - Personal report ограничить hard cap, chunking или summary precomputation.
   - Ожидаемый эффект: ниже DB egress, Node memory, client parse/render time.

4. [x] Исправить job reliability.
   - Добавить transactional outbox/reconciler для `queued` jobs без provider id.
   - Сделать row state update + event append атомарными.
   - Добавить per-job deadline и довести `AbortSignal` до child process/LLM/image provider calls.
   - Ожидаемый эффект: меньше stuck jobs и предсказуемое освобождение worker slots.
   - Статус 2026-07-03: `job_runs` используется как минимальный outbox для stale `queued` jobs без provider id, lifecycle state + SSE event пишутся атомарными CTE statements, worker получил per-job deadline и `AbortSignal` для queued upload child runners, client job waiter получил default timeout.

5. [x] Закрыть MCP error boundary.
   - Не отбрасывать Promise в `/mcp` handler.
   - Обернуть `createMcpServer` в `try`.
   - Аккуратно проверять `headersSent` перед error JSON.
   - Ожидаемый эффект: меньше hung integration requests и unhandled rejections.

6. [ ] Добавить production startup preflight.
   - Проверять `CLIENT_ORIGIN`, passkey origin/RP, `DATABASE_URL`, `AUTH_CODE_SECRET`, Resend config и OAuth config до `listen`.
   - Для production убрать localhost defaults или явно запрещать их.
   - Ожидаемый эффект: broken deploy падает сразу, а не в первом user flow.

7. [ ] Разделить `/live` и `/ready`.
   - `/live` может оставаться cheap process health.
   - `/ready` должен проверять DB и минимальные runtime dependencies.
   - Render readiness лучше направить на readiness endpoint или добавить отдельный alert по `/healthall`.
   - Ожидаемый эффект: меньше "green but broken" деплоев.

8. [ ] Исправить frontend correctness bugs.
   - Добавить sequence/abort guard в `useOutfitCatalogPicker`.
   - Обернуть `localStorage` read/write в `try/catch`.
   - Добавить timeout/abort policy для client job waiters.
   - Ожидаемый эффект: меньше stale UI и runtime падений в edge browsers.

### P2 - после стабилизации hot paths

1. [ ] Сузить app model и уменьшить render cascades.
   - Мемоизировать model slices/actions там, где это реально снижает renders.
   - Убрать broad object dependencies вроде полного `appState` из effects.
   - Разделить route-level state так, чтобы dialogs/shell не получали лишние changing references.

2. [ ] Виртуализировать большие списки.
   - Wardrobe grid: windowing/virtualization или server-side pagination.
   - Charts: top-N, aggregation или scrollable virtual list для high-cardinality bars.

3. [ ] Сделать bounded client cache.
   - Для `getCachedJson` добавить max size и LRU/TTL eviction.
   - Ключ расширить только тогда, когда появятся GET-варианты с разными headers/options.

4. [ ] Добавить scoped rate limits и active caps.
   - Upload, report/generate enqueue, `/oauth/token`, `/mcp` initialize, `/auth/google`.
   - Для SSE: max stream duration, per-user/session cap, active stream metrics.

5. [ ] Перейти к stream-friendly upload/proxy paths.
   - R2 staging: заменить `readFile` на stream body, ограничить concurrent staging.
   - `client/render-server.js`, если используется, должен passthrough-stream SSE/download endpoints.

6. [ ] Улучшить deployment pipeline.
   - Render build: `npm ci --include=dev`.
   - Cron cleanup: server-only build или общий artifact.
   - CI/quality gate: добавить production build.
   - SPA fallback: кэшировать base `index.html` template в памяти.

7. [ ] Добавить observability baseline.
   - Request id, structured JSON logs, latency/status logs.
   - Queue metrics: active/queued/failed/stuck jobs.
   - Build SHA/release version в logs/health.
   - Metrics или JSON endpoint для internal counters, включая upload/image/report timings.

## Остальное

### Что уже сделано хорошо

- Centralized Express assembly: `server/src/appFactory.ts`, `server/src/appRouteContext.ts`, `server/src/appRoutes.ts`.
- Security controls: trusted-origin guard, CSRF guard, auth/passkey rate limiters, Helmet/CSP production path.
- SSRF protection for URL image import: guarded fetch with DNS/IP checks, redirect validation, byte caps and timeout.
- E2E isolation: dedicated server with in-memory dependencies and no real DB/email/LLM requirements.
- Lazy frontend loading: route screens, dialogs and snackbars are split from the initial route.
- Vite chunking: React, MUI and Recharts are split into manual vendor chunks.
- Heavy processing isolation: upload/PDF/image paths use child processes or concurrency guards in several places.

### Client build snapshot

`npm --workspace client run build` прошел успешно. Важные размеры из Vite output:

- `vendor-mui`: примерно 479 kB raw / 133 kB gzip.
- `vendor-recharts`: примерно 403 kB raw / 115 kB gzip.
- `vendor-react`: примерно 357 kB raw / 108 kB gzip.
- main app chunk: примерно 228 kB raw / 53 kB gzip.
- route chunks: `WardrobeScreen` примерно 87 kB raw, `MainScreen` примерно 64 kB raw, `OutfitScreen` примерно 53 kB raw.

Вывод: code splitting уже работает, но Recharts/MUI остаются крупными vendor costs. Важно не подтягивать chart-heavy/statistics dependencies в initial route и не расширять shared UI imports так, чтобы они разрушали chunk boundaries.

### Проверки, которые стоит добавить отдельно

- Load test для `/search/run`, `/search/stats`, `/wardrobe/items`, `/jobs/:id/events` на realistic catalog/profile sizes.
- DB `EXPLAIN (ANALYZE, BUFFERS)` для search/count/stats queries.
- Browser profiling для wardrobe grid на 500/1000/3000 personal items.
- Failure-injection тесты для job enqueue crash window, worker timeout, SSE disconnect/reconnect и profile delete cleanup failure.
- Production config preflight tests для missing/misconfigured env.

### Рекомендуемый порядок работ

1. Search/stats/options DB optimization и explicit `products` index contract.
2. Wardrobe pagination/projection и report caps/chunking.
3. Job enqueue reliability, deadlines, cancellation and SSE pressure reduction.
4. Production preflight/readiness/observability.
5. Frontend large-list virtualization and app model render tightening.
6. Deployment pipeline and cache/proxy polish.
