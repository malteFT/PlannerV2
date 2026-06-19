# Ernährungsplanner — Architektur

Stand: 2026-06-19
Bezug: SPEC.md (funktionale Spezifikation)
Status: Entwurf, bereit für Phase 1

---

## 1. Stack-Entscheidungen

### 1.1 Frontend-Framework: Next.js 15 (App Router) + React 19 + TypeScript

**Warum**
- Vercel ist die primäre Deployment-Zielumgebung; Next.js wird dort
  erstklassig unterstützt (Edge-Runtime, ISR, Server Actions out of the box).
- App Router erlaubt saubere Trennung Server/Client und Server Actions für
  Mutations ohne separate API-Routen.
- TypeScript ist in einem Datenmodell-zentrierten Projekt (Nährwerte,
  Mengen, Einheiten) ein deutlicher Sicherheitsgewinn.

**Tradeoffs**
- App Router-Patterns (Server vs. Client Components, Caching, Revalidation)
  haben Lernkurve.
- Alternative wäre Remix oder Vite + React Router. Beide sind valide, aber
  Vercel + Next.js hat die geringste Setup-Reibung.

### 1.2 UI-Komponenten: shadcn/ui + Tailwind CSS

**Warum**
- Komponenten werden in das Repo kopiert, nicht als Library installiert →
  volle Kontrolle, kein Lock-in, einfache Anpassung.
- Tailwind ist Standard im Next.js-Ökosystem, sehr kurze Distanz zwischen
  Idee und UI.
- Erfüllt den Anspruch "modern, klar" ohne dass wir eigenes Design-System
  bauen müssen.

**Tradeoffs**
- shadcn/ui basiert auf Radix UI Primitives → hochqualitative
  Accessibility, dafür mehr Boilerplate als z.B. Mantine.
- Alternativen: Mantine (mehr Out-of-the-Box, weniger Kontrolle), MUI
  (schwergewichtig, weniger "modern"), Chakra (in Wartung-Limbo).

### 1.3 Backend / DB / Auth: Supabase

**Warum**
- Free Tier mit 500 MB DB / 5 GB Bandbreite ausreichend für MVP und
  Privatnutzung.
- Postgres mit Row-Level-Security ist die saubere Lösung für
  user-scoped Daten.
- Auth (E-Mail/Passwort, Magic Link) ohne eigenen Server.
- Auto-generierte REST/Realtime-API; wir greifen über `@supabase/supabase-js`
  zu.

**Tradeoffs**
- Vendor-Lock-in besteht teilweise (Auth, RLS-Syntax). DB ist Standard-
  Postgres → migrierbar.
- Latenz Vercel ↔ Supabase abhängig von Region. Beide auf EU-Region
  setzen (Frankfurt).

### 1.4 Daten-Layer: Supabase JS Client + TanStack Query (React Query) v5

**Warum**
- TanStack Query liefert Caching, Invalidation, Optimistic Updates
  out of the box.
- Server Actions in Next.js für Mutations möglich, aber Mix mit Supabase
  Auth aus Browser ist einfacher rein clientseitig:
  - Browser hält Auth-Session in localStorage.
  - Supabase JS spricht direkt mit Supabase (mit RLS abgesichert).
  - Kein eigenes Backend-Layer nötig für Standard-CRUD.
- Komplexere Logik (Plan-Generator, Einkaufsliste neu berechnen) kann als
  Postgres-Funktion oder als Client-Funktion implementiert werden — wir
  starten mit Client, weil Logik dort einfacher zu testen und zu iterieren
  ist.

**Tradeoffs**
- Reine Client-Architektur erschwert SSR-Daten-Hydration. Akzeptiert für
  diese App (User ist eingeloggt, nichts SEO-relevant).

### 1.5 Validierung: Zod

**Warum**
- Schema-First-Validierung für Forms, API-Antworten, BLS-Import.
- Komponiert gut mit React Hook Form.

### 1.6 Forms: React Hook Form

Kombiniert mit Zod-Resolver — Standardstack für Next.js + shadcn.

### 1.7 Tests (MVP-Pragmatik)

- **Unit**: Vitest für reine Logik (Generator, Mengen-Aggregation,
  Skalierung, Einheiten-Konvertierung).
