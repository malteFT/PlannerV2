# Ernährungsplanner — Funktionale Spezifikation

Stand: 2026-06-19
Status: **As-built — siehe Block unten.** Originalspezifikation erhalten als
historischer Snapshot, Abweichungen am Ende dokumentiert.

---

## As-built (Stand 2026-06-19)

### Was tatsächlich gebaut ist

**Alle Akzeptanzkriterien aus §11 sind erfüllt** (Login, BLS-Daten in DB, Zutaten-
und Rezeptpflege mit Live-Nährwerten, Settings inkl. Edit-Modus für Mahlzeiten-
Slots, Plan-Generator mit ±5 % Toleranz, Festlegen → Einkaufsliste, abhaken →
Vorrat, Vorrat manuell pflegbar, Mahlzeit-Tausch im aktiven Plan aktualisiert
die Einkaufsliste über `reaggregate_shopping_list`-RPC, Historie read-only,
Sync zwischen Geräten via Refresh — Realtime nicht aktiviert).

**Erweiterungen über die Original-Spezifikation hinaus:**

1. **Aliases auf Zutaten** (`ingredient.aliases text[]`) — Synonyme, die im
   Rezept-Editor und der Zutaten-Liste durchsucht werden. Beispiel: "Nudeln"
   mit Aliasen ["Spaghetti", "Penne", "Pasta", "Makkaroni", "Fusilli"] —
   Suche nach "Penne" findet "Nudeln". Migration `0006_ingredient_aliases.sql`.

2. **BLS-Suche mit Whitespace-Toleranz** — "Haferflocken" findet "Hafer Flocken"
   (BLS schreibt es auseinander). Plus Prefix-Ranking: "Dinkel" zeigt
   "Dinkelteigwaren" weit oben statt auf Platz 27.

3. **Plan-Snapshots der Settings** — `plan.target_kcal_per_day`,
   `meal_slots`, `meal_slot_pct`, `protein_pct`, `carbs_pct`, `fat_pct`
   werden beim Aktivieren in den Plan kopiert. Spätere Settings-Änderungen
   beeinflussen aktive/archivierte Pläne nicht.

4. **Cooked-Snapshot** (`plan_meal.cooked_subtractions jsonb`) — beim Cook-
   Häkchen werden die tatsächlich subtrahierten Vorrats-Mengen pro Zutat
   gespeichert. Un-Cook addiert exakt diese Werte zurück, auch wenn das
   Rezept zwischenzeitlich getauscht wurde.

5. **Edit-Modus auf der Plan-Seite** — Standardansicht zeigt nur Rezeptname/
   Faktor/kcal/Cooked-Switch. Aktionen (Würfeln, Tauschen, Faktor anpassen,
   Löschen) liegen hinter einem Stift-Toggle.

6. **Mobile Bottom-Sheet "Mehr"** — die fünf Kern-Items (Plan, Einkauf,
   Vorrat, Rezepte, Mehr) plus ein Drawer für Zutaten/Historie/Settings.

7. **Seed-Skripte** — `npm run seed:ingredients` und `npm run seed:recipes`
   parsen `seed-ingredients-proposal.md` / `seed-recipes-proposal.md` und
   legen die Stammdaten idempotent an. Nutzbar für neue User später.

8. **63 kuratierte Stammzutaten + 31 kuratierte Rezepte** sind im aktuellen
   User-Account angelegt (Allesfresser-Profil, 1-Personen-Portionen).

### Was bewusst nicht implementiert ist

- **Realtime-Sync zwischen Geräten** — Supabase Realtime ist nicht aktiviert.
  Refresh holt aktuellen Stand. Phase-5-Polish-Punkt, nicht akut nötig für
  Single-User.
- **Multi-User-Sharing eines Plans** — Datenmodell mit `user_id` und RLS
  unterstützt es technisch, aber kein UI-Flow.
