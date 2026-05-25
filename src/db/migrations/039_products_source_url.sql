-- 039_products_source_url.sql
-- Keep source product links for CSV / website imports.

alter table products add column if not exists source_url text;