- **E2E**: optional, später. Für MVP nicht zwingend.

### 1.8 Tooling

- **Package Manager**: pnpm (schneller, saubere Hoisting-Regeln).
- **Linting**: ESLint mit Next-Defaults.
- **Formatting**: Prettier.

---

## 2. Projektstruktur

```
PlannerV2/
├── BLS_4_0_2025_DE/                 # Quelldaten (nicht in Git? — siehe unten)
├── SPEC.md
├── ARCHITECTURE.md
├── README.md
├── package.json
├── pnpm-lock.yaml
├── next.config.ts
├── tsconfig.json
├── tailwind.config.ts
├── postcss.config.mjs
├── .env.local                        # NICHT eingecheckt
├── .env.example                      # Template
├── .gitignore
├── public/
├── scripts/
│   └── import-bls.ts                 # einmaliger Import in Supabase
├── supabase/
│   ├── migrations/                   # SQL-Migrationen
│   │   ├── 0001_init.sql
│   │   ├── 0002_bls_lookup.sql
│   │   └── ...
│   └── seed.sql                      # Seed-Rezepte
└── src/
    ├── app/                          # Next.js App Router
    │   ├── layout.tsx
    │   ├── page.tsx                  # → redirect /plan
    │   ├── (auth)/
    │   │   ├── login/page.tsx
    │   │   └── auth/callback/route.ts
    │   ├── (app)/                    # geschützte Routen, Layout mit Sidebar
    │   │   ├── layout.tsx
    │   │   ├── plan/
    │   │   │   ├── page.tsx              # aktiver Plan
    │   │   │   └── generate/page.tsx     # neuen Plan generieren
    │   │   ├── shopping/page.tsx
    │   │   ├── inventory/page.tsx
    │   │   ├── recipes/
    │   │   │   ├── page.tsx
    │   │   │   ├── new/page.tsx
    │   │   │   └── [id]/page.tsx
    │   │   ├── ingredients/
    │   │   │   ├── page.tsx
    │   │   │   ├── new/page.tsx
    │   │   │   └── [id]/page.tsx
    │   │   ├── history/
    │   │   │   ├── page.tsx
    │   │   │   └── [id]/page.tsx
    │   │   └── settings/page.tsx
    │   └── api/                          # nur falls echte Server-Endpoints nötig
    ├── components/
    │   ├── ui/                       # shadcn-Komponenten (kopiert)
    │   ├── layout/
    │   ├── plan/
    │   ├── recipe/
    │   ├── ingredient/
    │   ├── shopping/
    │   └── inventory/
    ├── lib/
    │   ├── supabase/
    │   │   ├── client.ts             # Browser-Client
    │   │   ├── server.ts             # Server-Client (RSC, Route Handler)
    │   │   └── types.ts              # generierte DB-Typen
    │   ├── domain/                   # reine Business-Logik, framework-frei
    │   │   ├── nutrition.ts          # kcal/Makro-Berechnung
    │   │   ├── units.ts              # Einheiten/Konvertierung
    │   │   ├── generator.ts          # Plan-Generator
    │   │   ├── shopping-list.ts      # Aggregation, Vorratsverrechnung
    │   │   └── __tests__/
    │   ├── queries/                  # TanStack Query Hooks (use*)
    │   ├── mutations/
    │   ├── validators/               # Zod-Schemas
    │   └── utils.ts
    └── styles/
        └── globals.css
```

### Anmerkung zum BLS-Ordner

Die BLS-Quelldateien (`.xlsx`, `.pdf`) sind groß und urheberrechtlich
geschützt (BLS ist nicht frei lizensiert, Lizenznehmer dürfen die Daten
nutzen, aber nicht öffentlich publizieren). **Diese Dateien gehören nicht
in das öffentliche Git-Repo.** Empfehlung:

- `.gitignore` schließt `BLS_4_0_2025_DE/` aus.
- Lokal verwendet, einmal per Importskript in Supabase geladen.
- README dokumentiert, wo die Datei lokal liegen muss.

---

## 3. Datenbank-Schema

Postgres in Supabase. Alle user-scoped Tabellen haben `user_id uuid` und
RLS-Policy "user kann nur eigene Zeilen sehen/bearbeiten".