- **Öffentliche Registrierung** — User werden manuell im Supabase-Dashboard
  angelegt. Kein `/signup`-Flow in der App.
- **Seed-Daten für neue User** — beim ersten Login eines neuen Users
  passiert nichts. Wenn das später öffentlich gemacht werden soll, wird ein
  `clone_seed_data_for_user`-Trigger nötig.
- **Export / Druck des Plans** — bewusst weggelassen (SPEC §1 Nicht-Ziele).
- **Allergie-Engine** — die Excluded-Ingredients-Funktion in Settings ersetzt
  das pragmatisch.

### Bekannte offene Punkte

- **Live-Test der Re-Aggregation**: das Erzeugen der Einkaufsliste beim
  Plan-Aktivieren ist live verifiziert. Der Pfad "Mahlzeit im **aktiven**
  Plan tauschen → Einkaufsliste passt sich an" ist im Code (RPCs
  `update_plan_meal` / `delete_plan_meal` rufen `reaggregate_shopping_list`)
  und durch Migration 0005 in der DB, aber wir haben ihn nicht durchgeklickt.
- **Vercel-Region**: läuft in Washington (iad1), Supabase in Zürich. Sollte
  auf Frankfurt (fra1) gestellt werden für ~50–100 ms weniger Latenz.

### Stand der Konversations-/Spec-Entscheidungen

Die meisten Detailentscheidungen aus §1–§9 dieser Spec wurden so umgesetzt.
Wo kleinere Abweichungen entstanden sind:

- **§3 Auth**: nur Email/Passwort, kein Magic Link. User wird im Dashboard
  angelegt.
- **§4.3 Toleranz Default**: 5 % gemäß Spec.
- **§4.4 Wiederholungs-Policy**: hartes "kein Doppel pro Tag", weiches
  "minimieren über Plan" (Repeat-Penalty im Score). Keine harten Wiederholungs-
  Limits über Tagesgrenze hinweg — User kann mehr Variation durch mehr
  Rezepte erreichen.
- **§6.4 Mahlzeit löschen**: Slot bleibt erhalten (`recipe_id = NULL`), wie
  in der Spec beschrieben — implementiert in `delete_plan_meal`-RPC. UI für
  "leerer Slot wieder befüllen" ist vorhanden über Tausch.
- **§9 UI-Anspruch "modern"**: erfüllt durch Linear/Yazio-nahen Look mit
  Inter-Font und Indigo-Akzent. Empty-States und Skeleton-Loader durchgängig.

---

## Originalspezifikation

(Unverändert ab hier. Historischer Snapshot vom Phase-0-Setup; gegenüber
heute leicht überholt — die obigen Erweiterungen sind die Wahrheit.)

---


## 1. Ziel & Kontext

Eine Web-App zur Wochen-/Mehrtages-Essensplanung für einen Nutzer (technisch
multi-user-fähig vorbereitet), die mit einem Klick einen Plan über N Tage
generiert, daraus eine mit dem Vorrat verrechnete Einkaufsliste ableitet und
das Vorratsmanagement integriert. Nährwerte basieren auf dem
Bundeslebensmittelschlüssel (BLS 4.0).

### Zielplattform
- Web-App (Desktop + Mobile-Browser), Internet erforderlich
- Hosting: Vercel
- Backend/DB/Auth: Supabase (Postgres, Auth, RLS)

### Nicht-Ziele (MVP)
- Offline-Betrieb / PWA-Installation
- Export/Druck des Wochenplans
- Teilen der Einkaufsliste
- Allergie-Engine
- Multi-User-Sharing eines Plans
- Mobile native App

---

## 2. Begriffe

- **Plan**: Ein zusammenhängender Zeitraum von N Tagen mit zugewiesenen
  Mahlzeiten je Tag.
- **Aktiver Plan**: Der eine Plan, der gerade läuft. Es gibt höchstens einen
  aktiven Plan.
