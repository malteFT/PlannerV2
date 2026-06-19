-- 0005_consolidated_fixes.sql — Fixes aus Phase 2-5 Verifikation
-- Voraussetzung: 0001 + 0002 + 0003 + 0004 ausgeführt.
--
-- Liefert:
--   - reaggregate_shopping_list(plan_id) — neu rechnen nach Mahlzeiten-Änderung
--   - update_plan_meal(meal_id, recipe_id, serving_factor) + delete_plan_meal(meal_id)
--     wrapper, die zusätzlich reaggregate_shopping_list aufrufen.
--   - mark_meal_cooked: Snapshot-basiert (verbraucht Mengen werden in JSON gespeichert)
--   - cooked_subtractions Spalte auf plan_meal
--   - inventory updates triggern shopping-Recompute für aktiven Plan

-- =========================================================================
-- 1. Snapshot-Spalte auf plan_meal für Cooked-Verbrauch
-- =========================================================================

alter table public.plan_meal
  add column if not exists cooked_subtractions jsonb;

-- =========================================================================
-- 2. Re-Aggregation der Einkaufsliste für einen Plan
-- =========================================================================
--
-- Strategie:
--   - Re-berechnen required_amount aus aktuellen plan_meals.
--   - Bestehende Items mit demselben (plan_id, ingredient_id):
--     - required_amount auf neuen Wert setzen
--     - to_buy_amount = max(0, required − inventory)
--     - aber: bereits abgehakte (checked) Items oder manual=true bleiben
--       UNVERÄNDERT (User hat schon gekauft / manuell beigesteuert)
--   - Neue Zutaten: einfügen
--   - Items, die vorher generiert wurden (manual=false, !checked) und jetzt
--     0 brauchen: löschen

create or replace function public.reaggregate_shopping_list(p_plan_id uuid)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'auth required';
  end if;

  if not exists (
    select 1 from public.plan
    where id = p_plan_id and user_id = v_user_id
  ) then
    raise exception 'plan not found or not owned';
  end if;

  -- Berechne required_amount pro Zutat aus aktuellen plan_meals
  with required_amounts as (
    select
      i.id as ingredient_id,
      i.default_unit as unit,
      sum(public.convert_to_default_unit(
        ri.amount, ri.unit, i.default_unit, i.grams_per_piece
      ) * pm.serving_factor / nullif(r.base_servings, 0)) as amt
    from public.plan_meal pm
    join public.recipe r on r.id = pm.recipe_id
    join public.recipe_ingredient ri on ri.recipe_id = r.id
    join public.ingredient i on i.id = ri.ingredient_id
    where pm.plan_id = p_plan_id and pm.recipe_id is not null
    group by i.id, i.default_unit
  )
  -- Upsert: für nicht-manuelle, nicht-abgehakte Items required ändern
  insert into public.shopping_list_item(
    user_id, plan_id, ingredient_id, required_amount, to_buy_amount, unit, manual
  )
  select
    v_user_id, p_plan_id, ra.ingredient_id, coalesce(ra.amt, 0),
    greatest(0, coalesce(ra.amt, 0)
      - coalesce((select amount from public.inventory_item ii
                  where ii.user_id = v_user_id and ii.ingredient_id = ra.ingredient_id), 0)),
    ra.unit, false
  from required_amounts ra
  on conflict (plan_id, ingredient_id) do update
    set required_amount = case
        when public.shopping_list_item.checked or public.shopping_list_item.manual then
          public.shopping_list_item.required_amount
        else
          excluded.required_amount
      end,
      to_buy_amount = case
        when public.shopping_list_item.checked or public.shopping_list_item.manual then
          public.shopping_list_item.to_buy_amount
        else
          greatest(0, excluded.required_amount
            - coalesce((select amount from public.inventory_item ii
                        where ii.user_id = v_user_id and ii.ingredient_id = excluded.ingredient_id), 0))
      end;

  -- Lösche generierte (manual=false, !checked) Items, die im neuen Bedarf NICHT mehr vorkommen
  delete from public.shopping_list_item s
  where s.plan_id = p_plan_id
    and not s.manual
    and not s.checked
    and not exists (
      select 1
      from public.plan_meal pm
      join public.recipe r on r.id = pm.recipe_id
      join public.recipe_ingredient ri on ri.recipe_id = r.id
      where pm.plan_id = p_plan_id
        and ri.ingredient_id = s.ingredient_id
        and pm.recipe_id is not null
    );