### 3.1 BLS-Lookup (global, read-only)

```sql
create table public.bls_food (
  bls_code text primary key,
  name_de text not null,
  kcal_per_100g numeric(8,2) not null,
  protein_per_100g numeric(8,2) not null,
  carbs_per_100g numeric(8,2) not null,
  fat_per_100g numeric(8,2) not null
);

create index bls_food_name_de_trgm
  on public.bls_food using gin (name_de gin_trgm_ops);

alter table public.bls_food enable row level security;
create policy "bls_food readable by authenticated"
  on public.bls_food for select
  to authenticated using (true);
```

Trigram-Index für schnelles Autocomplete auf `name_de`.

### 3.2 Stammdaten (user-scoped)

```sql
-- Zutat
create type public.ingredient_unit as enum ('g', 'ml', 'piece');

create table public.ingredient (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null,
  bls_code text not null references public.bls_food(bls_code),
  default_unit public.ingredient_unit not null,
  grams_per_piece numeric(8,2),                    -- nur wenn default_unit = piece
  category text not null,                          -- z.B. 'Gemüse', 'Milchprodukte'
  excluded boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint piece_requires_grams
    check (default_unit <> 'piece' or grams_per_piece is not null)
);

create unique index ingredient_user_name on public.ingredient(user_id, display_name);

-- Rezept
create table public.recipe (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  meal_types text[] not null,                      -- {'breakfast','lunch',...}
  base_servings numeric(6,2) not null check (base_servings > 0),
  instructions text not null default '',
  suppressed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.recipe_ingredient (
  recipe_id uuid not null references public.recipe(id) on delete cascade,
  ingredient_id uuid not null references public.ingredient(id) on delete restrict,
  amount numeric(10,2) not null check (amount > 0),
  unit public.ingredient_unit not null,
  position integer not null default 0,
  primary key (recipe_id, ingredient_id)
);
```

### 3.3 Plan, Mahlzeiten

```sql
create type public.plan_status as enum ('draft','active','archived');

create table public.plan (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text,
  day_count integer not null check (day_count between 1 and 31),
  day_labels text[] not null,                      -- length = day_count
  status public.plan_status not null default 'draft',
  created_at timestamptz not null default now(),
  activated_at timestamptz,
  archived_at timestamptz
);

-- höchstens ein aktiver Plan pro User
create unique index plan_one_active_per_user
  on public.plan(user_id) where status = 'active';

create type public.meal_slot as enum ('breakfast','lunch','dinner','snack');

create table public.plan_meal (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plan(id) on delete cascade,
  day_index integer not null check (day_index >= 0),
  meal_slot public.meal_slot not null,
  recipe_id uuid references public.recipe(id) on delete set null,
  serving_factor numeric(6,3) not null default 1 check (serving_factor > 0),
  cooked boolean not null default false,
  cooked_at timestamptz,
  unique (plan_id, day_index, meal_slot)
);
```

### 3.4 Vorrat

```sql
create table public.inventory_item (
  user_id uuid not null references auth.users(id) on delete cascade,
  ingredient_id uuid not null references public.ingredient(id) on delete cascade,
  amount numeric(10,2) not null default 0 check (amount >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, ingredient_id)
);
```

### 3.5 Einkaufsliste

```sql
create table public.shopping_list_item (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid not null references public.plan(id) on delete cascade,
  ingredient_id uuid not null references public.ingredient(id) on delete restrict,
  required_amount numeric(10,2) not null default 0,
  to_buy_amount numeric(10,2) not null default 0,
  unit public.ingredient_unit not null,
  checked boolean not null default false,
  checked_at timestamptz,
  manual boolean not null default false,
  created_at timestamptz not null default now(),
  unique (plan_id, ingredient_id)
);
```

### 3.6 Settings

