# Mitwirken

Danke fürs Interesse an Brain Galaxy! Dieses Dokument beschreibt, wie
Build, Tests und der öffentliche Spiegel (Mirror) funktionieren.

## Build & Tests

```bash
npm install        # Abhängigkeiten installieren
npm run check      # TypeScript-Typecheck (tsc --noEmit)
npm run build      # Produktions-Build (vite build)
npm test           # Test-Suite (vitest run)
```

Vor jedem Commit: `npm run check && npm run build` muss grün sein.

## Git-Hooks

Einmalig nach dem Klonen:

```bash
bash scripts/setup-hooks.sh
```

Aktiviert `core.hooksPath=.githooks` — der `pre-push`-Hook läuft
`npm run check` und `npm test` und blockt den Push bei Fehlern.

## Konventionen

- **Doku auf Deutsch, Code-Kommentare auf Englisch.** Eine Doku, die
  lügt, ist schlimmer als keine — beide aktuell halten.
- **Local-first, keine Cloud:** Features müssen ohne Internet
  funktionieren (Fallbacks erlaubt, Cloud nie Pflicht).
- **Deterministischer Kern:** Indexing, Layout, Communities — gleiche
  Eingabe → gleiches Ergebnis, keine Modelle, kein Netzwerk. KI ist
  optional an den Rändern und muss als solche gekennzeichnet sein.
- **Markdown ist die SSOT:** Jedes abgeleitete Artefakt (SQLite,
    graph.json, Layouts) muss rekonstruierbar und entbehrlich sein.
- **Ein festes visuelles Vokabular** („cosmos") — tunen über die
  Parameter des Tuning-Panels, nicht über neue Looks.
- Commits: konventionsnahe One-Liner, die das *Warum* sagen.
- Layout-Änderungen müssen die Zero-Overlap-Garantie halten
  (`?bench=1` → `__minDistViolations`).

## Zusammenarbeit über den Mirror-Workflow

Die Entwicklung findet im **privaten Repo** statt. Das öffentliche Repo
ist ein Export:

1. Änderungen im privaten Repo entwickeln und committen.
2. Export erzeugen: `bash scripts/export-public.sh` (baut den sauberen
   öffentlichen Stand mit frischer Historie).
3. Gates müssen grün sein: `bash scripts/release-gates.sh .` im Export —
   erst dann pushen (`bash scripts/release-gates.sh --push .`).

Fixes landen immer im privaten Repo und werden über den Export
veröffentlicht — nie direkt im öffentlichen Repo arbeiten.

## Keine Credentials, keine persönlichen Daten

Nie committen: Zugangsdaten, persönliche Vault-Inhalte, Screenshots mit
echten Notiz-Titeln, interne Hostnames/IPs. Für realistische Testdaten
`make_synth_vault.py` (siehe brain-indexer) verwenden. Der
Security-Audit (G1) der Release-Gates prüft den Export auf solche
Muster und blockt den Push.

## Lizenz

MIT — siehe [LICENSE](LICENSE).
