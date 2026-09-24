# AGENTS.md — working on brain-galaxy

Guidance for coding agents (and humans) contributing to this repo.

## Principles

1. **Local-first, no cloud.** Features must work with the internet off
   (fallbacks allowed, cloud never required).
2. **Deterministic core.** Indexing, layout, communities: same input → same
   output, no models, no network. AI is opt-in at the edges (semantic
   search, importer agent) and must be labeled as such.
3. **Markdown is the SSOT.** Every derived artifact (SQLite, graph.json,
   layouts) must be rebuildable and disposable.
4. **One fixed visual language** („cosmos"). No themes, no feature creep in
   styling — tune via the tuning panel parameters, not new looks.

## Conventions

- Docs: German for humans (`docs/`, README section), English code comments.
  Keep both honest — a doc that lies is worse than none.
- Commits: conventional-ish one-liners that say *why* (`S13: layout —
  pairwise attraction collapsed into one ball, use repulsion + anchors`).
- Typecheck + build before you commit: `npm run check && npm run build`.
  Backend tests: `python3 test_indexer.py` (runs against fixtures, skips
  live-vault checks when none exists).
- Never commit: credentials, personal vault content, screenshots with real
  note titles, internal hostnames/IPs. Use `make_synth_vault.py` for
  realistic test data and `?benchgraph=` for testing against other graphs.

## Map

- `src/data/` — loading + layouts (`layout.ts`: universe/cluster/sphere,
  overlap guarantee lives here)
- `src/scene/` — renderer (NodeField stars, EdgeField filaments,
  Atmosphere nebulae/stars/asteroids, GalaxyCores)
- `src/hud/` — UI (TopBar, palette, detail, tuning, hands toggle)
- `src/lib/handControl.ts` — gesture engine (two sources, one engine)
- `handcam/` — relay: frames, allowlist commands, phone capture
- `docs/` — architecture, import contract (Source Graph JSON v1), gestures

## Known sharp edges

- `captureStream()` freezes `video.currentTime` at 0 — gate frame
  processing on a frame counter, never on the media clock (bitten twice).
- Hub nodes are individual meshes — keep the hub cap (~400) or rendering
  dies at scale.
- The LOD API caps responses (≤ 1 500 nodes, edges within result) —
  respect budgets in `analysis`-style docs before adding payload.
- Layout changes must keep the zero-overlap guarantee (expose violations
  via `?bench=1` → `__minDistViolations`).

## Release / Public Push

Before pushing to the public repo, **always** run:
```bash
bash scripts/release-gates.sh .        # gates only
bash scripts/release-gates.sh --push . # gates + push
```
The gates **block** on any failure (security audit, secrets, build, README,
gitignore). See `.claude/skills/release-gates/SKILL.md` for the full table.