```sql
create table public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  target_kcal_per_day integer not null default 2000,
  protein_pct numeric(5,2) not null default 30,
  carbs_pct numeric(5,2) not null default 40,
  fat_pct numeric(5,2) not null default 30,
  meal_slots public.meal_slot[] not null default array['breakfast','lunch','dinner']::meal_slot[],
  meal_slot_pct numeric(5,2)[] not null default array[30, 40, 30]::numeric[],
  tolerance_pct numeric(5,2) not null default 5,
  excluded_ingredient_ids uuid[] not null default '{}',
  updated_at timestamptz not null default now(),
  constraint macros_sum_100 check (protein_pct + carbs_pct + fat_pct = 100),
  constraint meal_slot_lengths_match check (array_length(meal_slots,1) = array_length(meal_slot_pct,1))
);
```

### 3.7 RLS-Policies (Pattern)

Für jede user-scoped Tabelle dieselbe Logik:

```sql
alter table public.<table> enable row level security;

create policy "<table>_select_own"
  on public.<table> for select
  using (auth.uid() = user_id);

create policy "<table>_insert_own"
  on public.<table> for insert
  with check (auth.uid() = user_id);

create policy "<table>_update_own"
  on public.<table> for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "<table>_delete_own"
  on public.<table> for delete
  using (auth.uid() = user_id);
```

Für `recipe_ingredient` und `plan_meal` (haben kein eigenes `user_id`):
Policy über das Eltern-Objekt:

```sql
create policy "recipe_ingredient_own"
  on public.recipe_ingredient
  for all
  using (exists (
    select 1 from public.recipe r
    where r.id = recipe_ingredient.recipe_id and r.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.recipe r
    where r.id = recipe_ingredient.recipe_id and r.user_id = auth.uid()
  ));
```

Analog für `plan_meal` über `plan`.

### 3.8 Trigger

- `updated_at` automatisch via Trigger auf `ingredient`, `recipe`,
  `inventory_item`, `user_settings`.
- `auth.users → user_settings`: Trigger, der bei neuem User die
  Default-Settings-Zeile anlegt.

---

## 4. BLS-Import

### 4.1 Strategie

- Einmaliger Import beim Setup.
- Quelle: `BLS_4_0_2025_DE/BLS_4_0_Daten_2025_DE.xlsx`.
- Skript: `scripts/import-bls.ts`, ausführbar via `pnpm bls:import`.
- Idempotent: `insert ... on conflict (bls_code) do update`.

### 4.2 Felder-Mapping

Aus der BLS-Struktur extrahieren wir nur den Kern:

| BLS-Spalte (typisch) | Ziel                | Typ            |
|----------------------|---------------------|----------------|
| `SBLS`               | `bls_code`          | text (PK)      |
| `ST`                 | `name_de`           | text           |
| `GCAL`               | `kcal_per_100g`     | numeric(8,2)   |
| `ZE`                 | `protein_per_100g`  | numeric(8,2)   |
| `ZK`                 | `carbs_per_100g`    | numeric(8,2)   |
| `ZF`                 | `fat_per_100g`      | numeric(8,2)   |

Spaltennamen werden beim Import gegen die `BLS_4_0_Components_DE_EN.xlsx`
Dokumentation verifiziert (kann minimal abweichen). Der Import-Skript-PR
loggt eine Übersicht, was gemappt wurde.

### 4.3 Ausführung

```bash
# Voraussetzungen
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...   # nur lokal, nie im Frontend

pnpm bls:import
```

Service-Role-Key ist nötig, weil das Skript die `bls_food`-Tabelle
schreibt (alle Schreibrechte). Wir verwenden ihn ausschließlich aus dem
Skript heraus, niemals im Browser-Code.

---

## 5. Daten-Strategie im Frontend

### 5.1 Auth

- `@supabase/ssr` für Next.js (Server + Client Variants).
- `middleware.ts` schützt alle `(app)`-Routen: ohne Session →
  `/login`-Redirect.
- Session lebt in Cookies (httpOnly), nicht localStorage → SSR-fähig.

### 5.2 Querying

Pro Domain ein Hook in `lib/queries/`:

```
useIngredients()
useIngredient(id)
useRecipes(filter?)
useRecipe(id)
useActivePlan()
usePlan(id)
useShoppingList()         # für aktiven Plan
useInventory()
useSettings()
useBlsSearch(term)        # debounced Autocomplete
useHistory()
```

Mutations entsprechend in `lib/mutations/` mit Invalidation-Logik:

