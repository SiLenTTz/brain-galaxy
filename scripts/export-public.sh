#!/bin/bash
# export-public.sh — baut einen sauberen, veröffentlichbaren Export dieses
# Repos (frische Historie, persönliche Daten/Arbeitsdateien ausgeschlossen)
# und committet Änderungen als Release (wiederholbar: privates Repo weiter
# entwickeln, vor jedem Release einfach erneut ausführen).
#
#   bash scripts/export-public.sh [ziel] [release-name]
#     Default-Ziel: ../brain-galaxy-public · Release-Name → Commit + Tag
#
# Warum frische Historie? Die Entwicklungshistorie enthält Arbeitsnotizen
# (analysis/), Screenshots und interne Hostnames — bewusst NICHT öffentlich.
# Der Quellcode selbst ist sauber (siehe Audits).
set -euo pipefail
SRC="$(cd "$(dirname "$0")/.." && pwd)"
DST="${1:-$SRC/../brain-galaxy-public}"

EXCLUDE=(
  .git .gitignore.orig node_modules dist .vite .dev-shots analysis
  public/wallpaper.png public/models public/vendor
  scripts/sync-wallpaper.sh scripts/layout-bench.mjs scripts/audit-patterns.local
  docs/reports
  hive-brain.env *.log .DS_Store
)

mkdir -p "$DST"
rsync -a --delete "${EXCLUDE[@]/#/--exclude=}" "$SRC"/ "$DST"/

# MediaPipe-Assets nicht mitnehmen (26 MB) — fetch script dokumentiert das
[ -f "$DST/scripts/fetch-mediapipe.sh" ] && chmod +x "$DST/scripts/fetch-mediapipe.sh"

cd "$DST"
REL="${2:-}"
if [ ! -d .git ]; then
  git init -q -b main
  git add -A
  git -c user.name=SiLenTTz -c user.email=SiLenTTz@users.noreply.github.com commit -q -m "Initial public release — knowledge universe (UI, layouts, gestures, phone capture)

React + three.js universe visualization with spiral-galaxy clustering,
drill-down, live updates, hand gesture control (webcam/phone) and phone
capture. Deterministic indexing lives in the companion repo brain-indexer."
  [ -n "$REL" ] && git tag -a "$REL" -m "$REL"
else
  git add -A
  if git diff --cached --quiet; then
    echo "Keine Änderungen seit dem letzten Export."
  else
    git -c user.name=SiLenTTz -c user.email=SiLenTTz@users.noreply.github.com commit -q -m "${REL:-Release $(date +%Y-%m-%d)}"
    [ -n "$REL" ] && git tag -a "$REL" -m "$REL"
    echo "Release committet${REL:+ (+ Tag $REL)}."
  fi
fi

echo ""
echo "Export liegt in: $DST"
echo "Vor dem Push: einmal selbst nach Hostnames/IPs/Handle greppen (Audit-Muster s. analysis)."
echo "Veröffentlichen (einmalig remote setzen, danach nur push):"
echo "  git remote add origin https://github.com/SiLenTTz/brain-galaxy.git   # nur beim ersten Mal"
echo "  git push origin main --tags"
