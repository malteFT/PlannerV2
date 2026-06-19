-- 0004_shopping_inventory.sql — Einkaufsliste + Vorrat + RPCs
-- Voraussetzung: 0001 + 0002 + 0003 ausgeführt.

-- =========================================================================
-- Vorrat
-- =========================================================================

create table if not exists public.inventory_item (
  user_id uuid not null references auth.users(id) on delete cascade,
  ingredient_id uuid not null references public.ingredient(id) on delete cascade,
  amount numeric(10,2) not null default 0 check (amount >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, ingredient_id)
);

drop trigger if exists inventory_set_updated_at on public.inventory_item;
create trigger inventory_set_updated_at
  before update on public.inventory_item
  for each row execute function public.set_updated_at();

alter table public.inventory_item enable row level security;

drop policy if exists inventory_select_own on public.inventory_item;
create policy inventory_select_own on public.inventory_item
  for select using (auth.uid() = user_id);

drop policy if exists inventory_insert_own on public.inventory_item;
create policy inventory_insert_own on public.inventory_item
  for insert with check (auth.uid() = user_id);

drop policy if exists inventory_update_own on public.inventory_item;
create policy inventory_update_own on public.inventory_item
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists inventory_delete_own on public.inventory_item;
create policy inventory_delete_own on public.inventory_item
  for delete using (auth.uid() = user_id);

-- =========================================================================
-- Einkaufsliste
-- =========================================================================

create table if not exists public.shopping_list_item (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid not null references public.plan(id) on delete cascade,
  ingredient_id uuid not null references public.ingredient(id) on delete restrict,
  required_amount numeric(10,2) not null default 0 check (required_amount >= 0),
  to_buy_amount numeric(10,2) not null default 0 check (to_buy_amount >= 0),
  unit public.ingredient_unit not null,
  checked boolean not null default false,
  checked_at timestamptz,
  manual boolean not null default false,
  created_at timestamptz not null default now(),
  unique (plan_id, ingredient_id)
);

create index if not exists shopping_list_user_idx on public.shopping_list_item(user_id);
create index if not exists shopping_list_plan_idx on public.shopping_list_item(plan_id);

alter table public.shopping_list_item enable row level security;

drop policy if exists shopping_select_own on public.shopping_list_item;
create policy shopping_select_own on public.shopping_list_item
  for select using (auth.uid() = user_id);

drop policy if exists shopping_insert_own on public.shopping_list_item;
create policy shopping_insert_own on public.shopping_list_item
  for insert with check (auth.uid() = user_id);

drop policy if exists shopping_update_own on public.shopping_list_item;
create policy shopping_update_own on public.shopping_list_item
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists shopping_delete_own on public.shopping_list_item;
create policy shopping_delete_own on public.shopping_list_item
  for delete using (auth.uid() = user_id);

-- =========================================================================
-- Helper: Konvertierung Menge × Einheit → Standardeinheit der Zutat
-- =========================================================================

create or replace function public.convert_to_default_unit(
  p_amount numeric,
  p_unit public.ingredient_unit,
  p_default_unit public.ingredient_unit,
  p_grams_per_piece numeric
) returns numeric
language plpgsql
immutable
as $$
declare
  v_grams numeric;
begin
  -- Wenn Einheit identisch → direkt
  if p_unit = p_default_unit then
    return p_amount;
  end if;

  -- "ml" und "g" Annahme Dichte 1 (MVP)
  if (p_unit = 'g' and p_default_unit = 'ml') or (p_unit = 'ml' and p_default_unit = 'g') then
    return p_amount;
  end if;

  -- "piece" → über Gramm
  if p_unit = 'piece' then
    if p_grams_per_piece is null or p_grams_per_piece <= 0 then
      return 0;
    end if;
    v_grams := p_amount * p_grams_per_piece;
    if p_default_unit in ('g', 'ml') then
      return v_grams;
    end if;
    return 0;
  end if;

  -- "g" oder "ml" → "piece"
  if p_default_unit = 'piece' then
    if p_grams_per_piece is null or p_grams_per_piece <= 0 then
      return 0;
    end if;
    return p_amount / p_grams_per_piece;
  end if;

  return p_amount;