- Rezept ändern → invalidiere `recipes`, `recipe(id)`, falls referenziert
  vom aktiven Plan auch `activePlan`.
- "Gekocht"-Haken → invalidiere `activePlan`, `inventory`.
- Einkaufsliste-Item abhaken → invalidiere `shoppingList`, `inventory`.

### 5.3 Komplexe Operationen

Drei Operationen sind zu komplex für einzelne CRUD-Calls und werden als
**Transaktion** umgesetzt — entweder per Supabase RPC (Postgres-Funktion
in SQL) oder als JS-Funktion mit mehreren Supabase-Calls in
Try/Rollback-Manier:

1. **Plan festlegen** (Draft → Active):
   - Alten aktiven Plan archivieren (`status='archived'`, `archived_at`).
   - Neuen Plan aktivieren (`status='active'`, `activated_at`).
   - Initiale Einkaufsliste erzeugen aus `plan_meal` × `recipe_ingredient`,
     aggregiert pro `ingredient_id`, verrechnet mit `inventory_item`.
   - **Empfehlung**: als Postgres-Funktion `activate_plan(plan_id uuid)`,
     transaktional, atomar.

2. **Mahlzeit im aktiven Plan tauschen/löschen**:
   - Bedarf-Delta berechnen (alte vs. neue Mahlzeit).
   - Auf `shopping_list_item.required_amount` und `to_buy_amount`
     aufrechnen, abgehakte Items nicht zurückrollen.
   - **Empfehlung**: als Postgres-Funktion oder im Client mit klar
     abgrenzten Steps. Start: Client-Funktion, später bei Bedarf
     RPC-isieren.

3. **Einkaufsliste-Item abhaken**:
   - `shopping_list_item.checked = true`, `checked_at = now()`.
   - `inventory_item.amount += to_buy_amount`.
   - **Empfehlung**: Postgres-Funktion `check_shopping_item(id uuid)`,
     einfach und atomar.

### 5.4 Realtime

Supabase Realtime für `plan`, `plan_meal`, `shopping_list_item`,
`inventory_item` aktivieren — sodass Laptop und Handy ohne Refresh
synchronisieren.

Im MVP optional: erst nach Funktionalität, vor Polish.

---

## 6. Generator-Implementierung

In `lib/domain/generator.ts`. Reine Funktion, framework-frei.

```ts
type GeneratorInput = {
  dayCount: number
  mealSlots: MealSlot[]
  mealSlotPct: number[]
  targetKcalPerDay: number
  macroPct: { protein: number; carbs: number; fat: number }
  tolerancePct: number
  recipes: RecipeWithNutrition[]      // bereits gefiltert: nicht suppressed,
                                       // keine excluded ingredients
}

type GeneratedMeal = {
  dayIndex: number
  mealSlot: MealSlot
  recipeId: string
  servingFactor: number
}

function generatePlan(input: GeneratorInput): GeneratedMeal[]
```

Einzelner Slot-Tausch:

```ts
function rerollMeal(
  input: GeneratorInput,
  existingMeals: GeneratedMeal[],
  target: { dayIndex: number; mealSlot: MealSlot }
): GeneratedMeal
```

### Nährwert-Berechnung pro Rezept

`lib/domain/nutrition.ts`:

```ts
function computeRecipeNutritionPerBaseServing(
  recipe: Recipe,
  ingredients: IngredientWithBls[]
): { kcal: number; protein: number; carbs: number; fat: number }
```

Regel zur Mengen-Konvertierung in Gramm (für Nährwerte):

- `unit = 'g'`: Wert direkt.
- `unit = 'ml'`: für MVP Annahme Dichte = 1 (Wasser-äquivalent). Genauere
  Dichten verschieben wir; Hinweis im UI bei `ml` sinnvoll.
- `unit = 'piece'`: `amount * grams_per_piece`.

### Tests

Unit-Tests für:
- Skalierungs-Mathematik trifft kcal-Ziel ± 5 %.
- Wiederholungs-Constraint (nicht zweimal pro Tag).
- Excluded-Ingredients-Filter wirkt.
- Edge: Pool zu klein für Slot → klare Fehlermeldung.

---

## 7. Einkaufsliste-Logik