- **Historie**: Alle früheren Pläne (abgeschlossen oder verworfen).
- **Mahlzeiten-Slot**: Eine Position im Tag (z.B. Frühstück, Mittag, Abend,
  optional Snack). Konfigurierbar in den Settings.
- **Rezept**: Zubereitungsvorschrift mit Zutatenliste (Mengen pro Basisportion),
  Mahlzeitenkategorie, Anleitungstext, Standard-Portionen.
- **Zutat**: Ein Eintrag im Zutatenkatalog. Verknüpft mit einem BLS-Eintrag,
  hat einen Anzeigenamen, eine Standardeinheit (g/ml/Stück) und ggf. einen
  Stück→g-Faktor.
- **BLS-Eintrag**: Ein Datensatz aus dem Bundeslebensmittelschlüssel; liefert
  Nährwerte pro 100g.
- **Vorrat / Inventar**: Was der Nutzer aktuell zu Hause hat, pro Zutat mit
  Menge in Standardeinheit.
- **Einkaufsliste**: Aus dem aktiven Plan abgeleitete Liste; Bedarf minus
  Vorrat, aggregiert pro Zutat.

---

## 3. Nutzer & Auth

- Login per Supabase Auth (E-Mail + Passwort, Magic Link optional).
- Alle Daten user-scoped via Row-Level-Security in Postgres.
- Single-User-Nutzung im Alltag, aber Datenmodell und RLS so gebaut, dass
  weitere Nutzer ohne Migration dazukommen können.

---

## 4. Settings (globales Profil)

Ein einziges Profil pro Nutzer, beim Generieren immer angewandt.

### 4.1 Energieziel & Makros
- `target_kcal_per_day`: Ganzzahl, kcal
- Makro-Verteilung in Prozent (Summe = 100 %):
  - `protein_pct`
  - `carbs_pct`
  - `fat_pct`
- Daraus abgeleitet (read-only, in der UI angezeigt):
  - Gramm pro Makro = (Anteil × kcal) / kcal-pro-Gramm (Protein 4, KH 4, Fett 9)

### 4.2 Mahlzeitenverteilung
- Aktive Mahlzeiten-Slots, frei wählbar aus: Frühstück, Mittag, Abend, Snack.
- Default: Frühstück / Mittag / Abend (3 Slots).
- Pro aktivem Slot: Anteil in Prozent (Summe = 100 %).
- Default 30 / 40 / 30.
- UI: Standardansicht zeigt nur aktive Slots. Ein Edit-Modus (Stift-Icon)
  erlaubt Hinzufügen/Entfernen.

### 4.3 Generator-Constraints
- `excluded_ingredient_ids`: Liste von Zutaten, die hart ausgeschlossen werden.
- `tolerance_pct`: Toleranz für Kalorien und Makro-Treffer beim Generieren.
  Default 5 %. (Konfigurierbar in Settings, nicht pro Plan.)

### 4.4 Wiederholungs-Policy
- Innerhalb eines Tages: ein Rezept darf nicht zweimal vorkommen.
- Innerhalb eines Plans: Wiederholungen sollen minimiert werden (siehe
  Algorithmus, Abschnitt 8).

---

## 5. Datenmodelle (logisch)

Konkretes Schema folgt in der Architektur-Phase. Hier nur Felder, die für
das Verständnis nötig sind.

### 5.1 BLS-Lookup
Statische Tabelle aus dem importierten BLS 4.0:
- `bls_code` (PK)
- `name_de`
- `kcal_per_100g`
- `protein_per_100g`
- `carbs_per_100g`
- `fat_per_100g`

### 5.2 Zutat (Ingredient, user-scoped)
- `id`
- `display_name` (vom Nutzer gewählter Name, z.B. "Hackfleisch")
- `bls_code` (FK → BLS-Lookup)
- `default_unit`: `g` | `ml` | `piece`
- `grams_per_piece`: optional, nur wenn `default_unit = piece` (z.B.
  1 Zwiebel = 100 g)
