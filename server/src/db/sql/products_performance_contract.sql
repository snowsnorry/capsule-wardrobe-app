-- Performance contract for the externally managed public.products catalog.
--
-- This file is intentionally not executed by ensureTables(): products is not
-- app-owned schema, but search/options/stats depend on these indexes for
-- predictable p95/p99 latency as the catalog grows.
--
-- Run statements separately. CREATE INDEX CONCURRENTLY cannot run inside a
-- transaction block.

create extension if not exists pg_trgm;

-- Required identity contract. The current production catalog already exposes
-- products_pkey/products_url_key on url and products_id_key on id; do not add
-- duplicate url/id indexes when those unique constraints exist.
create unique index concurrently if not exists products_id_key
on products (id);

-- Scalar facet filters use lower(coalesce(column, '')) = any(...).
create index concurrently if not exists products_brand_lc_idx
on products (lower(coalesce(brand, '')));

create index concurrently if not exists products_audience_lc_idx
on products (lower(coalesce(audience, '')));

create index concurrently if not exists products_category_lc_idx
on products (lower(coalesce(category, '')));

create index concurrently if not exists products_pattern_lc_idx
on products (lower(coalesce(pattern, '')));

create index concurrently if not exists products_silhouette_lc_idx
on products (lower(coalesce(silhouette, '')));

create index concurrently if not exists products_fit_lc_idx
on products (lower(coalesce(fit, '')));

-- Price ranges and option bounds.
create index concurrently if not exists products_price_idx
on products (price)
where price is not null;

-- Array facet filters use column && params.
create index concurrently if not exists products_season_gin_idx
on products using gin (season);

create index concurrently if not exists products_formality_level_gin_idx
on products using gin (formality_level);

create index concurrently if not exists products_style_gin_idx
on products using gin (style);

create index concurrently if not exists products_occasions_gin_idx
on products using gin (occasions);

create index concurrently if not exists products_color_base_gin_idx
on products using gin (color_base);

create index concurrently if not exists products_closure_type_gin_idx
on products using gin (closure_type);

-- Lexical LIKE search over normalized text fields.
create index concurrently if not exists products_name_trgm_idx
on products using gin (lower(coalesce(name, '')) gin_trgm_ops);

create index concurrently if not exists products_description_trgm_idx
on products using gin (lower(coalesce(description, '')) gin_trgm_ops);

create index concurrently if not exists products_composition_trgm_idx
on products using gin (lower(coalesce(composition, '')) gin_trgm_ops);

-- Semantic search uses cosine distance over 1024-dimensional embeddings.
create index concurrently if not exists products_embedding_1024_hnsw_cosine_idx
on products using hnsw ((embedding::vector(1024)) vector_cosine_ops)
where embedding is not null and vector_dims(embedding) = 1024;
