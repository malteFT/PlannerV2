# BLS-Mapping-Vorschlag

Stand: 2026-06-19
Zweck: Vorschlagsliste zum Anlegen als Stammdaten. Bitte Zeile für Zeile prüfen.
Ändere die "Status"-Spalte zu OK / NEIN / Korrektur und schick die Datei zurück.

Hinweise zur Auswahl:
- Bei Pflanzen-Lebensmitteln immer die rohe Variante gewählt (Rezepte verstehen "gekocht" als Zubereitungsschritt).
- Bei Fleisch ebenfalls roh, nicht gebraten/paniert.
- "g/Stück" nur bei Einheit "piece" relevant — typische Marktware in Deutschland.
- "Naturjoghurt 3,5%" → BLS "Joghurt mild, mind. 3,5 % Fett" (M141300). BLS hat keinen separaten "Naturjoghurt"-Eintrag; "mild" entspricht dem unaromatisierten Standardjoghurt.
- "Hüttenkäse" → BLS hat keinen direkten Eintrag; "Körniger Frischkäse" (M711100) ist die etablierte deutsche Bezeichnung dafür.
- "Spaghetti" → BLS hat nur die generische Kategorie "Teigwaren eifrei, roh" (E401000). Spaghetti ist eine Form-Variante davon, Nährwerte identisch.

