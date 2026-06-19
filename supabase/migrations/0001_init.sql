-- 0001_init.sql — Basisschema (BLS-Lookup), Erweiterungen
-- Diese Migration kann direkt im Supabase SQL-Editor ausgeführt werden.

-- pg_trgm für Fuzzy-Suche bei BLS-Autocomplete
create extension if not exists pg_trgm;

-- BLS-Lookup-Tabelle (global, read-only für authenticated)
create table if not exists public.bls_food (
  bls_code text primary key,
  name_de text not null,
  kcal_per_100g numeric(8,2) not null,
  protein_per_100g numeric(8,2) not null,
  carbs_per_100g numeric(8,2) not null,
  fat_per_100g numeric(8,2) not null
);

create index if not exists bls_food_name_de_trgm
  on public.bls_food using gin (name_de gin_trgm_ops);

alter table public.bls_food enable row level security;

drop policy if exists "bls_food readable by authenticated" on public.bls_food;
create policy "bls_food readable by authenticated"
  on public.bls_food for select
  to authenticated using (true);