end$$;

-- =========================================================================
-- 3. Plan-Meal Mutationen mit automatischer Re-Aggregation
-- =========================================================================

create or replace function public.update_plan_meal(
  p_meal_id uuid,
  p_recipe_id uuid default null,
  p_serving_factor numeric default null
)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_plan_id uuid;
  v_plan_status public.plan_status;
begin
  if v_user_id is null then
    raise exception 'auth required';
  end if;

  select pm.plan_id, p.status
  into v_plan_id, v_plan_status
  from public.plan_meal pm
  join public.plan p on p.id = pm.plan_id
  where pm.id = p_meal_id and p.user_id = v_user_id;

  if v_plan_id is null then
    raise exception 'meal not found or not owned';
  end if;

  update public.plan_meal
  set recipe_id = coalesce(p_recipe_id, recipe_id),
      serving_factor = coalesce(p_serving_factor, serving_factor)
  where id = p_meal_id;

  -- Nur bei aktivem Plan: Einkaufsliste neu aggregieren
  if v_plan_status = 'active' then
    perform public.reaggregate_shopping_list(v_plan_id);
  end if;
end$$;

create or replace function public.delete_plan_meal(p_meal_id uuid)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_plan_id uuid;
  v_plan_status public.plan_status;
begin
  if v_user_id is null then
    raise exception 'auth required';
  end if;

  select pm.plan_id, p.status
  into v_plan_id, v_plan_status
  from public.plan_meal pm
  join public.plan p on p.id = pm.plan_id
  where pm.id = p_meal_id and p.user_id = v_user_id;

  if v_plan_id is null then
    raise exception 'meal not found or not owned';
  end if;

  -- Slot bleibt leer (recipe_id = NULL) per SPEC §6.4
  update public.plan_meal
  set recipe_id = null,
      serving_factor = 1,
      cooked = false,
      cooked_at = null,
      cooked_subtractions = null
  where id = p_meal_id;

  if v_plan_status = 'active' then
    perform public.reaggregate_shopping_list(v_plan_id);
  end if;
end$$;

-- =========================================================================
-- 4. mark_meal_cooked: Snapshot-basiert (Un-Cook nutzt was tatsächlich abgezogen wurde)
-- =========================================================================

create or replace function public.mark_meal_cooked(p_meal_id uuid, p_cooked boolean)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_was_cooked boolean;
  v_recipe_id uuid;
  v_serving_factor numeric;
  v_base_servings numeric;
  v_old_subs jsonb;
  v_new_subs jsonb;