| Display-Name | Kategorie | Einheit | g/Stück | BLS-Code | BLS-Name | kcal/100g | Notiz | Status |
|---|---|---|---|---|---|---|---|---|
| Apfel | Obst & Gemüse | piece | 180 | F110100 | Apfel roh | 58 | mittlere Größe ~180g | |
| Banane | Obst & Gemüse | piece | 120 | F503100 | Banane roh | 79 | geschält ~120g | |
| Orange | Obst & Gemüse | piece | 180 | F603100 | Orange roh | 49 | mittel ~180g | |
| Zitrone | Obst & Gemüse | piece | 80 | F601100 | Zitrone roh | 40 | mittel ~80g | |
| Erdbeeren | Obst & Gemüse | g | — | F301100 | Erdbeere roh | 38 | | |
| Heidelbeeren | Obst & Gemüse | g | — | F304100 | Heidelbeere roh | 61 | | |
| Kartoffel | Obst & Gemüse | g | — | K120100 | Kartoffel ungeschält, roh | 86 | alternativ K110100 (geschält, 83 kcal) wenn schon geschält gewogen | |
| Süßkartoffel | Obst & Gemüse | g | — | K420100 | Batate/Süßkartoffel, roh | 119 | | |
| Karotte | Obst & Gemüse | g | — | G620100 | Karotte/Möhre, roh | 40 | | |
| Tomate | Obst & Gemüse | g | — | G561100 | Tomate roh | 22 | piece-Wert wäre ~120g; in g lassen, da Rezepte oft Stückgrößen variieren | |
| Gurke | Obst & Gemüse | g | — | G520100 | Gurke roh | 16 | | |
| Paprika rot | Obst & Gemüse | g | — | G543100 | Gemüsepaprika rot, roh | 36 | grün/gelb separat (G541100/G542100) bei Bedarf | |
| Zwiebel | Obst & Gemüse | g | — | G480100 | Speisezwiebel roh | 34 | | |
| Knoblauch | Obst & Gemüse | g | — | G490100 | Knoblauch roh | 97 | | |
| Brokkoli | Obst & Gemüse | g | — | G312100 | Broccoli roh | 35 | BLS-Schreibweise mit "cc" | |
| Blumenkohl | Obst & Gemüse | g | — | G311100 | Blumenkohl roh | 35 | | |
| Spinat (frisch) | Obst & Gemüse | g | — | G211100 | Spinat roh | 18 | | |
| Salat (Eisbergsalat) | Obst & Gemüse | g | — | G103100 | Eisbergsalat roh | 15 | | |
| Champignons | Obst & Gemüse | g | — | K701100 | Champignon roh | 28 | | |
| Avocado | Obst & Gemüse | piece | 200 | F502100 | Avocado roh | 132 | mit Kern/Schale ~250g, Fruchtfleisch ~200g | |
| Hähnchenbrust | Fleisch & Fisch | g | — | V416100 | Hähnchen Brustfilet, roh | 109 | | |
| Putenbrust | Fleisch & Fisch | g | — | V486100 | Pute Brust, ohne Haut, roh | 105 | nicht W561000 (Kochpökelware/Aufschnitt) | |
| Hackfleisch (Rind) | Fleisch & Fisch | g | — | U010100 | Rind Hackfleisch, roh | 224 | nicht U020100 (Schwein); Mix-Hack nicht im BLS roh | |
| Lachs (frisch) | Fleisch & Fisch | g | — | T410100 | Lachs roh | 180 | | |
| Thunfisch (Konserve in Wasser) | Fleisch & Fisch | g | — | T121902 | Thunfisch im eigenen Saft, Konserve, abgetropft | 95 | abgetropft-Wert; bei Verwendung mit Lake ggf. anpassen | |
| Ei (Hühnerei) | Milchprodukte & Eier | piece | 60 | E111100 | Hühnerei roh | 135 | Größe M ~60g (mit Schale ~63g) | |
| Vollmilch (3,5%) | Milchprodukte & Eier | ml | — | M111300 | Vollmilch frisch, 3,5 % Fett, pasteurisiert | 62 | g≈ml bei Milch; alternativ H-Milch M113300 (gleiche Werte) | |
| fettarme Milch (1,5%) | Milchprodukte & Eier | ml | — | M111200 | Milch fettarm, frisch, 1,5 % Fett, pasteurisiert | 44 | | |
| Naturjoghurt (3,5%) | Milchprodukte & Eier | g | — | M141300 | Joghurt mild, mind. 3,5 % Fett | 67 | "mild" = unaromatisiert; kein separater "Naturjoghurt"-Eintrag | |
| griechischer Joghurt | Milchprodukte & Eier | g | — | M141500 | Sahnejoghurt mind. 10 % Fett | 124 | BLS hat keinen "griechischen Joghurt"; Sahnejoghurt 10% am nächsten. Alternativ M149500 Schafjoghurt (90 kcal) wenn echter griechischer aus Schafmilch | |
| Quark (Magerstufe) | Milchprodukte & Eier | g | — | M713100 | Speisequark Magerstufe, Magerquark < 10 % Fett i. Tr. | 66 | | |
| Hüttenkäse | Milchprodukte & Eier | g | — | M711100 | Körniger Frischkäse < 10 % Fett i. Tr. | 73 | "Hüttenkäse" = Cottage Cheese = körniger Frischkäse | |
| Mozzarella | Milchprodukte & Eier | g | — | M032100 | Mozzarella mind. 45 % Fett i. Tr. | 259 | Standardvariante; Light wäre M0A1000 (158 kcal, 20% F.i.T.) | |
| Feta | Milchprodukte & Eier | g | — | M012200 | Feta mind. 45 % Fett i. Tr. | 284 | | |
| Gouda jung | Milchprodukte & Eier | g | — | M402600 | Gouda 48 % Fett i. Tr. | 379 | Standard-Gouda; M402500 (40% F.i.T., 313 kcal) wenn leichter gewünscht | |
| Butter | Milchprodukte & Eier | g | — | Q611000 | Butter mild gesäuert | 747 | mild gesäuert = deutsche Standardbutter | |
| Haferflocken | Backwaren & Getreide | g | — | C522000 | Getreideflakes gesüßt | 348 | KORREKTUR NÖTIG: BLS hat keine reinen "Haferflocken" als eigenen Eintrag in den Treffern. Bitte prüfen — es gibt evtl. einen anderen Code (Haferflocken sollten ~370 kcal/100g, kein Zucker). Siehe "Nicht gefunden" unten. | |
| Müsli (Basis) | Backwaren & Getreide | g | — | C512600 | Müslimischung Bircher Art (mit Trockenfrüchten und Nüssen) ungesüßt | 366 | ungesüßt; gesüßte Variante C514200 (421 kcal) | |
| Toastbrot | Backwaren & Getreide | g | — | B314000 | Weizentoastbrot/Buttertoastbrot | 261 | Scheibe ~25g | |
| Vollkornbrot | Backwaren & Getreide | g | — | B121000 | Roggenvollkornbrot | 193 | klassisches Vollkornbrot; alternativ Weizenvollkorn B111... | |
| Roggenbrot | Backwaren & Getreide | g | — | B221000 | Roggenbrot | 220 | | |
| Brötchen weiß | Backwaren & Getreide | piece | 50 | B511000 | Weizenbrötchen | 280 | Standard-Brötchen ~50g | |
| Spaghetti | Nudeln, Reis & Hülsenfrüchte | g | — | E401000 | Teigwaren eifrei, roh | 346 | BLS unterscheidet nicht nach Form (Spaghetti/Penne/etc.); Nährwerte identisch | |
| Reis (Langkorn) | Nudeln, Reis & Hülsenfrüchte | g | — | C352000 | Reis poliert, roh | 351 | "poliert" = weißer Standard-Langkornreis; alternativ C359000 (parboiled, 333 kcal) | |
| Basmatireis | Nudeln, Reis & Hülsenfrüchte | g | — | C352000 | Reis poliert, roh | 351 | BLS hat keinen separaten Basmati-Eintrag; nährwerttechnisch identisch zu Langkorn poliert | |
| Linsen (rot, getrocknet) | Nudeln, Reis & Hülsenfrüchte | g | — | H730000 | Linse rot reif | 334 | "reif" = trocken (BLS-Konvention) | |
| Kichererbsen (Konserve) | Nudeln, Reis & Hülsenfrüchte | g | — | G770400 | Kichererbse reif | 317 | KORREKTUR: BLS hat keine Konserve separat; "reif" ist trocken. Konserve abgetropft hat ~150 kcal. Vorschlag: G770432 (gekocht, 151 kcal) als Annäherung an Konserve. Bitte entscheiden. | |
| Bohnen (weiße, Konserve) | Nudeln, Reis & Hülsenfrüchte | g | — | H900900 | Bohnen weiß, in Tomatensoße, Konserve | 94 | Achtung: "in Tomatensoße". Reine weiße Bohnen Konserve in Wasser nicht im BLS — siehe "Nicht gefunden". | |
| Tomatenpassata | Konserven & Soßen | g | — | R161200 | Tomaten passiert/Tomatenpüree | 29 | | |
| gehackte Tomaten (Konserve) | Konserven & Soßen | g | — | G568900 | Tomate geschält, Konserve | 24 | "geschält" = klassische Dosentomaten; alternativ G560900 "Tomate Konserve" (19 kcal) | |
| Mais (Konserve) | Konserven & Soßen | g | — | G570902 | Zuckermais Konserve, abgetropft | 79 | | |
| Olivenöl | Öl, Essig & Gewürze | ml | — | Q120000 | Olivenöl | 899 | g≈0,91·ml; falls Modell in g rechnet: Faktor beachten | |
| Rapsöl | Öl, Essig & Gewürze | ml | — | Q180000 | Rapsöl/Rüböl | 900 | | |
| Salz | Öl, Essig & Gewürze | g | — | R111000 | Speisesalz/Siedesalz/Tafelsalz | 0 | | |
| Pfeffer schwarz | Öl, Essig & Gewürze | g | — | R258100 | Pfeffer schwarz, getrocknet | 304 | typisch in Prisen — g-Einheit ok für Stammdaten | |
| Zucker (weiß) | Öl, Essig & Gewürze | g | — | S111000 | Zucker weiß (Raffinadezucker/Weißzucker) | 400 | | |
| Mandeln (geröstet) | Süßwaren & Snacks | g | — | H210600 | Mandel süß, geröstet ohne Fett | 550 | "ohne Fett geröstet"; alternativ H210100 ungeröstet (544 kcal) | |
| Walnüsse | Süßwaren & Snacks | g | — | H120100 | Walnuss | 721 | | |
| Erdnüsse | Süßwaren & Snacks | g | — | H110600 | Erdnuss geröstet | 620 | ungesalzen; gesalzen H110700 (614 kcal) | |
| Wasser (Mineralwasser still) | Getränke | ml | — | N128000 | Natürliches Mineralwasser still | 0 | | |
| Apfelsaft | Getränke | ml | — | F110600 | Apfelsaft | 44 | | |
| Orangensaft | Getränke | ml | — | F603600 | Orangensaft | 41 | | |

