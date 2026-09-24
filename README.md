# Brain Galaxy 🌌

**Your knowledge as a universe.** Brain Galaxy turns any collection of
markdown notes into a navigable 3D cosmos: notes become stars, links become
filaments, topics gather into spiral galaxies — and everything stays **on
your machine**. No cloud, no accounts, no telemetry.

- **Universe layout** — every topic cluster forms its own spiral galaxy
  (bright core = most important notes, arms = related notes), galaxies float
  in shared space so you *see* what belongs together
- **Drill-down** — click a galaxy to dive into a folder or topic, breadcrumb
  navigation, `Esc` goes back up
- **Two lenses** — group by 📁 folders or by 🧠 topics (communities detected
  from your link structure, deterministically)
- **Live** — edit a note, the universe updates itself (~20 s)
- **Hand & voice control** — control the galaxy (and your window manager)
  with your hands: phone camera or webcam, fully offline-capable
- **Phone capture** — jot a note on your phone, it lands in your inbox and
  appears as a new star
- **Scales** — validated at 10,000 nodes with guaranteed non-overlapping
  layout; adaptive edge rendering and a level-of-detail API

## Quick start

```bash
git clone https://github.com/SiLenTTz/brain-galaxy
cd brain-galaxy
npm install
npm run dev          # UI on http://localhost:5174 (demo data)
```

You'll see a demo universe immediately. To visualize **your own notes**, run
the companion indexer ([brain-indexer](https://github.com/SiLenTTz/brain-indexer))
next to it:

```bash
git clone https://github.com/SiLenTTz/brain-indexer
cd brain-indexer
python3 indexer.py ~/YourVault      # builds index.db + graph.json
python3 server.py                   # serves on :8789
```

Reload the UI — your vault appears as a universe. Markdown/Obsidian vaults
work as-is; other sources see [the import interface](docs/IMPORT.md).

**Deutsch / Kurzanleitung:** `npm install && npm run dev` startet die Galaxie
mit Demo-Daten. Eigene Notizen: [brain-indexer](https://github.com/SiLenTTz/brain-indexer)
nebenbei starten (`python3 indexer.py ~/MeineVault && python3 server.py`),
Seite neu laden. Gesten: ✋-Knopf oben rechts (Webcam) oder `?hands=1`
(Phone). Details in [docs/](docs/) — Doku Deutsch, Code-Kommentare Englisch.

## Components

| Piece | What it is |
| --- | --- |
| `src/` | React + three.js (R3F) visualization — layouts, renderer, HUD, gesture engine |
| `handcam/` | Phone-as-camera relay (WebSocket), gesture command allowlist, phone capture page |
| `scripts/` | Benchmarks, screenshots, MediaPipe asset fetcher |
| `docs/` | [Architecture](docs/ARCHITECTURE.md) · [Importing data](docs/IMPORT.md) · [Gestures](docs/GESTURES.md) |

## Where things live

- **Architecture & data flow** → [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- **Bring your own data (adapters, importer agent)** → [docs/IMPORT.md](docs/IMPORT.md)
- **Hand gesture control & phone capture** → [docs/GESTURES.md](docs/GESTURES.md)
- **Security model (allowlist, local-only)** → [SECURITY.md](SECURITY.md)
- **Contributing / agents** → [AGENTS.md](AGENTS.md)

## Controls

| Input | Action |
| --- | --- |
| Drag / scroll / pinch | Orbit & zoom (up to 900 units — the whole universe) |
| Click star | Open note (read & edit) |
| Click 📁 / 🧠 galaxy | Drill into folder / topic |
| `Ctrl+K` | Search (semantic in advanced mode) |
| `F` | Focus neighbors · `R` related · `Esc` up/close |
| ✋ button | Hand gesture control (webcam; live phone status) |
| 📱 button | Connect your phone: QR code, URL setting, guided steps |
| ⚙ button | Tuning: glow, sizes, edges, importance filter, layout |

## Tech

React 19 · three.js / react-three-fiber · zustand · d3-force-3d · Vite.
Backend: Python stdlib only (SQLite + FTS5). No cloud services required.

## License

MIT — see [LICENSE](LICENSE). Hand-tracking by Google MediaPipe (Apache 2.0),
loaded locally via `scripts/fetch-mediapipe.sh` for offline use.