In `lib/domain/shopping-list.ts`.

### 7.1 Bedarfsberechnung

Für jedes `plan_meal` mit Rezept:
```
für jede recipe_ingredient ri:
  Menge_in_Standardeinheit = convertToIngredientDefaultUnit(
    ri.amount, ri.unit, ingredient
  ) * plan_meal.serving_factor
```

Aggregation pro `ingredient_id`: Summe über alle nicht-leeren Mahlzeiten.

### 7.2 Vorratsverrechnung

```
to_buy = max(0, required − inventory.amount)
```

### 7.3 Item abhaken

```
inventory.amount += to_buy_amount  -- der Snapshot, nicht required
shopping_list_item.checked = true
```

### 7.4 Mahlzeit nach Plan-Aktivierung tauschen

```
delta_required = sum(recipe_neu × factor_neu) − sum(recipe_alt × factor_alt)
                 (pro ingredient)

für jede betroffene ingredient:
  required_amount += delta_required
  to_buy_amount = max(0, required_amount − inventory.amount)
                  -- aber: bereits gebuyt (checked) wird nicht zurückgenommen
```

Detail: wenn `delta_required` negativ wird und das Item ist schon gekauft,
muss `required_amount` nicht unter den bereits-gekauften Wert fallen, weil
sonst Inkonsistenz entsteht. Konkrete Formel präzisiert in der Phase, in
der wir diesen Code schreiben.

---

## 8. Routing & Auth-Flow

```
/                          → redirect zu /plan (falls eingeloggt) oder /login
/login                     → Supabase Auth UI / eigenes Form
/auth/callback             → OAuth/Magic-Link-Callback

/plan                      → aktiver Plan (oder leerer Zustand mit CTA "Plan erstellen")
/plan/generate             → Generator + Draft-Vorschau
/shopping                  → Einkaufsliste zum aktiven Plan
/inventory                 → Vorrat
/recipes                   → Rezeptliste
/recipes/new
/recipes/[id]
/ingredients               → Zutatenkatalog
/ingredients/new
/ingredients/[id]
/history                   → archivierte Pläne
/history/[id]
/settings
```

Middleware-Schutz für alles unter `(app)`.

---

## 9. Phasenplan

Jede Phase liefert lauffähigen Stand. Nach jeder Phase: kurzer Check, ob
Akzeptanzkriterien-Subset erfüllt ist, dann committen.

### Phase 0: Setup
- Next.js + TS + Tailwind + shadcn-Init
- pnpm-Workspace, ESLint, Prettier
- Supabase-Projekt anlegen (durch dich), `.env.local` befüllen
- Supabase-Client-Setup (Browser + Server, `@supabase/ssr`)
- Middleware für geschützte Routen
- Login-Seite mit Supabase Auth
- App-Shell mit Sidebar/Mobile-Nav (leer)
- BLS-Import-Skript schreiben + einmalig ausführen
- Repo: lokales Git initialisieren, Remote `malteFT/PlannerV2`
  verbinden, `.gitignore` mit `BLS_4_0_2025_DE/`, `.env.local`,
  `node_modules/`, `.next/`

**Deliverable**: Login funktioniert, BLS-Daten in der DB, leeres
App-Layout sichtbar.

### Phase 1: Stammdaten
- DB-Migrationen für `ingredient`, `recipe`, `recipe_ingredient`,
  `user_settings` + RLS + Trigger
- Zutatenkatalog: Liste, Detail, Anlegen, Bearbeiten, Löschen
  (BLS-Autocomplete, Einheit, Stück→g, Kategorie)
- Settings-Seite (kcal, Makros, Mahlzeiten-Slots inkl. Edit-Modus,
  Toleranz)
- Rezepte: Liste, Detail, Anlegen, Bearbeiten, Löschen
- Live-Nährwertanzeige im Rezept-Editor
- "Suppressed"-Toggle pro Rezept

**Deliverable**: Pflege von Zutaten und Rezepten end-to-end,
Settings persistent.

### Phase 2: Plan-Generator
- DB-Migrationen für `plan`, `plan_meal`
- `lib/domain/generator.ts` mit Tests
- `/plan/generate`: Form (Tagesanzahl, Labels), Generieren-Button,
  Draft-Vorschau mit Tagesübersicht und Kennzahlen
