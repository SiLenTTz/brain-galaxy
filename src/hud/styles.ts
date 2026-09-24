// Globales HUD-CSS. Ein Ort, sauber strukturiert.
export const css = `

:root {
  --bg:#070b12; --panel:rgba(14,20,32,0.55); --line:rgba(150,190,235,0.16);
  --text:#e6edf7; --dim:#9db0c8; --muted:#6d7f97;
  --accent:#7cc4ff; --accent-2:#8f7cff; --accent-soft:#bfe0ff; --ring:#5fd39b;
  --font-mono: ui-monospace, "SF Mono", "Cascadia Mono", monospace;
  --font-display: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  --radius:13px;
}
* { margin:0; padding:0; box-sizing:border-box; }
html,body,#root { height:100%; overflow:hidden; background:var(--bg); color:var(--text);
  font-family:var(--font-display); }
.scene-root { position:fixed; inset:0; }
canvas { display:block; }
button { font-family:inherit; }

/* ---------- Glas ---------- */
.glass { background:var(--panel); backdrop-filter:blur(14px) saturate(1.1);
  -webkit-backdrop-filter:blur(14px) saturate(1.1); border:1px solid var(--line); }
.corners { position:relative; }
.corners::before,.corners::after { content:""; position:absolute; width:9px; height:9px;
  border:1.5px solid var(--accent); opacity:.5; pointer-events:none; }
.corners::before { top:-1px; left:-1px; border-right:none; border-bottom:none; }
.corners::after { bottom:-1px; right:-1px; border-left:none; border-top:none; }

/* ---------- TopBar ---------- */
.hud-top { position:fixed; top:0; left:0; right:0; height:54px; display:flex; align-items:center;
  gap:10px; padding:0 16px; z-index:40; border:none;
  background:linear-gradient(180deg, color-mix(in srgb, var(--bg) 90%, transparent) 0%,
    color-mix(in srgb, var(--bg) 60%, transparent) 62%, transparent 100%); }
.hud-top::after { content:""; position:absolute; left:0; right:0; bottom:0; height:1px;
  background:linear-gradient(90deg, transparent, var(--line) 15%, var(--line) 85%, transparent); }
.crumb { display:flex; align-items:center; gap:4px; font-size:12.5px; color:var(--dim); }
.crumb button { background:none; border:1px solid transparent; color:var(--dim);
  cursor:pointer; padding:3px 8px; border-radius:7px; font-size:12.5px; }
.crumb button:hover { color:var(--text); border-color:var(--line); }
.crumb button:disabled { color:var(--text); cursor:default; }
.crumb .crumb-seg { display:inline-flex; align-items:center; gap:4px; }
.crumb i { font-style:normal; opacity:.5; }
.hud-top .icon-btn { width:32px; height:32px; display:grid; place-items:center; border-radius:8px;
  background:none; border:1px solid transparent; color:var(--dim); cursor:pointer; font-size:15px;
  transition:all .15s; }
.hud-top .icon-btn:hover { color:var(--text); border-color:var(--line);
  background:color-mix(in srgb, var(--bg) 55%, transparent); }
.hud-top .brand { font-weight:700; letter-spacing:2.5px; font-size:12.5px; color:var(--text);
  white-space:nowrap; margin-right:4px;
  text-shadow:0 0 20px color-mix(in srgb, var(--accent) 45%, transparent); }
body[data-theme="diablo"] .brand,
body[data-theme="diablo"] .modal-head b,
body[data-theme="diablo"] .panel h3,
body[data-theme="diablo"] .assistant .ahead b,
body[data-theme="diablo"] .legend h4,
body[data-theme="diablo"] .feed .ftitle {
  font-family: Georgia, 'Times New Roman', serif; letter-spacing:1.5px;
}
body[data-theme="diablo"] .brand { letter-spacing:3px; }
.hud-top .search { flex:0 1 340px; display:flex; align-items:center; gap:9px; height:34px;
  background:color-mix(in srgb, var(--bg) 50%, transparent); border:1px solid var(--line);
  border-radius:9px; padding:0 12px; color:var(--muted); font-family:var(--font-mono);
  font-size:11px; letter-spacing:.4px; cursor:pointer; transition:all .15s; }
.hud-top .search .s-ic { font-size:13px; }
.hud-top .search:hover { border-color:color-mix(in srgb, var(--accent) 55%, transparent); color:var(--dim);
  background:color-mix(in srgb, var(--bg) 70%, transparent); }
.hud-top .search kbd { margin-left:auto; }
.hud-top .search kbd + kbd { margin-left:2px; }
.hud-top .grow { flex:1; }
.hud-top .clock { font-family:var(--font-mono); font-size:11px; color:var(--dim); letter-spacing:.5px;
  font-variant-numeric:tabular-nums; }
.hud-top .stat { font-family:var(--font-mono); font-size:9.5px; color:var(--muted); white-space:nowrap;
  letter-spacing:.2px; }
kbd { font-family:var(--font-mono); font-size:8.5px; border:1px solid var(--line); border-bottom-width:2px;
  border-radius:4px; padding:1px 4px; color:var(--muted); line-height:1; }

/* Mode-Toggle */
.mode-toggle { display:flex; border:1px solid var(--line); border-radius:9px; overflow:hidden; height:32px;
  background:color-mix(in srgb, var(--bg) 45%, transparent); }
.mode-toggle button { background:none; border:none; color:var(--muted); font-family:var(--font-display);
  font-weight:600; font-size:11px; letter-spacing:.3px; padding:0 12px; cursor:pointer; transition:all .15s; }
.mode-toggle button:hover { color:var(--dim); }
.mode-toggle button.on { background:color-mix(in srgb, var(--accent) 16%, transparent); color:var(--accent); }

/* Chips (Avatar / Theme) */
.chip { display:flex; align-items:center; gap:7px; height:32px; padding:0 12px; border-radius:9px;
  border:1px solid var(--line); background:color-mix(in srgb, var(--bg) 45%, transparent);
  color:var(--dim); font-family:var(--font-display); font-weight:600; font-size:11px; letter-spacing:.3px;
  cursor:pointer; white-space:nowrap; transition:all .15s; }
.chip:hover { border-color:color-mix(in srgb, var(--accent) 55%, transparent); color:var(--text); }
.chip.on { border-color:color-mix(in srgb, var(--accent) 45%, transparent);
  background:color-mix(in srgb, var(--accent) 12%, transparent); color:var(--accent); }
.chip .sw2 { display:flex; gap:3px; }
.chip .sw2 i { width:9px; height:9px; border-radius:3px; }
.theme-chip { text-transform:none; }

/* ---------- Left rail ---------- */
.rail { position:fixed; left:0; top:52px; bottom:0; width:44px; display:flex; flex-direction:column;
  align-items:center; gap:8px; padding:14px 0; z-index:30;
  background:linear-gradient(90deg, color-mix(in srgb, var(--bg) 55%, transparent), transparent); }
.rail-title { writing-mode:vertical-rl; transform:rotate(180deg); font-family:var(--font-mono);
  font-size:8.5px; letter-spacing:3px; color:var(--muted); margin-bottom:10px; }
.rail .tool { width:30px; height:30px; display:grid; place-items:center; border-radius:8px;
  border:1px solid transparent; background:none; color:var(--muted); cursor:pointer; font-size:13px; }
.rail .tool:hover { color:var(--text); border-color:var(--line); }
.rail .tool.active { color:var(--accent); border-color:color-mix(in srgb, var(--accent) 40%, transparent);
  background:color-mix(in srgb, var(--accent) 8%, transparent); }

/* ---------- Right column ---------- */
.hud-right { position:fixed; right:14px; top:64px; width:300px; display:flex; flex-direction:column;
  gap:11px; z-index:25; max-height:calc(100vh - 88px); overflow-y:auto; scrollbar-width:none;
  padding-bottom:8px; }
.hud-right::-webkit-scrollbar { display:none; }
.panel { border-radius:var(--radius); padding:13px 14px; }
.panel h3 { font-size:9.5px; letter-spacing:1.7px; color:var(--muted); font-weight:600;
  margin-bottom:10px; display:flex; align-items:center; gap:7px; text-transform:uppercase; }
.panel h3 .dot { width:6px; height:6px; border-radius:50%; background:var(--ring);
  box-shadow:0 0 8px var(--ring); animation:blink 2.6s infinite; }
@keyframes blink { 0%,100%{opacity:1} 50%{opacity:.35} }

/* Metrics */
.mgrid { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
.mcell { border:1px solid var(--line); border-radius:9px; padding:9px 10px; background:color-mix(in srgb,var(--bg) 30%,transparent); }
.mcell .mv { font-family:var(--font-mono); font-size:17px; color:var(--text); font-weight:500; }
.mcell .ml { font-family:var(--font-mono); font-size:8.5px; color:var(--muted); letter-spacing:.6px;
  text-transform:uppercase; margin-top:2px; }
.mcell .mv.accent { color:var(--accent); }
.bars { display:flex; align-items:flex-end; gap:3px; height:34px; margin-top:10px; }
.bars i { flex:1; background:linear-gradient(180deg,var(--accent),color-mix(in srgb,var(--accent) 15%,transparent));
  border-radius:2px 2px 0 0; min-height:2px; }
.sub { font-family:var(--font-mono); font-size:8.5px; letter-spacing:1px; color:var(--muted);
  margin:11px 0 4px; text-transform:uppercase; }

/* Activity feed */
.feed { display:flex; flex-direction:column; gap:8px; max-height:180px; overflow-y:auto; scrollbar-width:none; }
.feed::-webkit-scrollbar { display:none; }
.fitem { display:flex; gap:8px; align-items:flex-start; cursor:pointer; border:none; background:none;
  border-radius:7px; padding:5px 6px; width:100%; text-align:left; }
.fitem:hover { background:color-mix(in srgb, var(--accent) 8%, transparent); }
.fitem .fdot { width:7px; height:7px; border-radius:50%; margin-top:4px; flex-shrink:0; }
.fitem > span:last-child { display:flex; flex-direction:column; min-width:0; }
.fitem .ftitle { font-size:11.5px; color:var(--text); line-height:1.35; overflow:hidden;
  text-overflow:ellipsis; white-space:nowrap; }
.fitem .fmeta { font-family:var(--font-mono); font-size:8.5px; color:var(--muted); margin-top:1px;
  overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }

/* ---------- Assistant ---------- */
.assistant { position:fixed; right:14px; bottom:14px; width:min(340px,92vw); z-index:28;
  border-radius:var(--radius); display:flex; flex-direction:column; overflow:hidden; max-height:60vh; }
.assistant .ahead { display:flex; align-items:center; gap:8px; padding:10px 12px; border-bottom:1px solid var(--line); }
.assistant .ahead b { font-family:var(--font-mono); font-size:10px; letter-spacing:1.4px; }
.src-toggle { margin-left:auto; display:flex; gap:4px; }
.src-toggle button { background:none; border:1px solid var(--line); color:var(--muted);
  font-family:var(--font-mono); font-size:8.5px; padding:3px 8px; border-radius:5px; cursor:pointer; }
.src-toggle button.on { background:color-mix(in srgb,var(--accent) 16%,transparent);
  border-color:var(--accent); color:var(--accent); }
.alog { flex:1; overflow-y:auto; padding:11px 12px; display:flex; flex-direction:column; gap:9px;
  min-height:90px; scrollbar-width:none; }
.alog::-webkit-scrollbar { display:none; }
.amsg { display:flex; gap:7px; font-size:11.5px; line-height:1.45; }
.amsg .who { font-family:var(--font-mono); font-size:8px; color:var(--accent); white-space:nowrap; padding-top:3px; }
.amsg.me .who { color:var(--accent-2); }
.amsg .txt { color:var(--dim); white-space:pre-wrap; }
.ain { display:flex; gap:6px; padding:9px 11px; border-top:1px solid var(--line); }
.ain input { flex:1; background:color-mix(in srgb,var(--bg) 55%,transparent); border:1px solid var(--line);
  border-radius:8px; color:var(--text); font-family:var(--font-mono); font-size:11px; padding:8px 10px; outline:none; }
.ain input:focus { border-color:var(--accent); }
.ain button { width:34px; background:var(--accent); border:none; border-radius:8px; color:#04101f;
  font-weight:700; cursor:pointer; }
.ain button:disabled { opacity:.5; }

/* ---------- Legend ---------- */
.legend { position:fixed; left:14px; bottom:14px; z-index:26; border-radius:11px; padding:9px 11px;
  display:flex; flex-direction:column; gap:3px; }
.legend h4 { font-family:var(--font-mono); font-size:8.5px; letter-spacing:1.5px; color:var(--muted);
  margin-bottom:3px; text-transform:uppercase; }
.leg { display:flex; align-items:center; gap:8px; background:none; border:none; color:var(--dim);
  font-family:var(--font-mono); font-size:10px; cursor:pointer; padding:2px 4px; border-radius:4px; }
.leg:hover { background:color-mix(in srgb,var(--accent) 8%,transparent); color:var(--text); }
.leg.off { opacity:.3; }
.leg .sq { width:8px; height:8px; border-radius:2px; }
.leg-hint { font-family:var(--font-mono); font-size:8px; color:var(--muted); margin-top:5px; }
.leg-hint b { color:var(--accent); }

/* ---------- Tooltip ---------- */
.tooltip { position:fixed; pointer-events:none; border-radius:9px; padding:7px 10px; z-index:45; max-width:280px; }
.tooltip b { display:block; font-size:12px; margin-bottom:1px; }
.tooltip span { font-family:var(--font-mono); font-size:9px; color:var(--muted); }

/* ---------- Node detail ---------- */
.detail { position:fixed; left:14px; top:64px; bottom:64px; width:min(520px,46vw); z-index:35;
  border-radius:var(--radius); display:flex; flex-direction:column;
  background:color-mix(in srgb,var(--bg) 88%,transparent); backdrop-filter:blur(18px); }
.detail .dhead { display:flex; align-items:flex-start; gap:10px; padding:13px 15px; border-bottom:1px solid var(--line); }
.detail .dhead .dt b { font-size:14px; display:block; line-height:1.3; }
.detail .dhead .dt span { font-family:var(--font-mono); font-size:9px; color:var(--muted); }
.detail .dtags { display:flex; gap:5px; flex-wrap:wrap; margin-top:6px; }
.detail .dtag { font-family:var(--font-mono); font-size:8.5px; color:var(--dim); border:1px solid var(--line);
  border-radius:999px; padding:1px 7px; }
.detail .dclose { margin-left:auto; background:none; border:none; color:var(--muted); font-size:14px; cursor:pointer; }
.detail .dbody { flex:1; overflow-y:auto; padding:14px 16px; font-family:var(--font-mono); font-size:12px;
  line-height:1.7; color:var(--text); white-space:pre-wrap; scrollbar-width:thin; }
.detail textarea { flex:1; background:transparent; border:none; outline:none; resize:none; color:var(--text);
  font-family:var(--font-mono); font-size:12px; line-height:1.7; padding:14px 16px; }
.detail .dfoot { display:flex; align-items:center; gap:10px; padding:9px 15px; font-family:var(--font-mono);
  font-size:9.5px; color:var(--muted); border-top:1px solid var(--line); }
.detail .dfoot .grow { flex:1; }
.detail .dfoot button { background:var(--accent); border:none; border-radius:7px; color:#04101f;
  font-weight:700; font-size:10.5px; padding:6px 12px; cursor:pointer; }
.detail .links { padding:0 16px 14px; }
.detail .links .lh { font-family:var(--font-mono); font-size:8.5px; color:var(--muted); letter-spacing:1px;
  text-transform:uppercase; margin:10px 0 6px; }
.detail .links button { display:block; width:100%; text-align:left; background:none; border:none;
  color:var(--dim); font-size:11.5px; padding:5px 8px; border-radius:6px; cursor:pointer; }
.detail .links button:hover { background:color-mix(in srgb,var(--accent) 8%,transparent); color:var(--text); }

/* ---------- Command palette ---------- */
.palette-backdrop { position:fixed; inset:0; background:color-mix(in srgb,var(--bg) 55%,transparent);
  z-index:60; display:grid; place-items:start center; padding-top:13vh; backdrop-filter:blur(3px); }
.palette { width:min(560px,92vw); border-radius:14px; overflow:hidden;
  background:color-mix(in srgb,var(--bg) 92%,transparent); backdrop-filter:blur(20px); }
.palette input { width:100%; background:none; border:none; border-bottom:1px solid var(--line);
  color:var(--text); font-family:var(--font-mono); font-size:13px; padding:15px 18px; outline:none; }
.presults { max-height:340px; overflow-y:auto; scrollbar-width:thin; }
.presults button { display:flex; align-items:center; gap:10px; width:100%; text-align:left; background:none;
  border:none; color:var(--dim); font-size:13px; padding:10px 18px; cursor:pointer; }
.presults button:hover, .presults button.sel { background:color-mix(in srgb,var(--accent) 10%,transparent); color:var(--text); }
.presults .sq { width:8px; height:8px; border-radius:2px; flex-shrink:0; }
.presults em { margin-left:auto; font-family:var(--font-mono); font-size:8.5px; font-style:normal;
  color:var(--muted); max-width:220px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.pempty { padding:16px 18px; font-family:var(--font-mono); font-size:11px; color:var(--muted); }
.phint { padding:8px 18px; font-family:var(--font-mono); font-size:8.5px; color:var(--muted);
  border-top:1px solid var(--line); display:flex; gap:14px; }

/* ---------- Modal (settings) ---------- */
.modal-backdrop { position:fixed; inset:0; background:color-mix(in srgb,var(--bg) 60%,transparent);
  z-index:70; display:grid; place-items:center; backdrop-filter:blur(4px); }
.modal { width:min(560px,94vw); max-height:88vh; overflow-y:auto; border-radius:16px;
  background:color-mix(in srgb,var(--bg) 95%,transparent); border:1px solid var(--line);
  box-shadow:0 30px 90px rgba(0,0,0,.6); scrollbar-width:thin; }
.modal-head { display:flex; align-items:center; justify-content:space-between; padding:15px 18px;
  border-bottom:1px solid var(--line); font-family:var(--font-mono); letter-spacing:2px; font-size:12px; }
.modal-head .x { background:none; border:none; color:var(--muted); font-size:15px; cursor:pointer; }
.modal-body { padding:18px; }
.sec-label { font-family:var(--font-mono); font-size:9px; letter-spacing:1.6px; color:var(--muted);
  margin-bottom:10px; text-transform:uppercase; }
.theme-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
.theme-card { display:flex; flex-direction:column; gap:9px; align-items:flex-start; padding:12px;
  border-radius:12px; border:1px solid var(--line); background:color-mix(in srgb,var(--bg) 40%,transparent);
  cursor:pointer; text-align:left; }
.theme-card:hover { border-color:var(--accent); }
.theme-card.active { border-color:var(--accent);
  box-shadow:0 0 0 2px color-mix(in srgb,var(--accent) 22%,transparent), 0 0 22px color-mix(in srgb,var(--accent) 14%,transparent); }
.theme-card .sw { display:flex; gap:4px; }
.theme-card .sw i { width:15px; height:15px; border-radius:4px; }
.theme-card .tn { font-size:12px; color:var(--text); font-family:var(--font-mono); }
.theme-card .tk { font-family:var(--font-mono); font-size:8px; color:var(--muted); letter-spacing:.5px; }

/* ---------- Tuning drawer ---------- */
.tuning { position:fixed; right:0; top:52px; bottom:0; width:300px; z-index:55; overflow-y:auto;
  background:color-mix(in srgb,var(--bg) 94%,transparent); backdrop-filter:blur(20px);
  border-left:1px solid var(--line); padding:16px; transform:translateX(100%); transition:transform .28s cubic-bezier(.4,0,.2,1); scrollbar-width:thin; }
.tuning.open { transform:translateX(0); }
.tuning .thead { display:flex; align-items:center; justify-content:space-between; margin-bottom:14px;
  font-family:var(--font-mono); font-size:11px; letter-spacing:1.6px; }
.tuning .thead .x { background:none; border:none; color:var(--muted); font-size:14px; cursor:pointer; }
.trow { margin-bottom:14px; }
.trow label { display:flex; justify-content:space-between; font-family:var(--font-mono); font-size:9.5px;
  color:var(--dim); letter-spacing:.5px; margin-bottom:6px; text-transform:uppercase; }
.trow label b { color:var(--accent); font-weight:500; }
.trow input[type=range] { width:100%; accent-color:var(--accent); }
.seg { display:flex; border:1px solid var(--line); border-radius:8px; overflow:hidden; }
.seg button { flex:1; background:none; border:none; color:var(--muted); font-family:var(--font-mono);
  font-size:9.5px; padding:7px 4px; cursor:pointer; letter-spacing:.5px; }
.seg button.on { background:color-mix(in srgb,var(--accent) 16%,transparent); color:var(--accent); }
.tcheck { display:flex; align-items:center; gap:8px; font-family:var(--font-mono); font-size:10px; color:var(--dim); cursor:pointer; }
.tcheck input { accent-color:var(--accent); }
.treset { width:100%; margin-top:6px; background:none; border:1px solid var(--line); color:var(--muted);
  font-family:var(--font-mono); font-size:9.5px; padding:8px; border-radius:8px; cursor:pointer; letter-spacing:1px; }
.treset:hover { border-color:var(--accent); color:var(--accent); }

/* ---------- Timeline ---------- */
.timeline { position:fixed; left:50%; transform:translateX(-50%); bottom:14px; display:flex;
  align-items:center; gap:11px; padding:8px 15px; border-radius:999px; z-index:26; }
.timeline .tl-label { font-family:var(--font-mono); font-size:8.5px; letter-spacing:1.5px; color:var(--muted); }
.timeline .tl-date { font-family:var(--font-mono); font-size:9px; color:var(--dim); }
.timeline input[type=range] { width:200px; accent-color:var(--accent); }
.timeline .tl-reset { background:none; border:1px solid var(--accent); color:var(--accent);
  font-family:var(--font-mono); font-size:8.5px; border-radius:999px; padding:2px 9px; cursor:pointer; }

/* ---------- Related ---------- */
.related { position:fixed; left:calc(14px + min(520px,46vw) + 12px); top:64px; width:280px; max-height:380px;
  border-radius:var(--radius); z-index:34; display:flex; flex-direction:column; overflow:hidden;
  background:color-mix(in srgb,var(--bg) 92%,transparent); backdrop-filter:blur(18px); }
.related .rhead { display:flex; align-items:center; gap:8px; padding:10px 13px; border-bottom:1px solid var(--line); }
.related .rhead b { font-family:var(--font-mono); font-size:9.5px; letter-spacing:1.4px; }
.related .rhead .x { margin-left:auto; background:none; border:none; color:var(--muted); cursor:pointer; }
.related .rlist { overflow-y:auto; padding:6px; scrollbar-width:none; }
.related .rlist::-webkit-scrollbar { display:none; }
.related .ritem { display:block; width:100%; text-align:left; background:none; border:none; border-radius:8px;
  padding:8px 10px; cursor:pointer; }
.related .ritem:hover { background:color-mix(in srgb,var(--accent) 8%,transparent); }
.related .rt { font-size:11.5px; color:var(--text); }
.related .rp { font-family:var(--font-mono); font-size:8px; color:var(--muted); }
.related .rl { padding:14px; font-family:var(--font-mono); font-size:10px; color:var(--muted); text-align:center; }

/* ---------- 3D-Labels ---------- */
.node-label { font-family:var(--font-mono); font-size:10px; letter-spacing:.5px; color:var(--text);
  white-space:nowrap; padding:2px 7px; border-radius:6px; transform:translateY(-4px);
  background:color-mix(in srgb, var(--bg) 68%, transparent); border:1px solid var(--line);
  text-shadow:0 1px 3px rgba(0,0,0,.8); user-select:none; }

/* ---------- scanlines ---------- */
.scanlines { position:fixed; inset:0; pointer-events:none; z-index:50; opacity:.02;
  background:repeating-linear-gradient(0deg, transparent 0 2px, rgba(180,220,255,.5) 2px 3px); }

::-webkit-scrollbar { width:10px; height:10px; }
::-webkit-scrollbar-track { background:transparent; }
::-webkit-scrollbar-thumb { background:color-mix(in srgb,var(--accent) 40%,transparent); border-radius:8px;
  border:2px solid transparent; background-clip:content-box; }

@media (prefers-reduced-motion: reduce) { *,*::before,*::after { animation:none!important; transition:none!important; } }
@media (max-width: 900px) {
  .hud-right, .related { display:none; }
  .detail { width:92vw; }
}

/* ---------- Hand-Gesten-Overlay (?hands=1) ---------- */
.hcursor {
  position: fixed; width: 44px; height: 44px; margin: -22px 0 0 -22px;
  border-radius: 50%; pointer-events: none; z-index: 1200;
  border: 2px solid var(--accent, #8ff0e4); opacity: .85;
  transition: transform .08s ease, border-color .12s ease;
  background: radial-gradient(circle, rgba(143,240,228,.08) 0%, transparent 70%);
}
.hcursor.pinched {
  transform: scale(.62); border-color: var(--accent, #8ff0e4);
  background: radial-gradient(circle, rgba(143,240,228,.55) 0%, rgba(143,240,228,.15) 60%);
  box-shadow: 0 0 22px rgba(143,240,228,.6);
}
.hcursor.armed { border-color: #ffd27a; box-shadow: 0 0 26px rgba(255,210,122,.5); }
.hcursor.fisting { border-color: #ff6b6b; background: radial-gradient(circle, rgba(255,107,107,.35) 0%, transparent 70%); box-shadow: 0 0 24px rgba(255,107,107,.45); }
.handhint.rec { border-color: rgba(255,107,107,.6); }
.hcursor .armring { position:absolute; inset:-6px; width:56px; height:56px; }
.hcursor .armring circle { stroke:#ffd27a; }
.hcursor .armeddot {
  position:absolute; top:3px; right:3px; width:8px; height:8px; border-radius:50%;
  background:#ffd27a; box-shadow:0 0 10px #ffd27a;
}
.handhint {
  /* Oben unter der TopBar — da steht die Webcam, dorthin schaut man
     bei Gesten sowieso; unten überlappte es Legende/Detail. */
  position: fixed; top: 62px; left: 50%; transform: translateX(-50%);
  padding: 10px 18px; font-size: 14px; z-index: 1200; pointer-events: none;
  border-radius: 12px; letter-spacing:.04em;
}
.handhint em { opacity:.6; font-style: normal; margin-left: 8px; }

/* ---------- v4: Gesten-Highlight (hover pulsiert, Auswahl glüht nach) ---------- */
.hand-hi { animation: handPulse 1.1s ease-in-out infinite !important;
  outline: 1.5px solid color-mix(in srgb, var(--accent) 65%, transparent) !important;
  outline-offset: 2px; }
.hand-sel { animation: handSel 1.6s ease-out 1 !important;
  outline: 2px solid var(--accent) !important; outline-offset: 2px; }
@keyframes handPulse {
  0%, 100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--accent) 35%, transparent); }
  50% { box-shadow: 0 0 14px 3px color-mix(in srgb, var(--accent) 45%, transparent); } }
@keyframes handSel {
  0% { box-shadow: 0 0 18px 6px color-mix(in srgb, var(--accent) 75%, transparent); }
  100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--accent) 0%, transparent); } }
.hcursor.circling { border-color: var(--accent); box-shadow: 0 0 12px var(--accent); }


/* ---------- S12: Mobile (Touch) ---------- */
@media (max-width: 820px), (pointer: coarse) and (max-width: 1024px) {
  .hud-top { height:auto; min-height:48px; flex-wrap:wrap; padding:8px 10px; gap:6px; }
  .hud-top .brand { font-size:12px; }
  .hud-top .mode-toggle button { padding:4px 8px; font-size:11px; }
  .hud-top .search { flex:1 1 100%; order:9; }
  .crumb { order:8; flex-basis:100%; overflow-x:auto; max-width:100vw; }
  .rail, .hud-right, .assistant, .related, .timeline { display:none !important; }
  /* Detail als Bottom-Sheet, Palette/Detail voll breit */
  .detail { left:0; right:0; bottom:0; top:auto; width:auto; max-height:62vh;
            border-radius:16px 16px 0 0; }
  .palette-backdrop { align-items:flex-end; }
  .palette { width:100%; border-radius:16px 16px 0 0; }
  .legend { left:8px; right:8px; bottom:8px; width:auto; }
  .node-label { font-size:12px !important; }
  .handhint { top: 178px; font-size: 12px; padding: 8px 12px; }
  canvas { touch-action:none; }
}
/* ---------- Phone-Panel (G2) ---------- */
.phone-panel .modal-body { min-width: 460px; }
.pp-status { font-size: 13.5px; margin-bottom: 14px; color: var(--text); }
.pp-grid { display: flex; gap: 18px; }
.pp-qr { display: flex; flex-direction: column; align-items: center; gap: 6px; }
.pp-qr img { border-radius: 10px; background: #fff; padding: 6px; }
.pp-qr-fallback { width: 168px; height: 168px; display: grid; place-items: center;
  border: 1px dashed var(--line); border-radius: 10px; color: var(--muted); text-align: center; }
.pp-qr-hint { font-size: 11.5px; color: var(--muted); }
.pp-steps { flex: 1; min-width: 240px; }
.pp-steps ol { margin: 6px 0 0 18px; padding: 0; font-size: 13.5px; line-height: 1.65; }
.pp-steps input { width: 100%; background: var(--panel); border: 1px solid var(--line);
  color: var(--text); border-radius: 8px; padding: 8px 10px; font-size: 12.5px;
  font-family: var(--font-mono); }
.pp-actions { display: flex; gap: 8px; margin-top: 8px; }
.pp-actions button, .pp-actions a { background: none; border: 1px solid var(--line);
  color: var(--dim); border-radius: 8px; padding: 6px 12px; font-size: 12.5px;
  cursor: pointer; text-decoration: none; }
.pp-actions button:hover, .pp-actions a:hover { color: var(--text); }
.pp-actions button.on { color: #7dffb8; border-color: #2a6; }
@media (max-width: 820px) { .phone-panel .modal-body { min-width: 0; width: 92vw; }
  .pp-grid { flex-direction: column; align-items: center; } }

/* ---------- Kalibrier-Panel: KEINE Scrollbar, kein Zittern ---------- */
.calib-panel { overflow: hidden; max-height: none; }
.calib-panel .modal-body { min-height: 330px; display: flex; flex-direction: column; }
/* variable Textzeilen bekommen feste Mindesthöhen → Höhe ändert sich nie */
.calib-panel .tk.calib-status { min-height: 40px; }
.calib-panel .tk.calib-metrics { min-height: 28px; }
@media (max-width: 820px) {
  .calib-panel .modal-body { min-height: 300px; padding: 12px; }
}
`;