end$$;

-- =========================================================================
-- RPC: Plan aktivieren — archiviert alten aktiven Plan, erzeugt
-- Einkaufsliste-Snapshot (Bedarf - Vorrat).
-- =========================================================================

create or replace function public.activate_plan(p_plan_id uuid)
returns void
language plpgsql
security invoker
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'auth required';
  end if;

  -- Plan muss dem User gehören und Draft sein
  if not exists (
    select 1 from public.plan
    where id = p_plan_id and user_id = v_user_id and status = 'draft'
  ) then
    raise exception 'plan not found, not owned by you, or not in draft state';
  end if;

  -- Bisherigen aktiven Plan archivieren
  update public.plan
  set status = 'archived', archived_at = now()
  where user_id = v_user_id and status = 'active';

  -- Draft aktivieren
  update public.plan
  set status = 'active', activated_at = now()
  where id = p_plan_id and user_id = v_user_id;

  -- Einkaufsliste-Snapshot: pro Zutat Summe Bedarf, abzüglich Vorrat
  insert into public.shopping_list_item(
    user_id, plan_id, ingredient_id, required_amount, to_buy_amount, unit, manual
  )
  select
    v_user_id,
    p_plan_id,
    i.id as ingredient_id,
    coalesce(sum(public.convert_to_default_unit(
      ri.amount, ri.unit, i.default_unit, i.grams_per_piece
    ) * pm.serving_factor / r.base_servings), 0) as required_amount,
    greatest(
      0,
      coalesce(sum(public.convert_to_default_unit(
        ri.amount, ri.unit, i.default_unit, i.grams_per_piece
      ) * pm.serving_factor / r.base_servings), 0)
        - coalesce((select amount from public.inventory_item ii
                    where ii.user_id = v_user_id and ii.ingredient_id = i.id), 0)
    ) as to_buy_amount,
    i.default_unit as unit,
    false as manual
  from public.plan_meal pm
  join public.recipe r on r.id = pm.recipe_id
  join public.recipe_ingredient ri on ri.recipe_id = r.id
  join public.ingredient i on i.id = ri.ingredient_id
  where pm.plan_id = p_plan_id
  group by i.id, i.default_unit
  having coalesce(sum(public.convert_to_default_unit(
    ri.amount, ri.unit, i.default_unit, i.grams_per_piece
  ) * pm.serving_factor / r.base_servings), 0) > 0
  on conflict (plan_id, ingredient_id) do update
    set required_amount = excluded.required_amount,
        to_buy_amount = excluded.to_buy_amount;
end$$;

-- =========================================================================
-- RPC: Einkauf abhaken — addiert to_buy_amount zum Vorrat
-- =========================================================================

create or replace function public.check_shopping_item(p_item_id uuid)
returns void
language plpgsql
security invoker
as $$
declare
  v_user_id uuid := auth.uid();
  v_ingredient_id uuid;
  v_amount numeric;
begin
  if v_user_id is null then
    raise exception 'auth required';
  end if;

  select ingredient_id, to_buy_amount
  into v_ingredient_id, v_amount
  from public.shopping_list_item
  where id = p_item_id and user_id = v_user_id and not checked;

  if v_ingredient_id is null then
    raise exception 'item not found or already checked';
  end if;

  update public.shopping_list_item
  set checked = true, checked_at = now()
  where id = p_item_id;

  insert into public.inventory_item (user_id, ingredient_id, amount)
  values (v_user_id, v_ingredient_id, v_amount)
  on conflict (user_id, ingredient_id) do update
    set amount = public.inventory_item.amount + excluded.amount;
end$$;

-- =========================================================================
-- RPC: Einkauf un-abhaken — zieht to_buy_amount wieder vom Vorrat ab
-- (mit clamp >= 0).
-- =========================================================================

