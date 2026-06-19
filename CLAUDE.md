# CLAUDE.md — Projekt PlannerV2

**Lies diese Datei zuerst, bevor du am Code arbeitest.** Sie enthält das, was du
nicht aus dem Code allein ableiten kannst: was schon gebaut ist, welche
Konventionen wir uns hart erarbeitet haben, und was schiefläuft, wenn man sie
ignoriert.

Quelle der Wahrheit für Anforderungen: [`SPEC.md`](./SPEC.md).
Architektur-Hintergrund: [`ARCHITECTURE.md`](./ARCHITECTURE.md).

---

## Was ist das

Eine Web-App zur Wochen-Essensplanung mit:
- Wochen-/Mehrtages-Plan mit automatischer Generierung (kcal-Ziel + Makros)
- Rezept- und Zutatenverwaltung
- Einkaufsliste, die sich aus Plan + Vorrat ergibt
- Vorratsmanagement
- Single-User in der Praxis, Multi-User-fähig durch RLS

Live-URL: <https://planner-v2-ten.vercel.app>
Repo: <https://github.com/malteFT/PlannerV2>

## Stack

- **Next.js 16.2.x** (App Router, React 19, TypeScript)
- **Tailwind CSS v4** + **shadcn/ui** (zinc-Basis, Indigo-Akzent #5B6EF5, Inter-Font)
- **Supabase** (Postgres + Auth + RLS) — Region eu-central-2 (Zürich)
- **Vercel** Deployment (aktuell Region iad1, sollte auf fra1 für Latenz)
- **TanStack Query v5** für Daten-Fetching
- **react-hook-form + zod** für Forms
- **vitest** für Tests
- Lokal: pnpm? Nein, **npm** (User-Wahl).

## Aktueller Stand (2026-06-19)

**Phasen 0-5 abgeschlossen + Polish + Aliases-Feature + Live-Deploy:**

| Phase | Inhalt | Stand |
|---|---|---|
| 0 | Setup, Auth, BLS-Import, App-Shell | ✅ |
| 1 | Stammdaten: Zutaten, Rezepte, Settings | ✅ |
| 2 | Plan-Generator + aktiver Plan | ✅ |
| 3 | Einkaufsliste (Snapshot bei Activate, Re-Aggregation bei Mahlzeitänderung) | ✅ Code, Live-Test offen |
| 4 | Vorrat (Cooked-Toggle, Abhaken, manuelle Korrektur) | ✅ |
| 5 | Historie + UI-Polish (Indigo, Inter, BottomNav-Sheet) | ✅ |
| Extra | Aliases (Synonyme) auf Zutaten, BLS-Suche mit Whitespace-Toleranz | ✅ |
| Extra | Seed-Skripte für 63 Zutaten + 31 Rezepte | ✅ |

**Live im Repo gegen den User-Account:**
- 63 Stammzutaten gemappt auf BLS-Codes, mit Aliasen
- 31 Rezepte (8 Frühstück, 9 Mittag, 10 Abend, 4 Snack — R16 wurde als REDUNDANT verworfen)
- Alle Migrationen 0001-0006 in Supabase ausgeführt

**Offen / nicht implementiert** (bewusst, MVP-Schnitt):
- Realtime-Sync zwischen Geräten (Supabase Realtime — Code-ready, nicht aktiviert)
- Multi-User-Sharing eines Plans
- Öffentliche Registrierung (User wird manuell in Supabase angelegt)
- Seed-Daten für neue User (würde ein clone_seed_data_for_user-Trigger brauchen)
- Phase-3 Live-Test: Re-Aggregation der Einkaufsliste bei Mahlzeit-Tausch wurde
  nur mit dem Generator-Erstaufruf live verifiziert, der **edit-after-activate**-
  Pfad ist noch nicht durchgeklickt worden.

## Datenmodell

```
auth.users  ─┬─→ user_settings (1:1)
             ├─→ ingredient (1:N) ──→ recipe_ingredient ──→ recipe (1:N)
             ├─→ recipe (1:N) ─────────────────┘
             ├─→ plan (1:N) ─→ plan_meal (1:N) ─→ recipe (FK on delete set null)
             ├─→ inventory_item (1:N)
             └─→ shopping_list_item (1:N)

bls_food (global, read-only) ←─ ingredient.bls_code
```

Wichtige Spalten/Konzepte:
- `ingredient.aliases text[]` — Synonyme für die Suche im Rezept-Editor
- `plan.meal_slots`, `plan.meal_slot_pct`, `plan.target_kcal_per_day`, …
  → **Snapshot der User-Settings** beim Aktivieren. Settings ändern beeinflusst
  bestehende Pläne nicht.
- `plan_meal.cooked_subtractions jsonb` — speichert, was beim Cooked-Haken
  vom Vorrat abgezogen wurde, für exaktes Un-Cook-Rückbuchen
- `shopping_list_item.required_amount` vs. `to_buy_amount` — required ist der
  Bedarf aus Plan-Mahlzeiten; to_buy ist required minus Vorrat zum Aktivierungs-
  Zeitpunkt; abgehakt = 1 Snapshot, nicht recomputed beim Vorratschange

## Migrationen

Alle in `supabase/migrations/`:

- `0001_init.sql` — `bls_food` + `pg_trgm` Index
- `0002_stammdaten.sql` — `ingredient`, `recipe`, `recipe_ingredient`, `user_settings`, RLS, `set_updated_at()`-Trigger, `handle_new_user()`-Trigger
- `0003_plan.sql` — `plan`, `plan_meal`, `plan_status`-Enum, "max 1 active per user"-Constraint
- `0004_shopping_inventory.sql` — `inventory_item`, `shopping_list_item`,
  `convert_to_default_unit()`, `activate_plan()`, `check_shopping_item()`,
  `uncheck_shopping_item()`, `mark_meal_cooked()` (initial-Variante)
- `0005_consolidated_fixes.sql` — `reaggregate_shopping_list()`,
  `update_plan_meal()`, `delete_plan_meal()`, `mark_meal_cooked()` mit
  Snapshot in `cooked_subtractions`, Inventory-Trigger
- `0006_ingredient_aliases.sql` — `ingredient.aliases text[]` + GIN-Index

**Bei DB-Schema-Änderungen**: Eine neue Migration `0007_*.sql` schreiben, NIE
bestehende editieren. Die laufende Supabase-DB ist die Wahrheit, die Migrationen
sind das Audit-Log.

## Kritische Konventionen — wenn ignoriert, kracht es

### 1. `process.env.NEXT_PUBLIC_*` IMMER als statischer Property-Access

```ts
// RICHTIG (Webpack inlinet zur Build-Zeit):
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;

// FALSCH (Webpack inlinet NICHT, im Browser → undefined):
function readEnv(name: string) {
  return process.env[name];   // dynamischer Index, nicht statisch
}
```

Lokal mit Turbopack funktioniert beides; im Vercel-Production-Build (Webpack)
nur die statische Variante. Das hat uns mehrere Stunden Debugging gekostet —
der Code in `src/lib/supabase/env.ts` zeigt das korrekte Pattern.

### 2. Middleware-Datei heißt `proxy.ts`, nicht `middleware.ts`

In Next.js 16 ist `middleware.ts` **deprecated** und durch `proxy.ts` ersetzt.
Datei: `src/proxy.ts`. Funktion heißt `proxy(request: NextRequest)` (default-
oder named export).

### 3. React Hook Form mit `useWatch`, nicht `form.watch()`

```ts
// FALSCH bei useFieldArray — Subscriptions klemmen, append() triggert kein Rerender:
const items = form.watch("ingredients");

// RICHTIG:
const items = useWatch({ control: form.control, name: "ingredients" });
```

Siehe `src/components/recipe/recipe-form.tsx`. Auch beim Plan-Editor.

### 4. Numerische Form-Felder ohne `z.coerce.number()`

`z.coerce.number()` macht den Input-Typ `unknown` und kollidiert mit dem RHF-
3-Generic-Pattern. Stattdessen `z.number()` und Konvertierung im `onChange`:

```ts
<Input
  type="number"
  value={typeof f.value === "number" && Number.isFinite(f.value) ? String(f.value) : ""}
  onChange={(e) => {
    const raw = e.target.value;
    if (raw === "") f.onChange(0);
    else {
      const n = Number(raw);
      f.onChange(Number.isFinite(n) ? n : 0);
    }
  }}
/>
```

Pattern überall im Projekt: `recipe-form.tsx`, `ingredient-form.tsx`, `settings/page.tsx`.

### 5. shadcn-Form überspringen, eigenen Field-Wrapper nutzen

`shadcn add form` hängt zuverlässig (Bug der CLI mit Tailwind v4). Wir haben
einen schlanken Field-Wrapper in `src/components/forms/field.tsx`, der mit
RHF-Controller arbeitet. Plus `preventEnterSubmit` für Keyboard-UX.

### 6. Dialog statt Sheet für Mobile-Drawer

Wir haben `shadcn add sheet` nicht gemacht (gleicher CLI-Bug). Stattdessen
nutzt `bottom-nav.tsx` einen handgerollten Slide-Up-Drawer mit Tailwind +
Backdrop. Funktioniert in iOS-Safari inkl. Safe-Area-Inset.

## Lokales Dev-Setup

```bash
# 1. .env.local einrichten
cp .env.example .env.local
# NEXT_PUBLIC_SUPABASE_URL=https://pjakqfcfrlpujjuivhjk.supabase.co
# NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
# SUPABASE_SERVICE_ROLE_KEY=eyJ...   ← nur lokal, niemals committen

# 2. Dependencies
npm install

# 3. BLS-Daten lokal lassen (BLS_4_0_2025_DE/) und einmal importieren:
npm run bls:import

# 4. Stammdaten + Rezepte seeden (idempotent):
npm run seed:ingredients <USER_EMAIL>
npm run seed:recipes <USER_EMAIL>

# 5. Dev-Server (Turbopack)
npm run dev
```

`USER_EMAIL` ist die Mail des Supabase-Users, dem die Daten gehören sollen.

## Skripte

| Befehl | Zweck |
|---|---|
| `npm run dev` | Dev-Server (Turbopack) |
| `npm run build` | Production-Build (Webpack) — **dies ist der Build, der auf Vercel läuft** |
| `npm test` | vitest run (Domain-Logik: Generator, BLS-Ranking, Ingredient-Search) |
| `npm run lint` | ESLint |
| `npm run bls:import` | BLS-XLSX → `bls_food` (idempotent) |
| `npm run seed:ingredients <email>` | Stammzutaten aus `seed-ingredients-proposal.md` |
| `npm run seed:recipes <email>` | Rezepte aus `seed-recipes-proposal.md` (Status: OK) |

## Vercel-Deployment

- Repo `malteFT/PlannerV2` → Branch `main` → Auto-Deploy
- Env-Variablen müssen für **Production** gesetzt sein:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` ist **nicht** auf Vercel — nur lokal.
- Bei Variablen-Änderung: Redeploy ohne Build-Cache erzwingen.
- Supabase Auth Site URL muss auf die Vercel-Domain zeigen
  (`https://planner-v2-ten.vercel.app`), Redirect URLs ebenfalls.

## Domain-Logik (testbar)

In `src/lib/domain/`:

- `nutrition.ts` — Mengen → Gramm, Makros pro Portion, Macros eines Meals
- `generator.ts` — Plan-Generator: `generatePlan`, `rerollMeal`,
  `aggregatePerDay`, `filterRecipesByExcludedIngredients`,
  `filterSuppressedRecipes`. Heuristik: clamp(serving_factor, 0.3, 3.0),
  Repeat-Penalty, Toleranz-Check, seedbares Tiebreaking.
- `ingredient-search.ts` — `ingredientMatchesQuery`, `ingredientRelevanceBucket`
  (Prefix > Wort-Prefix > Substring; bester Bucket aus name + alle aliases)

Tests: `src/lib/domain/__tests__/*.test.ts` und `src/lib/queries/__tests__/*.test.ts`.
22 Tests grün; jede Logik-Änderung an Generator/Suche braucht eine Test-
Erweiterung.

## Datenbank-Hooks

In `src/lib/queries/`:

- `bls.ts` — BLS-Suche mit Whitespace-Toleranz + Prefix-Ranking
- `ingredients.ts` — CRUD + `useIngredientUsage`, `normalizeAliases`
- `recipes.ts` — CRUD inkl. `recipe_ingredient`-Junction
- `plans.ts` — Plan-Lifecycle, RPC-Aufrufe für `activate_plan`,
  `update_plan_meal`, `delete_plan_meal`, `mark_meal_cooked`
- `shopping.ts` — RPC-Aufrufe für `check_shopping_item`,
  `uncheck_shopping_item`; manueller Add mit Aufaddier-Logik
- `inventory.ts` — Upsert, Delete

## Bekannte Eigenheiten

1. **BLS-Lizenz**: Die XLSX-Datei in `BLS_4_0_2025_DE/` darf nicht öffentlich
   committed werden. `.gitignore` schließt sie aus.

2. **Proxy-File `src/proxy.ts`**: Next 16 Konvention. Ein zukünftiger Linter
   oder Reviewer könnte fälschlich glauben, das müsse `middleware.ts` heißen
   — nein. Verifiziert in der Next-Doku.

3. **`scripts/seed-*.ts`**: nutzen `auth.admin.listUsers()` mit Service-Role-
   Key. Vorsicht bei Logging — der Key ist powerful.

4. **xlsx-Lib hat bekannte Vulnerabilities** (Prototype Pollution, ReDoS).
   Wird nur lokal beim BLS-Import benutzt, kein Browser-Code, kein User-Input.
   Akzeptiertes Risiko.

5. **Kein `output: 'standalone'` in `next.config.ts`** — wird auf Vercel nicht
   gebraucht. Fall self-hosting kommt: ergänzen.

6. **Forms verlassen sich auf `Field` von `@/components/forms/field`** —
   einheitliches Label/Error/Description-Pattern. Wenn neue Forms entstehen,
   dieses Pattern verwenden statt eigene Wrapper.

## Wichtige Dateien zum Reinschauen

Wenn du was am Projekt machen sollst, fang hier an:

- **Anforderungen**: `SPEC.md`
- **Architektur**: `ARCHITECTURE.md`
- **Datenmodell**: `src/lib/db/types.ts` + `supabase/migrations/`
- **Generator-Logik**: `src/lib/domain/generator.ts`
- **Layout-Shell**: `src/app/(app)/layout.tsx` + `components/layout/*`
- **Auth-Flow**: `src/proxy.ts` + `src/lib/supabase/{env,client,server,proxy}.ts`

## Konversations-Konventionen mit dem User

- Sprache: **Deutsch** in UI-Texten, Git-Commits, Doku, Konversation. Code-
  Identifier englisch.
- User schreibt Du, manchmal mit Tippfehlern oder unvollständig — erst klären
  bei Mehrdeutigkeit, dann handeln.
- **Vor nicht-trivialen Änderungen einen Plan kommunizieren**, auf Bestätigung
  warten. Bei Bugs/UI-Tweaks direkt umsetzen.
- **Outward-facing Aktionen** (Push, DB-Migration in Production) brauchen
  explizite Freigabe.
- User benutzt `/effort ultracode` und `/goal` aktiv. Wenn Ultracode an ist:
  Workflow-Tool benutzen für nicht-triviale Tasks.

## Letzter Stand der Heads

```
git log --oneline -5
6b9fb15 Rezept-Vorschlag: User-Korrekturen + alle auf OK
e6a733e Rezept-Vorschlag: 32 Rezepte + Seed-Skript
64863b8 Seed-Skript + BLS-Whitespace-Toleranz + Hafer-Flocken-Fix
3424b61 Aliases-Feature: Synonyme pro Zutat
a886fee BLS-Suche: Prefix-Ranking + erweitertes Limit, Seed-Vorschlag
```
