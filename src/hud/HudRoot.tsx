// HUD-Kern: TopBar, Rail, Legende, Tooltip, Node-Detail, Command-Palette.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useGraph, useSelection, useUi } from '../state/stores';
import { categoryColor, CATEGORY_LABELS } from '../lib/colors';
import { useHand } from '../lib/handControl';
import { useTheme, useUiMode, useTuning, useTuningStore } from '../state/theme';
import type { Category } from '../data/types';

const CATS: Category[] = ['core', 'knowledge', 'logic', 'data', 'neutral'];

/* ---------- TopBar ---------- */
export function TopBar() {
  const [time, setTime] = useState('');
  const graph = useGraph((s) => s.graph);
  const setPalette = useUi((s) => s.setPalette);
  const setTuning = useUi((s) => s.setTuning);
  const theme = useTheme((s) => s.theme);
  const { mode, setMode } = useUiMode();
  const tuning = useTuning();
  const avatar = tuning.avatar;
  const setT = useTuningStore((s) => s.set);

  useEffect(() => {
    const upd = () => setTime(new Date().toLocaleTimeString('de-DE', { hour12: false }));
    upd();
    const id = setInterval(upd, 1000);
    return () => clearInterval(id);
  }, []);

  const wordmark = theme.kind === 'branded' && theme.wordmark ? theme.wordmark : 'BRAIN GALAXY';
  const source = useGraph((s) => s.source);
  const setSource = useGraph((s) => s.setSource);
  const groupMode = useGraph((s) => s.groupMode);
  const setGroupMode = useGraph((s) => s.setGroupMode);
  const hasCommunities = !!useGraph((s) => s.graph?.meta.communities?.length);
  const drill = useGraph((s) => s.drill);
  const drillInto = useGraph((s) => s.drillInto);
  const drillUp = useGraph((s) => s.drillUp);

  return (
    <header className="hud-top">
      <span className="brand">{wordmark}</span>

      <div className="mode-toggle" role="tablist" aria-label="UI-Modus">
        <button className={mode === 'simple' ? 'on' : ''} onClick={() => setMode('simple')}>Schlicht</button>
        <button className={mode === 'advanced' ? 'on' : ''} onClick={() => setMode('advanced')}>Erweitert</button>
      </div>

      <div className="mode-toggle" role="tablist" aria-label="Datenquelle">
        <button className={source === 'vault' ? 'on' : ''} onClick={() => setSource('vault')} title="Obsidian-Vault via brain-indexer">Vault</button>
        <button className={source === 'hive' ? 'on' : ''} onClick={() => setSource('hive')} title="Hivemind-Brain via Librarian">Hive 🧠</button>
      </div>

      <div className="mode-toggle" role="tablist" aria-label="Sicht: Ordner oder Themen">
        <button
          className={groupMode === 'folder' ? 'on' : ''}
          onClick={() => setGroupMode('folder')}
          title="Nach Ordnern gruppieren (Drill-down 📁)"
        >📁 Ordner</button>
        <button
          className={groupMode === 'theme' ? 'on' : ''}
          onClick={() => setGroupMode('theme')}
          disabled={!hasCommunities}
          title="Nach Themen gruppieren — Communities über Wikilinks (Label-Propagation, Indexer v2)"
        >🧠 Themen</button>
      </div>

      {drill && (
        <nav className="crumb" aria-label="Drill-down-Pfad" title="Esc = eine Ebene hoch">
          <button onClick={() => drillUp()} title="Zurück zur Übersicht">✕ Übersicht</button>
          {drill.kind === 'folder'
            ? drill.id.split('/').map((seg, i, arr) => (
                <span key={seg + i} className="crumb-seg">
                  <button
                    onClick={() => drillInto({ id: 'folder:' + arr.slice(0, i + 1).join('/'), label: '📁 ' + seg })}
                  >{seg}</button>
                  {i < arr.length - 1 && <i>›</i>}
                </span>
              ))
            : <span className="crumb-seg"><button disabled>🧠 {drill.label}</button></span>}
        </nav>
      )}

      <button className="search" onClick={() => setPalette(true)}>
        <span className="s-ic">⌕</span> Notizen durchsuchen <kbd>Ctrl</kbd><kbd>K</kbd>
      </button>

      <div className="grow" />

      {graph && (
        <span className="stat">{graph.meta.nodeCount} Notizen · {graph.meta.wikilinkCount} Links</span>
      )}
      <span className="clock">{time}</span>

      <button
        className={`chip ${tuning.showEdges ? 'on' : ''}`}
        onClick={() => setT({ showEdges: !tuning.showEdges })}
        title="Kanten (Verbindungen) an/aus"
      >
        Kanten
      </button>

      <button
        className={`chip ${avatar ? 'on' : ''}`}
        onClick={() => setT({ avatar: !avatar })}
        title="Avatar in der Mitte an/aus"
      >
        {theme.kind === 'branded' ? 'Avatar' : 'Kern'}
      </button>

      <button className="icon-btn" onClick={() => setTuning(true)} aria-label="Darstellung anpassen" title="Darstellung anpassen">⚙</button>

      {/* B1/B2: Gesten direkt aus der Galaxy schalten + Phone-Status sehen */}
      <HandsToggle />

      {/* G2: Phone verbinden — QR, URL-Einstellung, Anleitung */}
      <button
        className="icon-btn"
        onClick={() => useUi.getState().setPhonePanel(true)}
        aria-label="Phone verbinden"
        title="Phone verbinden (QR-Code, Anleitung)"
      >📱</button>
    </header>
  );
}