- `category`: für Einkaufsliste-Gruppierung (z.B. Gemüse, Milchprodukte,
  Backwaren, …). Vordefinierte Liste, beim Anlegen wählbar.
- `excluded`: Bool — ob global ausgeschlossen (entspricht Settings 4.3)

### 5.3 Rezept (Recipe, user-scoped)
- `id`
- `name`
- `meal_type`: `breakfast` | `lunch` | `dinner` | `snack` (mehrere möglich,
  als Set)
- `base_servings`: für wie viele Portionen die Mengen unten gelten
- `instructions`: Freitext (Markdown)
- `suppressed`: Bool — wenn true, wird das Rezept nicht mehr vorgeschlagen
  (hartes Ausschließen)
- `recipe_ingredients[]`:
  - `ingredient_id`
  - `amount`: Zahl
  - `unit`: `g` | `ml` | `piece`

### 5.4 Plan
- `id`
- `name`: optional (Default "Plan vom <Datum>")
- `day_count`: Anzahl Tage
- `day_labels[]`: optionale benutzerdefinierte Labels pro Tag (z.B. "Mo",
  "Tag 1"); Default = "Tag 1" … "Tag N"
- `status`: `draft` | `active` | `archived`
- `created_at`
- `meals[]`:
  - `day_index` (0…N-1)
  - `meal_slot` (entspricht aktivem Slot zum Zeitpunkt der Erstellung)
  - `recipe_id`
  - `serving_factor`: Float (frei skaliert, in UI auf 1 Nachkommastelle
    gerundet, intern exakt)
  - `cooked`: Bool — wurde "gekocht" abgehakt
  - `cooked_at`: Timestamp, optional

Es gibt zu jedem Zeitpunkt **maximal einen Plan** mit `status = active`.

### 5.5 Vorrat (Inventory, user-scoped)
- `ingredient_id` (PK zusammen mit user_id)
- `amount`: Zahl, in `default_unit` der Zutat

### 5.6 Einkaufsliste (Shopping List)
Wird live aus dem aktiven Plan + Vorrat berechnet, plus Persistenz für
Abhaken/Historie:
- `shopping_list_item`:
  - `id`
  - `plan_id`
  - `ingredient_id`
  - `required_amount`: berechneter Bedarf (alle Mahlzeiten aufsummiert)
  - `to_buy_amount`: required − Vorrat (snapshot zum Zeitpunkt des Erstellens)
  - `unit`
  - `checked`: Bool
  - `checked_at`: Timestamp, optional
  - `manual`: Bool — true wenn manuell hinzugefügt

---

## 6. Funktionsbereiche (Features)

### 6.1 Zutaten-Katalog
- Liste aller Zutaten mit Anzeigename, BLS-Bezug, Einheit, Kategorie.
- Suche / Filter.
- Zutat anlegen:
  - Anzeigename eingeben.
  - Autocomplete-Suche im BLS (über `name_de`); BLS-Treffer auswählen.
  - Standardeinheit wählen.
  - Bei `piece`: `grams_per_piece` angeben (Pflicht).
  - Kategorie wählen.
- Zutat bearbeiten/löschen. Löschen nur erlaubt, wenn die Zutat in keinem
  Rezept und keinem aktiven Plan referenziert wird (sonst soft-delete oder
  Hinweis).

### 6.2 Rezept-Verwaltung
- Liste aller Rezepte; Filter nach `meal_type`, Suche nach Name, Toggle
  "auch unterdrückte anzeigen".
- Rezept anlegen/bearbeiten:
  - Name, Mahlzeitenkategorien (mehrfach möglich), Basisportionen,
    Anleitungstext.
  - Zutaten hinzufügen: Auswahl aus Zutaten-Katalog (Autocomplete) +
    Menge + Einheit.
  - Berechnete Nährwerte pro Basisportion werden live angezeigt.
  - "Nicht mehr vorschlagen"-Toggle.