begin
  if v_user_id is null then
    raise exception 'auth required';
  end if;

  select pm.cooked, pm.recipe_id, pm.serving_factor, r.base_servings, pm.cooked_subtractions
  into v_was_cooked, v_recipe_id, v_serving_factor, v_base_servings, v_old_subs
  from public.plan_meal pm
  join public.plan p on p.id = pm.plan_id
  left join public.recipe r on r.id = pm.recipe_id
  where pm.id = p_meal_id and p.user_id = v_user_id;

  if v_was_cooked is null then
    raise exception 'meal not found or not owned';
  end if;

  if v_was_cooked = p_cooked then
    return; -- idempotent
  end if;

  if v_recipe_id is null then
    -- Kein Rezept zugeordnet (gelöscht): nur Status setzen
    update public.plan_meal
    set cooked = p_cooked,
        cooked_at = case when p_cooked then now() else null end
    where id = p_meal_id;
    return;
  end if;

  if p_cooked then
    -- Cook: Snapshot der zu subtrahierenden Mengen erstellen
    select coalesce(jsonb_agg(jsonb_build_object(
      'ingredient_id', ri.ingredient_id,
      'amount', public.convert_to_default_unit(ri.amount, ri.unit, i.default_unit, i.grams_per_piece)
                * v_serving_factor / nullif(v_base_servings, 0)
    )), '[]'::jsonb)
    into v_new_subs
    from public.recipe_ingredient ri
    join public.ingredient i on i.id = ri.ingredient_id
    where ri.recipe_id = v_recipe_id;

    -- Subtrahieren (clamp 0)
    update public.inventory_item ii
    set amount = greatest(0, ii.amount - sub.amount::numeric)
    from (
      select (elem->>'ingredient_id')::uuid as ingredient_id,
             (elem->>'amount')::numeric as amount
      from jsonb_array_elements(v_new_subs) as elem
    ) sub
    where ii.user_id = v_user_id and ii.ingredient_id = sub.ingredient_id;

    -- Speichern: was wir abgezogen haben (für späteres exaktes Un-Cook)
    update public.plan_meal
    set cooked = true,
        cooked_at = now(),
        cooked_subtractions = v_new_subs
    where id = p_meal_id;
  else
    -- Un-Cook: aus Snapshot wiederherstellen
    if v_old_subs is null then
      -- Keine Snapshot-Daten (z.B. älteres Cooked-Flag vor diesem Patch).
      -- Best-Effort: aus aktuellem Rezept ableiten.
      select coalesce(jsonb_agg(jsonb_build_object(
        'ingredient_id', ri.ingredient_id,
        'amount', public.convert_to_default_unit(ri.amount, ri.unit, i.default_unit, i.grams_per_piece)
                  * v_serving_factor / nullif(v_base_servings, 0)
      )), '[]'::jsonb)
      into v_old_subs
      from public.recipe_ingredient ri
      join public.ingredient i on i.id = ri.ingredient_id
      where ri.recipe_id = v_recipe_id;
    end if;

    -- Re-Add: Inventory um Snapshot-Mengen erhöhen
    insert into public.inventory_item (user_id, ingredient_id, amount)
    select
      v_user_id,
      (elem->>'ingredient_id')::uuid,
      (elem->>'amount')::numeric
    from jsonb_array_elements(v_old_subs) as elem
    where (elem->>'amount')::numeric > 0
    on conflict (user_id, ingredient_id) do update
      set amount = public.inventory_item.amount + excluded.amount;

    update public.plan_meal
    set cooked = false,
        cooked_at = null,
        cooked_subtractions = null
    where id = p_meal_id;
  end if;
end$$;

-- =========================================================================
-- 5. Inventory-Trigger: bei Inventory-Änderung Einkaufsliste recompute
-- =========================================================================

create or replace function public.recompute_shopping_for_active_plan()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_active_plan_id uuid;
  v_user_id uuid;
begin
  v_user_id := coalesce(new.user_id, old.user_id);
  if v_user_id is null then
    return null;
  end if;

  select id into v_active_plan_id
  from public.plan
  where user_id = v_user_id and status = 'active'
  limit 1;

  if v_active_plan_id is null then
    return null;
  end if;

  -- to_buy_amount = max(0, required - inventory) für nicht-abgehakte, nicht-manuelle Items
  update public.shopping_list_item s
  set to_buy_amount = greatest(0, s.required_amount
    - coalesce((select amount from public.inventory_item ii
                where ii.user_id = v_user_id and ii.ingredient_id = s.ingredient_id), 0))
  where s.plan_id = v_active_plan_id
    and s.ingredient_id = coalesce(new.ingredient_id, old.ingredient_id)
    and not s.checked
    and not s.manual;

  return null;
end$$;

drop trigger if exists inventory_recompute_shopping on public.inventory_item;
create trigger inventory_recompute_shopping
  after insert or update or delete on public.inventory_item
  for each row execute function public.recompute_shopping_for_active_plan();

-- =========================================================================
-- 6. set_updated_at search_path-Fix
-- =========================================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end$$;
