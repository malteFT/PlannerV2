-- 0007_templates_and_signup.sql
--
-- Führt Copy-on-Signup für Basisdaten ein:
--   1. Globale Template-Tabellen (template_ingredient, template_recipe,
--      template_recipe_ingredient) — sichtbar für alle authenticated User.
--   2. user_settings um Snapshot-Versionen erweitert, damit späterer
--      Template-Sync per Vergleich erkannt werden kann.
--   3. handle_new_user() ersetzt: kopiert Templates in die user-scoped
--      Tabellen ingredient/recipe/recipe_ingredient und setzt die
--      Snapshot-Versionen. Fehler werden geschluckt (raise warning), damit
--      der Auth-User in jedem Fall angelegt wird.
--
-- Ausführen im Supabase SQL Editor.

-- =========================================================================
-- 1. Template-Zutat (global, kein user_id)
-- =========================================================================

create table if not exists public.template_ingredient (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  bls_code text not null references public.bls_food(bls_code),
  default_unit public.ingredient_unit not null,
  grams_per_piece numeric(8,2),
  category text not null,
  aliases text[] not null default '{}',
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint template_ingredient_piece_requires_grams
    check (default_unit <> 'piece' or (grams_per_piece is not null and grams_per_piece > 0))
);

create unique index if not exists template_ingredient_name
  on public.template_ingredient(lower(display_name));

drop trigger if exists template_ingredient_set_updated_at on public.template_ingredient;
create trigger template_ingredient_set_updated_at
  before update on public.template_ingredient
  for each row execute function public.set_updated_at();

alter table public.template_ingredient enable row level security;

drop policy if exists template_ingredient_read on public.template_ingredient;
create policy template_ingredient_read on public.template_ingredient
  for select to authenticated using (true);
-- Kein INSERT/UPDATE/DELETE-Policy: nur service_role (bypasst RLS) darf schreiben.

-- =========================================================================
-- 2. Template-Rezept (global)
-- =========================================================================

