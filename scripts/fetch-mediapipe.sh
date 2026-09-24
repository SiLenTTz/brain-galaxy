#!/bin/bash
# Lädt MediaPipe-Assets lokal (Offline-Fähigkeit, ADR-004). Pin: 0.10.14.
# Nach dem Fetch gilt: Hands-Modus braucht kein Internet mehr (CDN = Fallback).
set -e
D="$(dirname "$0")/../public/vendor/mediapipe"
V="0.10.14"
BASE="https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@$V"
mkdir -p "$D/wasm"
curl -sfL "$BASE/vision_bundle.mjs" -o "$D/vision_bundle.mjs"
for f in vision_wasm_internal.js vision_wasm_internal.wasm \
         vision_wasm_nosimd_internal.js vision_wasm_nosimd_internal.wasm; do
  curl -sfL "$BASE/wasm/$f" -o "$D/wasm/$f"
done
curl -sfL "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task" \
  -o "$D/hand_landmarker.task"
echo "OK: $(du -sh "$D" | cut -f1) in $D"
