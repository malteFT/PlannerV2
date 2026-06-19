-- 0002_stammdaten.sql — Zutaten, Rezepte, Settings + RLS + Trigger
-- Voraussetzung: 0001_init.sql wurde ausgeführt.
--
-- Ausführen im Supabase SQL Editor.

-- =========================================================================
-- ENUMs
-- =========================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'ingredient_unit') then
    create type public.ingredient_unit as enum ('g', 'ml', 'piece');
  end if;
  if not exists (select 1 from pg_type where typname = 'meal_slot') then
    create type public.meal_slot as enum ('breakfast', 'lunch', 'dinner', 'snack');
  end if;
end$$;

-- =========================================================================
-- Trigger-Helper: updated_at automatisch nachziehen
-- =========================================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end$$;

-- =========================================================================
-- Zutat (user-scoped)
-- =========================================================================

create table if not exists public.ingredient (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null,
  bls_code text not null references public.bls_food(bls_code),
  default_unit public.ingredient_unit not null,
  grams_per_piece numeric(8,2),
  category text not null,
  excluded boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint piece_requires_grams
    check (default_unit <> 'piece' or (grams_per_piece is not null and grams_per_piece > 0))
);

create unique index if not exists ingredient_user_name
  on public.ingredient(user_id, lower(display_name));

create index if not exists ingredient_user_id_idx
  on public.ingredient(user_id);

drop trigger if exists ingredient_set_updated_at on public.ingredient;
create trigger ingredient_set_updated_at
  before update on public.ingredient
  for each row execute function public.set_updated_at();

alter table public.ingredient enable row level security;

drop policy if exists ingredient_select_own on public.ingredient;
create policy ingredient_select_own on public.ingredient
  for select using (auth.uid() = user_id);

drop policy if exists ingredient_insert_own on public.ingredient;
create policy ingredient_insert_own on public.ingredient
  for insert with check (auth.uid() = user_id);

drop policy if exists ingredient_update_own on public.ingredient;
create policy ingredient_update_own on public.ingredient
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists ingredient_delete_own on public.ingredient;
create policy ingredient_delete_own on public.ingredient
  for delete using (auth.uid() = user_id);

-- =========================================================================
-- Rezept (user-scoped)
-- =========================================================================

create table if not exists public.recipe (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  meal_types public.meal_slot[] not null
    check (array_length(meal_types, 1) >= 1),
  base_servings numeric(6,2) not null check (base_servings > 0),
  instructions text not null default '',
  suppressed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists recipe_user_id_idx on public.recipe(user_id);
create index if not exists recipe_meal_types_idx on public.recipe using gin (meal_types);

drop trigger if exists recipe_set_updated_at on public.recipe;
create trigger recipe_set_updated_at
  before update on public.recipe
  for each row execute function public.set_updated_at();

alter table public.recipe enable row level security;

drop policy if exists recipe_select_own on public.recipe;
create policy recipe_select_own on public.recipe
  for select using (auth.uid() = user_id);

drop policy if exists recipe_insert_own on public.recipe;
create policy recipe_insert_own on public.recipe
  for insert with check (auth.uid() = user_id);

drop policy if exists recipe_update_own on public.recipe;
create policy recipe_update_own on public.recipe
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists recipe_delete_own on public.recipe;
create policy recipe_delete_own on public.recipe
  for delete using (auth.uid() = user_id);

-- =========================================================================
-- Recipe-Ingredient-Junction
-- =========================================================================

create table if not exists public.recipe_ingredient (
  recipe_id uuid not null references public.recipe(id) on delete cascade,
  ingredient_id uuid not null references public.ingredient(id) on delete restrict,
  amount numeric(10,2) not null check (amount > 0),
  unit public.ingredient_unit not null,
  position integer not null default 0,
  primary key (recipe_id, ingredient_id)
);

create index if not exists recipe_ingredient_ingredient_idx
  on public.recipe_ingredient(ingredient_id);

alter table public.recipe_ingredient enable row level security;

drop policy if exists recipe_ingredient_all_own on public.recipe_ingredient;
create policy recipe_ingredient_all_own on public.recipe_ingredient
  for all
  using (
    exists (
      select 1 from public.recipe r
      where r.id = recipe_ingredient.recipe_id and r.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.recipe r
      where r.id = recipe_ingredient.recipe_id and r.user_id = auth.uid()
    )
  );

-- =========================================================================
-- User-Settings (1:1 zu auth.users)
-- =========================================================================

create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  target_kcal_per_day integer not null default 2000 check (target_kcal_per_day > 0),
  protein_pct numeric(5,2) not null default 30,
  carbs_pct numeric(5,2) not null default 40,
  fat_pct numeric(5,2) not null default 30,
  meal_slots public.meal_slot[] not null
    default array['breakfast','lunch','dinner']::public.meal_slot[],
  meal_slot_pct numeric(5,2)[] not null
    default array[30, 40, 30]::numeric[],
  tolerance_pct numeric(5,2) not null default 5
    check (tolerance_pct >= 0 and tolerance_pct <= 100),
  excluded_ingredient_ids uuid[] not null default '{}',
  updated_at timestamptz not null default now(),
  constraint macros_sum_100
    check (round((protein_pct + carbs_pct + fat_pct)::numeric, 2) = 100),
  constraint meal_slot_lengths_match
    check (array_length(meal_slots, 1) = array_length(meal_slot_pct, 1))
);

drop trigger if exists user_settings_set_updated_at on public.user_settings;
create trigger user_settings_set_updated_at
  before update on public.user_settings
  for each row execute function public.set_updated_at();

alter table public.user_settings enable row level security;

drop policy if exists user_settings_select_own on public.user_settings;
create policy user_settings_select_own on public.user_settings
  for select using (auth.uid() = user_id);

drop policy if exists user_settings_insert_own on public.user_settings;
create policy user_settings_insert_own on public.user_settings
  for insert with check (auth.uid() = user_id);

drop policy if exists user_settings_update_own on public.user_settings;
create policy user_settings_update_own on public.user_settings
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =========================================================================
-- Auto-Anlage von Settings beim ersten Login
-- =========================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_settings (user_id) values (new.id)
  on conflict (user_id) do nothing;
  return new;
end$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Bestehenden User (falls bereits angelegt vor Trigger) nachziehen:
insert into public.user_settings (user_id)
select id from auth.users
on conflict (user_id) do nothing;