create table if not exists public.template_recipe (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  meal_types public.meal_slot[] not null
    check (array_length(meal_types, 1) >= 1),
  base_servings numeric(6,2) not null check (base_servings > 0),
  instructions text not null default '',
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists template_recipe_name
  on public.template_recipe(lower(name));

drop trigger if exists template_recipe_set_updated_at on public.template_recipe;
create trigger template_recipe_set_updated_at
  before update on public.template_recipe
  for each row execute function public.set_updated_at();

alter table public.template_recipe enable row level security;

drop policy if exists template_recipe_read on public.template_recipe;
create policy template_recipe_read on public.template_recipe
  for select to authenticated using (true);

-- =========================================================================
-- 3. Template-Junction
-- =========================================================================

create table if not exists public.template_recipe_ingredient (
  recipe_id uuid not null references public.template_recipe(id) on delete cascade,
  ingredient_id uuid not null references public.template_ingredient(id) on delete restrict,
  amount numeric(10,2) not null check (amount > 0),
  unit public.ingredient_unit not null,
  position integer not null default 0,
  primary key (recipe_id, ingredient_id)
);

create index if not exists template_recipe_ingredient_ingredient_idx
  on public.template_recipe_ingredient(ingredient_id);

alter table public.template_recipe_ingredient enable row level security;

drop policy if exists template_recipe_ingredient_read on public.template_recipe_ingredient;
create policy template_recipe_ingredient_read on public.template_recipe_ingredient
  for select to authenticated using (true);

-- =========================================================================
-- 4. user_settings um Snapshot-Versionen erweitern
-- =========================================================================

alter table public.user_settings
  add column if not exists template_snapshot_ingredient_version integer not null default 0,
  add column if not exists template_snapshot_recipe_version integer not null default 0;

-- =========================================================================
-- 5. handle_new_user(): Templates in user-scoped Tabellen kopieren
-- =========================================================================
--
-- Ersetzt die bisherige Version aus 0002_stammdaten.sql (die nur user_settings
-- anlegte). Zusätzlich wird nun der komplette Template-Katalog auf den neuen
-- User kopiert:
--   - template_ingredient  → ingredient(user_id = new.id)
--   - template_recipe      → recipe(user_id = new.id)
--   - template_recipe_ingredient → recipe_ingredient (mit gemappten IDs)
--
-- ID-Mapping via Join auf den Ziel-Zustand (nicht via RETURNING), damit auch
-- Fälle korrekt funktionieren, in denen ON CONFLICT DO NOTHING greift.
--
-- Fehler beim Kopieren werden geschluckt und geloggt: sonst würde der Insert
-- in auth.users zurückgerollt und Signup unmöglich. Ein User ohne Templates
-- ist die bessere Fallback-UX als gar kein User.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ing_max_version integer;
  v_rec_max_version integer;
begin
  -- 1. Settings anlegen (bestehendes Verhalten)
  insert into public.user_settings (user_id) values (new.id)
    on conflict (user_id) do nothing;

  -- 2. Templates in ingredient kopieren.
  --    ON CONFLICT für den Fall, dass ein User durch Signup-Retry bereits
  --    Rows hat oder die Migration mehrfach angetriggert wird.
  insert into public.ingredient (
    user_id, display_name, bls_code, default_unit,
    grams_per_piece, category, excluded, aliases
  )
  select
    new.id, ti.display_name, ti.bls_code, ti.default_unit,
    ti.grams_per_piece, ti.category, false, ti.aliases
  from public.template_ingredient ti
  on conflict (user_id, lower(display_name)) do nothing;

  -- 3. ID-Mapping template_ingredient.id → ingredient.id per Name-Join.
  --    Temp-Table ist session-lokal, kein Concurrency-Problem bei parallelen
  --    Signups.
  create temp table _ing_map (
    template_id uuid primary key,
    new_id uuid not null
  ) on commit drop;

  insert into _ing_map (template_id, new_id)
  select ti.id, i.id
  from public.template_ingredient ti
  join public.ingredient i
    on i.user_id = new.id
    and lower(i.display_name) = lower(ti.display_name);

  -- 4. Templates in recipe kopieren (kein Unique-Constraint auf recipe.name,
  --    also einfacher Insert). Wir gehen davon aus, dass ein neuer User noch
  --    keine Rezepte hat.
  insert into public.recipe (
    user_id, name, meal_types, base_servings, instructions, suppressed
  )
  select
    new.id, tr.name, tr.meal_types, tr.base_servings, tr.instructions, false
  from public.template_recipe tr;

  create temp table _rec_map (
    template_id uuid primary key,
    new_id uuid not null
  ) on commit drop;

  insert into _rec_map (template_id, new_id)
  select tr.id, r.id
  from public.template_recipe tr
  join public.recipe r
    on r.user_id = new.id
    and lower(r.name) = lower(tr.name);

  -- 5. Junction kopieren (nur wenn beide Mappings vorhanden sind)
  insert into public.recipe_ingredient (
    recipe_id, ingredient_id, amount, unit, position
  )
  select rm.new_id, im.new_id, tri.amount, tri.unit, tri.position
  from public.template_recipe_ingredient tri
  join _rec_map rm on rm.template_id = tri.recipe_id
  join _ing_map im on im.template_id = tri.ingredient_id;

  -- 6. Snapshot-Version für spätere Sync-Erkennung setzen
  select coalesce(max(version), 0) into v_ing_max_version
    from public.template_ingredient;
  select coalesce(max(version), 0) into v_rec_max_version
    from public.template_recipe;

  update public.user_settings
    set template_snapshot_ingredient_version = v_ing_max_version,
        template_snapshot_recipe_version = v_rec_max_version
    where user_id = new.id;

  return new;
exception when others then
  -- Fehler bewusst schlucken: sonst würde auth.users-Insert zurückgerollt
  -- und Signup schlägt aus User-Sicht unerklärlich fehl. User bekommt dann
  -- halt eine leere App; Malte sieht den Fehler in den Postgres-Logs.
  raise warning 'handle_new_user template copy failed for user %: %',
    new.id, sqlerrm;
  return new;
end$$;

-- Trigger neu setzen, damit die neue Function-Version referenziert wird
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =========================================================================
-- 6. Bestandsuser (Malte) auf aktuelle Template-Version setzen, damit die
--    Sync-Info-Card für ihn nicht sofort aufblinkt. Alle User, deren
--    Snapshot noch bei 0/0 steht (also vor diesem Migrations-Lauf angelegt),
--    bekommen die max-Version.
-- =========================================================================

update public.user_settings us
  set template_snapshot_ingredient_version =
        (select coalesce(max(version), 0) from public.template_ingredient),
      template_snapshot_recipe_version =
        (select coalesce(max(version), 0) from public.template_recipe)
  where us.template_snapshot_ingredient_version = 0
    and us.template_snapshot_recipe_version = 0;