/* ---------- Left rail (advanced) ---------- */
export function NavRail() {
  const setSelected = useSelection((s) => s.setSelected);
  const theme = useTheme((s) => s.theme);
  return (
    <nav className="rail">
      <span className="rail-title">{(theme.wordmark ?? 'BRAIN GALAXY').toUpperCase()}</span>
      <button className="tool active" title="Übersicht" onClick={() => setSelected(null)}>◉</button>
      <button className="tool" title="Cluster">⁂</button>
      <button className="tool" title="Zentrieren" onClick={() => setSelected(null)}>⌂</button>
    </nav>
  );
}

/* ---------- Gesten-Schalter + Phone-Status (B1/B2) ---------- */
export function HandsToggle() {
  const hands = useUi((s) => s.hands);
  const setHands = useUi((s) => s.setHands);
  const connected = useHand((s) => s.connected);
  const phoneUp = useHand((s) => s.phoneUp);
  const next = hands === 'off' ? 'webcam' : 'off';
  return (
    <button
      className={`icon-btn${hands !== 'off' ? ' on' : ''}`}
      onClick={() => setHands(next)}
      title={hands === 'off'
        ? 'Gestensteuerung starten (Webcam — Phone-Modus via ?hands=1)'
        : 'Gestensteuerung stoppen'}
      style={hands !== 'off' ? { color: 'var(--accent, #7dffb8)' } : undefined}
    >
      ✋{hands !== 'off' && (
        <span
          style={{
            display: 'inline-block', marginLeft: 4,
            width: 8, height: 8, borderRadius: '50%',
            background: phoneUp ? '#7dffb8' : connected ? '#ffd27a' : '#e05555',
          }}
          title={phoneUp ? 'Phone streamt' : connected ? 'Relay da, Phone getrennt' : 'Relay getrennt'}
        />
      )}
    </button>
  );
}

/* ---------- Category legend ---------- */
export function CategoryLegend() {
  const hidden = useGraph((s) => s.hiddenCats);
  const toggle = useGraph((s) => s.toggleCat);
  const solo = useGraph((s) => s.soloCat);
  const graph = useGraph((s) => s.graph);
  const present = useMemo(() => {
    const set = new Set(graph?.nodes.map((n) => n.category));
    return CATS.filter((c) => set.has(c));
  }, [graph]);
  const mode = useUiMode((s) => s.mode);
  return (
    <div className="legend glass corners">
      <h4>Kategorien</h4>
      {present.map((c) => (
        <button
          key={c}
          className={`leg ${hidden.has(c) ? 'off' : ''}`}
          onClick={() => toggle(c)}
          onDoubleClick={() => solo(c)}
          title="Klick: an/aus · Doppelklick: isolieren"
        >
          <span className="sq" style={{ background: categoryColor(c), boxShadow: `0 0 8px ${categoryColor(c)}` }} />
          {CATEGORY_LABELS[c]}
        </button>
      ))}
      {mode === 'advanced' && (
        <div className="leg-hint"><b>F</b> Nachbarn · <b>R</b> verwandt · <b>Ctrl+K</b> Suche</div>
      )}
    </div>
  );
}

