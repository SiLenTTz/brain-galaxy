#!/bin/bash
# setup-hooks.sh — aktiviert die Git-Hooks aus .githooks/ für dieses Repo.
set -euo pipefail
cd "$(dirname "$0")/.."
git config core.hooksPath .githooks
echo "Git-Hooks aktiviert (core.hooksPath=.githooks)."
echo "pre-push läuft ab jetzt npm run check + npm test."
