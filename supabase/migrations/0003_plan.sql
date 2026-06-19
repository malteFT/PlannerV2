-- 0003_plan.sql — Plan + Plan-Meals
-- Voraussetzung: 0001 + 0002 ausgeführt.

-- =========================================================================
-- ENUM für Plan-Status
-- =========================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'plan_status') then
    create type public.plan_status as enum ('draft', 'active', 'archived');
  end if;
end$$;

-- =========================================================================
-- Plan
-- =========================================================================

create table if not exists public.plan (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text,
  day_count integer not null check (day_count between 1 and 31),
  day_labels text[] not null,
  status public.plan_status not null default 'draft',
  -- Snapshot der Settings zum Zeitpunkt der Aktivierung — verhindert, dass
  -- spätere Settings-Änderungen historische Pläne verfälschen.
  meal_slots public.meal_slot[] not null,
  meal_slot_pct numeric(5,2)[] not null,
  target_kcal_per_day integer not null,
  protein_pct numeric(5,2) not null,
  carbs_pct numeric(5,2) not null,
  fat_pct numeric(5,2) not null,
  created_at timestamptz not null default now(),
  activated_at timestamptz,
  archived_at timestamptz,
  constraint plan_day_labels_length
    check (array_length(day_labels, 1) = day_count),
  constraint plan_slots_lengths_match
    check (array_length(meal_slots, 1) = array_length(meal_slot_pct, 1))
);

create index if not exists plan_user_status_idx on public.plan(user_id, status);

-- Höchstens ein aktiver Plan pro User.
create unique index if not exists plan_one_active_per_user
  on public.plan(user_id) where status = 'active';

alter table public.plan enable row level security;

drop policy if exists plan_select_own on public.plan;
create policy plan_select_own on public.plan
  for select using (auth.uid() = user_id);

drop policy if exists plan_insert_own on public.plan;
create policy plan_insert_own on public.plan
  for insert with check (auth.uid() = user_id);

drop policy if exists plan_update_own on public.plan;
create policy plan_update_own on public.plan
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists plan_delete_own on public.plan;
create policy plan_delete_own on public.plan
  for delete using (auth.uid() = user_id);

-- =========================================================================
-- Plan-Meal
-- =========================================================================

create table if not exists public.plan_meal (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plan(id) on delete cascade,
  day_index integer not null check (day_index >= 0),
  meal_slot public.meal_slot not null,
  recipe_id uuid references public.recipe(id) on delete set null,
  serving_factor numeric(6,3) not null default 1 check (serving_factor > 0),
  cooked boolean not null default false,
  cooked_at timestamptz,
  created_at timestamptz not null default now(),
  unique (plan_id, day_index, meal_slot)
);

create index if not exists plan_meal_plan_idx on public.plan_meal(plan_id);
create index if not exists plan_meal_recipe_idx on public.plan_meal(recipe_id);

alter table public.plan_meal enable row level security;

drop policy if exists plan_meal_all_own on public.plan_meal;
create policy plan_meal_all_own on public.plan_meal
  for all
  using (
    exists (
      select 1 from public.plan p
      where p.id = plan_meal.plan_id and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.plan p
      where p.id = plan_meal.plan_id and p.user_id = auth.uid()
    )
  );