- Rezept duplizieren als Convenience.
- MVP-Seed: ~10 KI-generierte Start-Rezepte werden initial in der DB angelegt
  (wenn Zutatenkatalog leer ist, werden auch die nötigen Zutaten miterstellt).

### 6.3 Plan-Generierung
- Eingabe vor Generierung:
  - Anzahl Tage (Default 7).
  - Day-Labels (Default "Tag 1" … "Tag N"; alternativ Wochentage).
- "Plan generieren"-Button.
- Es entsteht ein **Draft-Plan**. Aktiver Plan wird dadurch nicht ersetzt.
- Auf dem Draft:
  - Pro Mahlzeit: Rezeptname, Portionsfaktor, berechnete Kalorien/Makros.
  - Aggregiert pro Tag: Tageswerte mit Vergleich zum Ziel.
  - Aggregiert pro Plan: Mittelwerte.
  - Pro Mahlzeit: Aktion "neu würfeln" (nur dieses eine Slot, andere bleiben).
  - Pro Mahlzeit: Aktion "manuell ersetzen" (Rezept aus Liste wählen,
    Portionsfaktor manuell setzen).
- "Plan festlegen": Setzt Draft auf `status = active`. Falls bereits ein
  aktiver Plan existiert, wird dieser auf `archived` gesetzt (Bestätigung
  zeigen).
- "Verwerfen": Draft wird gelöscht.

### 6.4 Aktiver Plan
- Tagesweise Ansicht der Mahlzeiten.
- Pro Mahlzeit:
  - Rezeptdetails ansehen (Zutaten in skaliertem Verhältnis,
    Anleitung, Nährwerte).
  - "Gekocht"-Häkchen → reduziert den Vorrat um die Mahlzeit-Mengen
    (skaliert auf `serving_factor`).
  - Mahlzeit tauschen / neu würfeln (mit Auswirkung auf Einkaufsliste).
  - Mahlzeit löschen (Slot bleibt leer, Einkaufsliste passt sich an).
- Plan abschließen → `status = archived`. Kein automatisches Abschließen
  nach Ablauf.

### 6.5 Einkaufsliste
- Eine Einkaufsliste gehört zu einem Plan und wird beim Plan-Festlegen
  initialisiert (Snapshot des Bedarfs minus Vorrat).
- Auch live verfügbar, solange der Plan aktiv ist.
- Aggregation: Mengen pro `ingredient_id` über alle (noch nicht gekochten?
  → siehe Abschnitt 7) Mahlzeiten summiert.
- Verrechnung mit Vorrat: `to_buy_amount = max(0, required − inventory)`.
- Eine einzige Einheit pro Zutat (die `default_unit` der Zutat). Stück-Mengen
  werden bei Bedarf in Gramm umgerechnet (über `grams_per_piece`) oder
  bleiben Stück, wenn die Zutat in Stück geführt wird — entscheidend ist die
  Standardeinheit der Zutat.
- Gruppierung nach Kategorie der Zutat.
- Items abhaken:
  - Beim Abhaken: Item verschwindet aus der aktiven Liste, geht in eine
    "Erledigt"-Sektion.
  - Abgehakte Mengen werden dem Vorrat zugebucht.
- Manuelles Hinzufügen einer Zutat zur Liste (z.B. Ad-hoc-Bedarf).
- Liste neu berechnen: kann manuell ausgelöst werden, wenn Plan-Änderungen
  passieren (oder automatisch beim Mahlzeit-Tausch — siehe Abschnitt 7).

### 6.6 Vorrat / Inventar
- Liste pro Zutat, Menge editierbar.
- Auto-Update durch:
  - Abhaken in Einkaufsliste → addiert.
  - "Gekocht"-Häkchen einer Mahlzeit → subtrahiert (nicht unter 0).
- Manuelle Korrektur jederzeit möglich.

### 6.7 Historie
- Liste archivierter Pläne.
- Plan-Detailansicht read-only.
- Archivierte Einkaufslisten sind einsehbar.