create or replace function public.uncheck_shopping_item(p_item_id uuid)
returns void
language plpgsql
security invoker
as $$
declare
  v_user_id uuid := auth.uid();
  v_ingredient_id uuid;
  v_amount numeric;
begin
  if v_user_id is null then
    raise exception 'auth required';
  end if;

  select ingredient_id, to_buy_amount
  into v_ingredient_id, v_amount
  from public.shopping_list_item
  where id = p_item_id and user_id = v_user_id and checked;

  if v_ingredient_id is null then
    raise exception 'item not found or not checked';
  end if;

  update public.shopping_list_item
  set checked = false, checked_at = null
  where id = p_item_id;

  update public.inventory_item
  set amount = greatest(0, amount - v_amount)
  where user_id = v_user_id and ingredient_id = v_ingredient_id;
end$$;

-- =========================================================================
-- RPC: Mahlzeit als gekocht markieren — reduziert Vorrat um Mahlzeit-Mengen
-- =========================================================================

create or replace function public.mark_meal_cooked(p_meal_id uuid, p_cooked boolean)
returns void
language plpgsql
security invoker
as $$
declare
  v_user_id uuid := auth.uid();
  v_was_cooked boolean;
  v_recipe_id uuid;
  v_serving_factor numeric;
  v_base_servings numeric;
begin
  if v_user_id is null then
    raise exception 'auth required';
  end if;

  -- Eigentumsprüfung über plan
  select pm.cooked, pm.recipe_id, pm.serving_factor, r.base_servings
  into v_was_cooked, v_recipe_id, v_serving_factor, v_base_servings
  from public.plan_meal pm
  join public.plan p on p.id = pm.plan_id
  left join public.recipe r on r.id = pm.recipe_id
  where pm.id = p_meal_id and p.user_id = v_user_id;

  if v_recipe_id is null then
    -- Mahlzeit existiert nicht oder hat kein Rezept (gelöscht). Nur status updaten.
    update public.plan_meal
    set cooked = p_cooked,
        cooked_at = case when p_cooked then now() else null end
    where id = p_meal_id;
    return;
  end if;

  -- Idempotent: gleicher Wert → nichts tun
  if v_was_cooked = p_cooked then
    return;
  end if;

  update public.plan_meal
  set cooked = p_cooked,
      cooked_at = case when p_cooked then now() else null end
  where id = p_meal_id;

  -- Vorratsanpassung: cooked=true → subtrahieren; cooked=false → wieder addieren.
  if p_cooked then
    -- Subtrahieren: für jede Zutat Menge × serving_factor / base_servings
    update public.inventory_item ii
    set amount = greatest(0, ii.amount - (
      select public.convert_to_default_unit(ri.amount, ri.unit, i.default_unit, i.grams_per_piece)
             * v_serving_factor / nullif(v_base_servings, 0)
      from public.recipe_ingredient ri
      join public.ingredient i on i.id = ri.ingredient_id
      where ri.recipe_id = v_recipe_id and ri.ingredient_id = ii.ingredient_id
    ))
    where ii.user_id = v_user_id
      and ii.ingredient_id in (
        select ri.ingredient_id from public.recipe_ingredient ri where ri.recipe_id = v_recipe_id
      );
  else
    -- Re-add: pro Zutat upserten
    insert into public.inventory_item (user_id, ingredient_id, amount)
    select
      v_user_id,
      ri.ingredient_id,
      public.convert_to_default_unit(ri.amount, ri.unit, i.default_unit, i.grams_per_piece)
        * v_serving_factor / nullif(v_base_servings, 0)
    from public.recipe_ingredient ri
    join public.ingredient i on i.id = ri.ingredient_id
    where ri.recipe_id = v_recipe_id
    on conflict (user_id, ingredient_id) do update
      set amount = public.inventory_item.amount + excluded.amount;
  end if;
end$$;