## Nicht gefunden / unklar

- **Haferflocken**: In den Treffern fand sich kein eigenständiger Eintrag "Haferflocken roh" — nur Folgeprodukte (Plätzchen, Suppen, Brei-Mischungen). Als Platzhalter wurde C522000 "Getreideflakes gesüßt" eingetragen, das ist aber **nicht ideal** (gesüßt, nicht spezifisch Hafer). Empfehlung: gezielt nach Code C140000 / C141000 (Hafer-Bereich) oder im BLS-Originalverzeichnis nach "Hafer ganzes Korn / Haferflocken Vollkorn / Hafer geschält" suchen. **Bitte vor Übernahme prüfen.**
- **Basmatireis**: Im BLS nicht als eigene Sorte vorhanden. C352000 "Reis poliert, roh" ist die einzig sinnvolle Zuordnung; Nährwerte für Basmati und Standard-Langkorn sind praktisch identisch. Falls eine UI-Differenzierung gewünscht ist, könnte ein separater Stammdaten-Eintrag mit gleichem BLS-Code, aber abweichendem Display-Namen angelegt werden.
- **Kichererbsen Konserve (in Wasser)**: BLS führt nur die trockene Form (G770400) und die gekochte Variante (G770432, 151 kcal). Eine Konserve abgetropft entspricht ungefähr der gekochten Form. Für die Stammdaten: entweder G770400 (trocken, der User wiegt aber meist Konserve abgetropft) oder G770432 (gekocht, näher an Konserve abgetropft). Empfehlung: **G770432 verwenden, Display-Name "Kichererbsen (Konserve, abgetropft)"**.
- **Bohnen weiß Konserve in Wasser**: Es gibt nur H900900 "Bohnen weiß, in Tomatensoße, Konserve" und X574312 "Bohnen weiß, gekocht (mit Fett und Salz)". Für eine reine Wasser-Konserve fehlt der Eintrag. Entweder die rohe Form (G780100 falls vorhanden) gekocht-Variante mappen oder bei H900900 bleiben und Notiz vermerken, dass darin Tomatensoße enthalten ist (ändert Nährwerte deutlich).
- **Griechischer Joghurt**: BLS hat keinen Eintrag mit dieser Bezeichnung. Sahnejoghurt 10% (M141500) trifft die Konsistenz/Fettgehalt am besten von typisch im Handel erhältlichem griechischem Joghurt; "echter" griechischer Joghurt wäre eher Schafjoghurt (M149500). Tradeoff: Marktrealität in DE = überwiegend Kuhmilch-Sahnejoghurt-Variante.
- **Mineralwasser still**: gefunden (N128000), aber kcal=0 — kann auch komplett weggelassen werden, falls die App keine Wasser-Stammdaten braucht.