/* ---------- Tooltip ---------- */
export function NodeTooltip() {
  const hovered = useSelection((s) => s.hovered);
  const graph = useGraph((s) => s.graph);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  useEffect(() => {
    const h = (e: PointerEvent) => setPos({ x: e.clientX, y: e.clientY });
    window.addEventListener('pointermove', h);
    return () => window.removeEventListener('pointermove', h);
  }, []);
  const n = graph?.nodes.find((x) => x.id === hovered);
  if (!n) return null;
  return (
    <div className="tooltip glass" style={{ left: pos.x + 16, top: pos.y + 14 }}>
      <b>{n.label}</b>
      <span>{n.cluster ?? n.path ?? n.id} · {n.words ?? '—'} W · {n.degree} Links</span>
    </div>
  );
}

/* ---------- Node detail ---------- */
export function NodeDetail() {
  const selected = useSelection((s) => s.selected);
  const setSelected = useSelection((s) => s.setSelected);
  const graph = useGraph((s) => s.graph);
  const [content, setContent] = useState('');
  const [edited, setEdited] = useState(false);
  const [state, setState] = useState('');
  const [readonly, setReadonly] = useState(true);

  const n = graph?.nodes.find((x) => x.id === selected);
  const neighbors = useMemo(() => {
    if (!graph || !n) return [];
    const ids = new Set<string>();
    for (const e of graph.edges) {
      if (e.kind !== 'wikilink') continue;
      if (e.source === n.id) ids.add(e.target);
      if (e.target === n.id) ids.add(e.source);
    }
    return graph.nodes.filter((x) => ids.has(x.id));
  }, [graph, n]);

  useEffect(() => {
    setContent('');
    setState('');
    setEdited(false);
    setReadonly(true);
    if (n?.path) {
      fetch(`/note?path=${encodeURIComponent(n.path)}`)
        .then((r) => (r.ok ? r.text() : Promise.reject(r.statusText)))
        .then(setContent)
        .catch(() => setState('Vorschau nicht verfügbar (Demo-Modus)'));
    }
  }, [n?.path]);

  if (!n) return null;

  async function save() {
    if (!n?.path) return;
    setState('Speichert …');
    try {
      const r = await fetch('/note', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: n.path, content }),
      });
      setState(r.ok ? 'Gespeichert ✓' : 'Fehler beim Speichern');
      if (r.ok) setEdited(false);
    } catch {
      setState('Backend nicht erreichbar');
    }
  }

  return (
    <div className="detail glass corners">
      <div className="dhead">
        <div className="dt">
          <b>{n.label}</b>
          <span>{n.path ?? n.cluster ?? n.id}</span>
          {!!n.tags?.length && (
            <div className="dtags">{n.tags.map((t) => <span key={t} className="dtag">#{t}</span>)}</div>
          )}
        </div>
        <button className="dclose" onClick={() => setSelected(null)} aria-label="Schließen">✕</button>
      </div>

      {readonly ? (
        <div className="dbody">{content || state || 'Keine Vorschau.'}</div>
      ) : (
        <textarea
          value={content}
          onChange={(e) => { setContent(e.target.value); setEdited(true); }}
          spellCheck={false}
          autoFocus
          ref={(el) => {
            // C3: Fokus halten — voxtype tippt ins fokussierte Element; im
            // Editor-Modus landet Faust-Diktat so zuverlässig IN der Notiz.
            if (el && !readonly) el.focus({ preventScroll: true });
          }}
        />
      )}

      {!!neighbors.length && (
        <div className="links">
          <div className="lh">Verlinkt mit</div>
          {neighbors.map((x) => (
            <button key={x.id} onClick={() => setSelected(x.id)}>→ {x.label}</button>
          ))}
        </div>
      )}

      <div className="dfoot">
        <span>{n.words ?? '—'} Wörter · {n.degree} Links · {n.mtime ?? ''}</span>
        <span className="grow" />
        {n.path && !readonly && edited && <button onClick={save}>Speichern</button>}
        {n.path && (
          <button onClick={() => setReadonly((r) => !r)} style={{ background: 'none', border: '1px solid var(--line)', color: 'var(--dim)' }}>
            {readonly ? 'Bearbeiten' : 'Vorschau'}
          </button>
        )}
        {state && <span>{state}</span>}
      </div>
    </div>
  );
}

/* ---------- Command palette ---------- */
export function CommandPalette() {
  const open = useUi((s) => s.paletteOpen);
  const setPalette = useUi((s) => s.setPalette);
  const extQuery = useUi((s) => s.paletteQuery);
  const graph = useGraph((s) => s.graph);
  const setSelected = useSelection((s) => s.setSelected);
  const mode = useUiMode((s) => s.mode);
  const [q, setQ] = useState('');
  const [i, setI] = useState(0);
  const [semantic, setSemantic] = useState<{ id: string; title: string; path: string; score: string }[]>([]);

  // Externer Query (Voice/Gesten) überschreibt das lokale Eingabefeld
  useEffect(() => {
    if (extQuery !== null && extQuery !== undefined && extQuery !== '') setQ(extQuery);
    if (extQuery === '') setQ('');
  }, [extQuery]);

  const local = useMemo(() => {
    const nodes = graph?.nodes ?? [];
    if (!q) return nodes.slice(0, 10);
    const ql = q.toLowerCase();
    return nodes
      .filter((n) => n.label.toLowerCase().includes(ql) || (n.path ?? '').toLowerCase().includes(ql))
      .slice(0, 10);
  }, [graph, q]);

  // qmd-Bedeutungssuche (advanced) — gedrosselt
  useEffect(() => {
    if (mode !== 'advanced' || q.length < 3) { setSemantic([]); return; }
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/agent?q=${encodeURIComponent(q)}&n=5`);
        const j = await r.json();
        setSemantic((j.hits ?? []).filter((h: any) => !local.some((l) => l.id === h.id)));
      } catch { setSemantic([]); }
    }, 350);
    return () => clearTimeout(t);
  }, [q, mode, local]);

  const results = useMemo(
    () => [
      ...local.map((n) => ({ id: n.id, label: n.label, path: n.path ?? n.cluster ?? '', cat: n.category, tag: '' })),
      ...semantic.map((h) => ({ id: h.id, label: h.title, path: h.path, cat: 'neutral' as Category, tag: h.score })),
    ],
    [local, semantic],
  );

  useEffect(() => setI(0), [q]);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPalette(!open); }
      if (!open) return;
      if (e.key === 'Escape') setPalette(false);
      if (e.key === 'ArrowDown') { e.preventDefault(); setI((v) => Math.min(v + 1, results.length - 1)); }
      if (e.key === 'ArrowUp') { e.preventDefault(); setI((v) => Math.max(v - 1, 0)); }
      if (e.key === 'Enter' && results[i]) { setSelected(results[i].id); setPalette(false); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, results, i, setPalette, setSelected]);

  if (!open) return null;
  return (
    <div className="palette-backdrop" onClick={() => setPalette(false)}>
      <div className="palette corners" onClick={(e) => e.stopPropagation()}>
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Notiz suchen …" />
        <div className="presults">
          {results.map((r, idx) => (
            <button
              key={r.id + idx}
              className={idx === i ? 'sel' : ''}
              data-node-id={r.id}
              onMouseEnter={() => setI(idx)}
              onClick={() => { setSelected(r.id); setPalette(false); }}
            >
              <span className="sq" style={{ background: categoryColor(r.cat) }} />
              {r.label}
              <em>{r.tag ? `${r.tag} · ` : ''}{r.path}</em>
            </button>
          ))}
          {!results.length && <div className="pempty">keine Treffer</div>}
        </div>
        <div className="phint">
          <span><kbd>↑</kbd><kbd>↓</kbd> wählen</span>
          <span><kbd>⏎</kbd> öffnen</span>
          {mode === 'advanced' && <span>inkl. Bedeutungssuche</span>}
        </div>
      </div>
    </div>
  );
}