---

## 7. Cross-cutting: Plan-Mutationen vs. Einkaufsliste

Wichtige Designentscheidung, die in der Architektur konkretisiert wird:

- **Beim Plan-Festlegen**: Einkaufsliste-Snapshot wird einmalig anhand des
  Vorrats erzeugt. Danach lebt sie eigenständig (abhaken, hinzufügen).
- **Wenn der Nutzer eine Mahlzeit im aktiven Plan tauscht/löscht**: Die
  Einkaufsliste muss sich anpassen. Verhalten:
  - Bedarf der entfernten Mahlzeit wird vom `required_amount` der
    betroffenen Zutaten abgezogen.
  - Bedarf der neuen Mahlzeit wird addiert.
  - Bereits abgehakte Items werden **nicht** zurückgenommen (du hast es ja
    gekauft, es liegt jetzt im Vorrat).
  - Der `to_buy_amount` wird anhand des aktuellen Vorrats neu berechnet.
- **Wenn "Gekocht" abgehakt wird**: Vorrat reduziert; Einkaufsliste rührt
  sich nicht (war ja schon eingekauft).

Edge-Case: Mahlzeit wird gelöscht, nachdem die zugehörigen Zutaten schon
eingekauft wurden. → Der Vorrat enthält den Überschuss, dort sichtbar; in
der Einkaufsliste taucht es nicht mehr auf. Akzeptiert.

---

## 8. Generator-Algorithmus (Skizze)

Pseudocode für die "Plan-generieren"-Funktion. Heuristik, kein exakter
Solver — mit ±5 % Toleranz und Wiederholungs-Minimierung:

```
Eingabe:
  N Tage, aktive Slots S mit Anteilen p_s,
  Tagesziel Z_kcal und Makro-Anteile,
  Toleranz t = 0.05,
  ausgeschlossene Zutaten X,
  unterdrückte Rezepte (recipe.suppressed = true) → ignoriert.

Pool je Slot s:
  R_s = { Rezepte mit meal_type ∋ s,
          die keine Zutat aus X enthalten,
          und nicht suppressed }

Für d in 0..N-1:
  Tagesbudget kcal_target = Z_kcal
  Bereits gewählt heute: ∅
  Für s in S (in fester Reihenfolge):
    target_s_kcal = kcal_target * p_s

    Kandidaten C = R_s \ Bereits-gewählt-heute
    Score(r) = w1 * | scaling-fit | + w2 * Wiederholungs-Penalty(r, Plan)
      mit:
        scaling-fit: wie weit muss serving_factor von 1 weg, um
                     target_s_kcal ± t zu erreichen?
                     (genau: factor = target_s_kcal / kcal(r, base_servings))
                     scaling-fit = | factor − 1 |
        Wiederholungs-Penalty: count(r in Plan bisher) * Konstante
    Wähle r mit minimalem Score.
    Setze serving_factor exakt so, dass target_s_kcal getroffen wird.

  Nach allen Slots: prüfe Tages-Makros gegen Ziel ± t.
  Falls Verletzung → versuche Neuwahl der schlechtesten Mahlzeit
  (begrenzt auf K Versuche, dann akzeptieren).
```

Verfeinerung in der Implementierungsphase. Wichtig:
- Deterministisches Verhalten ist nicht gefordert; Zufallselement ist ok
  und für "neu würfeln" sogar nötig.
- "Neu würfeln" eines einzelnen Slots: gleiche Logik, aber nur für diesen
  Slot, andere Mahlzeiten des Tages und Plans werden als "schon gewählt"
  betrachtet.

---

## 9. UI / UX

### 9.1 Anspruch
- Modern, klar, intuitiv. Mobile-first responsive, aber Desktop nicht
  vernachlässigt.
- Wenig visueller Lärm; Edit-Modi für Konfiguration.
- Feedback bei längeren Aktionen (Plan generieren) per Loading-State.

