-- 0006_ingredient_aliases.sql — Synonyme/Aliase für Zutaten
-- Voraussetzung: 0001 + 0002 + 0003 + 0004 (+ ggf. 0005) ausgeführt.
--
-- Zweck: User kann zu jeder Zutat alternative Suchbegriffe hinterlegen
-- (z.B. "Nudeln" → ["Spaghetti", "Penne", "Pasta"]). Die Suche im
-- Rezept-Editor findet die Zutat dann auch über diese Synonyme.

alter table public.ingredient
  add column if not exists aliases text[] not null default '{}';

-- Index für Array-Operationen (z.B. ANY-Klauseln)
create index if not exists ingredient_aliases_gin_idx
  on public.ingredient using gin (aliases);

-- Hinweis: Lowercase-Vergleich machen wir clientseitig oder per
-- ilike; ein dedizierter Funktional-Index ist hier overkill, da wir
-- die Liste nach user_id schon stark einschränken.

comment on column public.ingredient.aliases is
  'Alternative Namen / Synonyme. Werden bei der Zutaten-Suche im Rezept-Editor zusätzlich zu display_name durchsucht. Case-insensitive Match.';
