# Ernährungsplanner (PlannerV2)

Wochenplanung, automatisch abgeleitete Einkaufsliste und Vorratsmanagement,
mit Nährwerten auf BLS-4.0-Basis.

Doku: siehe [`SPEC.md`](./SPEC.md) und [`ARCHITECTURE.md`](./ARCHITECTURE.md).

## Setup (lokal)

### Voraussetzungen
- Node.js 20+
- Ein Supabase-Projekt (EU-Region empfohlen)
- BLS-4.0-Daten (`BLS_4_0_2025_DE/BLS_4_0_Daten_2025_DE.xlsx`) lokal
  hinterlegt — nicht im Repo enthalten.

### Schritte

1. Dependencies installieren
   ```bash
   npm install
   ```

2. Umgebung konfigurieren — `.env.example` zu `.env.local` kopieren und
   ausfüllen:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
   SUPABASE_SERVICE_ROLE_KEY=<service-role-key>     # nur lokal, niemals committen
   ```

3. DB-Schema in Supabase anlegen — den Inhalt von
   `supabase/migrations/0001_init.sql` im Supabase SQL-Editor ausführen.

4. BLS-Daten importieren
   ```bash
   npm run bls:import
   ```

5. Einen Supabase-User anlegen (Dashboard → Authentication → Users → Add user)
   — diese Mail+Passwort-Kombi ist dein Login.

6. Dev-Server
   ```bash
   npm run dev
   ```

## Skripte
- `npm run dev` — Dev-Server (Turbopack)
- `npm run build` — Produktions-Build
- `npm run start` — startet den Build
- `npm run lint` — ESLint
- `npm run bls:import` — BLS-Daten in Supabase importieren

## Stack
- Next.js 16 (App Router) + React 19 + TypeScript
- Tailwind CSS v4 + shadcn/ui
- Supabase (Auth, Postgres, RLS)
- TanStack Query, Zod, React Hook Form