- Pro Mahlzeit: neu würfeln, manuell ersetzen, Portionsfaktor anpassen
- "Festlegen" / "Verwerfen"
- `/plan`: aktiver Plan, Mahlzeit-Detail, "Gekocht"-Haken (zunächst noch
  ohne Vorrats-Effekt — der kommt in Phase 4)

**Deliverable**: Plan generierbar, festlegbar, sichtbar,
manuell editierbar.

### Phase 3: Einkaufsliste
- DB-Migration für `shopping_list_item`
- Postgres-Funktion `activate_plan(plan_id uuid)` (oder Client-Logik mit
  Transaktion-Approximation): erzeugt Snapshot
- `/shopping`: Liste nach Kategorie, Abhaken, "Erledigt"-Sektion,
  manuelles Hinzufügen
- Re-Aggregation bei Mahlzeit-Tausch im aktiven Plan

**Deliverable**: Einkaufsliste live, beim Plan-Festlegen erzeugt,
während des Einkaufs nutzbar.

### Phase 4: Vorrat
- DB-Migration für `inventory_item`
- `/inventory`: Liste, manuelle Mengen-Korrektur
- "Gekocht"-Haken einer Mahlzeit reduziert Vorrat
- Abhaken in Einkaufsliste erhöht Vorrat (Postgres-Funktion
  `check_shopping_item(id uuid)`)
- Re-Berechnung Einkaufsliste nutzt aktuellen Vorrat bei Tausch

**Deliverable**: Vollständiger Kreislauf Plan → Einkauf → Vorrat → Kochen
funktioniert.

### Phase 5: Historie + Polish
- `/history`: Liste archivierter Pläne, Detailansicht read-only,
  archivierte Einkaufslisten
- Mobile-Feinschliff: Touch-Targets, Bottom-Nav statt Sidebar auf
  Smartphones
- Loading-States, Error-States, leere Zustände
- Realtime aktivieren für Sync zwischen Geräten
- Seed-Skript für ~10 Start-Rezepte (idempotent, opt-in via `pnpm seed`)
- README mit Setup-Anleitung
- Unit-Test-Coverage für `lib/domain` aufrunden

**Deliverable**: MVP "fertig" gemäß Akzeptanzkriterien in SPEC.md §11.

---

## 10. Risiken & Annahmen

- **BLS-Spaltennamen**: Wir gehen davon aus, dass die Excel-Datei die
  Standard-Spalten `SBLS, ST, GCAL, ZE, ZK, ZF` enthält. Beim ersten
  Import-Run wird das verifiziert; ggf. Mapping anpassen.
- **Lizenz BLS**: Datei nicht ins öffentliche Repo. Annahme: deine
  Nutzung ist lizensiert.
- **Free Tier Supabase**: 500 MB DB ist mehr als ausreichend für
  persönliche Nutzung; BLS hat ~10–15k Einträge × ~50 B = wenige MB.
- **Realtime ist optional**: Falls Bandbreite des Free Tiers knapp wird,
  fallen wir auf manuelles Refresh / Polling zurück.
- **Generator-Heuristik**: ±5 % Toleranz ist mit freier Skalierung gut
  zu treffen, weil ein Rezept beliebig skaliert werden kann. Risiko:
  unrealistisch große/kleine Portionen. Mitigation: Soft-Limits 0.3 – 3.0
  als Default, in Settings übersteuerbar (später).

---

## 11. Was als nächstes passiert

Sobald du grünes Licht gibst, startet **Phase 0**:

1. Du legst ein Supabase-Projekt an (EU-Region) und gibst mir die
   Anon-URL + Anon-Key (für `.env.local`); der Service-Role-Key bleibt
   nur lokal und wird nie commitet.
2. Ich initialisiere das Next.js-Projekt im aktuellen Ordner, verbinde
   das Repo, schreibe das BLS-Importskript, baue Auth + App-Shell.
3. Wir prüfen den Stand zusammen, dann Phase 1.

Falls du noch Anpassungen am Stack oder an den Phasen-Schnitten möchtest,
sag jetzt Bescheid.
