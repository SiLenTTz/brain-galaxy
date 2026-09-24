# Security & privacy

Brain Galaxy is local-first: your notes, camera frames and voice never touch
a server we control — there is none.

**Local-only network.** All services bind to localhost. If you want phone
access, you expose the relay through your own private tunnel (e.g.
`tailscale serve`) — that is your perimeter, not ours.

**Gesture commands are allowlisted.** The handcam relay executes a fixed set
of commands (dictation start/stop via `voxtype`, window/workspace focus via
Hyprland IPC, a fixed app-launch table). It never runs arbitrary commands,
never spawns a shell with user input, and caps every request.

**Camera frames stay on your network.** The phone pushes JPEG frames over
WebSocket to the local relay, which forwards them to local viewers. Frames
are never stored or uploaded. Phone presence is broadcast as a boolean.

**Capture is sanitized.** Phone notes are stripped of control characters,
size-capped, and written as markdown into a fixed directory
(`HANDCAM_INBOX`). No path traversal: filenames are generated server-side.

**Hand tracking runs in your browser.** MediaPipe WASM + model are vendored
locally (`scripts/fetch-mediapipe.sh`, pinned 0.10.14) — gesture control
works offline. Without vendored assets it falls back to a CDN (only then is
there outbound traffic, for the library files, not your data).

**Secrets stay in env files.** Optional remote integrations read URLs/tokens
from environment files that are gitignored (`.env.example` documents them).
Never commit credentials — history is audited, but fresh checkouts should
start clean.

**Editing goes through git.** Writing notes from the UI creates commits in
your vault repository — reversible by design.

If you find a security issue, please open an issue (or a draft advisory).