### 9.2 Hauptnavigation
- Plan (aktiver Plan, Default-Landing)
- Einkaufsliste
- Vorrat
- Rezepte
- Zutaten
- Historie
- Settings

### 9.3 Wichtige Views
- **Plan-Übersicht**: Tagesweise Karten, je Mahlzeit eine Zeile, Tagesziel
  vs. Ist als Balken. Schnellaktionen pro Mahlzeit.
- **Plan generieren**: Form mit Tagesanzahl + Labels, Button. Draft direkt
  anzeigen mit "Festlegen" / "Verwerfen".
- **Einkaufsliste**: Gruppiert nach Kategorie, Items mit Checkbox, Sektion
  "Erledigt" einklappbar.
- **Vorrat**: Tabelle, schnelle Mengenkorrektur.
- **Rezepte / Zutaten**: Listen mit Suchen, Modals/Side-Panels für
  Bearbeiten.
- **Settings**: Sektionen für Energie/Makros, Mahlzeiten-Slots (mit
  Edit-Modus für Hinzufügen/Entfernen), Ausgeschlossene Zutaten,
  Wiederholungs-/Toleranz-Parameter.

---

## 10. Initialdaten / MVP-Seed

- BLS 4.0 wird beim Setup einmalig importiert (Skript) in eine
  app-globale Tabelle (read-only).
- ~10 Start-Rezepte als Seed (KI-generiert, vom Nutzer kuratierbar).
  Inkl. der dafür nötigen Zutaten (mit BLS-Mapping).

---

## 11. Akzeptanzkriterien (MVP "fertig")

- [ ] Login funktioniert; ohne Login keine Daten zugänglich.
- [ ] BLS-Daten sind in der DB; Autocomplete bei Zutat-Anlage funktioniert.
- [ ] Zutaten-Katalog: anlegen, editieren, löschen.
- [ ] Rezepte: anlegen, editieren, Nährwerte werden korrekt aus Zutaten
      und BLS berechnet (pro Basisportion).
- [ ] Settings: Kalorien, Makros, Mahlzeiten-Slots inkl. Edit-Modus,
      Ausschluss-Zutaten konfigurierbar.
- [ ] Plan generieren erzeugt einen Draft, der die Constraints einhält
      (keine Doppel-Rezepte am Tag, hartes Excludieren der ausgeschlossenen
      Zutaten und unterdrückten Rezepte, ±5 % Toleranz beim kcal-Ziel).
- [ ] Plan festlegen erzeugt aktiven Plan (alter wird archiviert) und
      eine initiale Einkaufsliste.
- [ ] Einkaufsliste verrechnet Vorrat, gruppiert nach Kategorie, abhaken
      schiebt Items in Vorrat.
- [ ] Vorrat: Mengen-Korrektur möglich; "Gekocht"-Haken reduziert Vorrat.
- [ ] Mahlzeit im aktiven Plan tauschen aktualisiert die Einkaufsliste
      gemäß Abschnitt 7.
- [ ] Historie zeigt frühere Pläne und Einkaufslisten read-only.
- [ ] Sync: Änderung am Laptop ist nach Refresh am Handy sichtbar (Supabase
      als Single Source of Truth).
- [ ] UI ist auf Mobile bedienbar (kein horizontales Scrollen, Touch-Targets
      ausreichend groß).

---

## 12. Offene Punkte für Architektur-Phase

- Konkretes Postgres-Schema und RLS-Policies.
- Server-Komponenten vs. Client-Komponenten (Next.js App Router).
- State-Management am Client (z.B. React Query gegen Supabase).
- UI-Bibliothek (shadcn/ui ist eine naheliegende Option).
- BLS-Importskript und Datenmodell-Subset.
- Strategie für Seed-Rezepte (SQL-Seed vs. Migration).
- Konkrete Heuristik-Parameter im Generator (Wiederholungs-Gewicht,
  Versuchsanzahl).
