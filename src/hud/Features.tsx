// Advanced-Interaktionen: Timeline-Filter, Related-Panel, Neighbor-Fokus (F).
import { useEffect, useMemo, useState } from 'react';
import { useGraph, useSelection } from '../state/stores';

/* ---------- Timeline (unten mittig) ---------- */
export function TimeSlider({ onCutoff }: { onCutoff: (date: string | null) => void }) {
  const graph = useGraph((s) => s.graph);
  const setCutoff = useGraph((s) => s.setCutoff);
  const [pos, setPos] = useState(100);

  const dates = useMemo(
    () => ((graph?.nodes ?? []).map((n) => n.mtime).filter(Boolean) as string[]).sort(),
    [graph],
  );
  if (dates.length < 2) return null;
  let first = dates[0];
  const last = dates[dates.length - 1];
  if (first === last) {
    const d = new Date(first);
    d.setMonth(d.getMonth() - 6);
    first = d.toISOString().slice(0, 10);
  }

  function change(v: number) {
    setPos(v);
    if (v >= 100) { onCutoff(null); setCutoff(null); return; }
    const fi = new Date(first).getTime();
    const la = new Date(last).getTime();
    const cut = new Date(fi + ((la - fi) * v) / 100).toISOString().slice(0, 10);
    onCutoff(cut);
    setCutoff(cut);
  }

  return (
    <div className="timeline glass corners">
      <span className="tl-label">TIMELINE</span>
      <span className="tl-date">{first}</span>
      <input type="range" min={0} max={100} value={pos} onChange={(e) => change(Number(e.target.value))} aria-label="Zeit-Filter" />
      <span className="tl-date">{last}</span>
      {pos < 100 && <button className="tl-reset" onClick={() => change(100)}>alle</button>}
    </div>
  );
}

/* ---------- Related (Taste R) ---------- */
interface RelNode { id: string; title: string; path: string; score: string }
export function RelatedPanel({ onFly }: { onFly: (id: string) => void }) {
  const selected = useSelection((s) => s.selected);
  const graph = useGraph((s) => s.graph);
  const [rel, setRel] = useState<RelNode[] | null>(null);
  const [open, setOpen] = useState(false);
  const node = graph?.nodes.find((n) => n.id === selected);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (
        e.key.toLowerCase() === 'r' &&
        node &&
        !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)
      ) {
        setOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [node]);

  useEffect(() => {
    setRel(null);
    if (open && node?.path) {
      fetch(`/similar?path=${encodeURIComponent(node.path)}`)
        .then((r) => r.json())
        .then((j) => setRel(j.results ?? []))
        .catch(() => setRel([]));
    }
  }, [open, node?.path]);

  if (!node || !open) return null;
  return (
    <div className="related glass corners">
      <div className="rhead">
        <b>VERWANDT</b>
        <button className="x" onClick={() => setOpen(false)}>✕</button>
      </div>
      <div className="rlist">
        {rel === null && <div className="rl">suche …</div>}
        {rel?.length === 0 && <div className="rl">nichts Verwandtes gefunden</div>}
        {rel?.map((r) => (
          <button key={r.id} className="ritem" onClick={() => onFly(r.id)}>
            <div className="rt">{r.title}</div>
            <div className="rp">{r.score} · {r.path}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------- Neighbor-Fokus (Taste F) ---------- */
export function useNeighborFocus() {
  const graph = useGraph((s) => s.graph);
  const selected = useSelection((s) => s.selected);
  const [focusMode, setFocusMode] = useState(false);

  // 2026-09-10: Auto-Drill-down ENTFERNT — bei Kreis-Gesten
  // verschwanden dadurch nach und nach alle Nodes. Nachbarschafts-Fokus
  // jetzt nur noch manuell per Taste F; Auswahl fliegt nur hin.

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (
        e.key.toLowerCase() === 'f' &&
        selected &&
        !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)
      ) {
        setFocusMode((m) => !m);
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [selected]);
  useEffect(() => { if (!selected) setFocusMode(false); }, [selected]);

  const neighborSet = useMemo(() => {
    if (!focusMode || !graph || !selected) return null;
    const s = new Set<string>([selected]);
    for (const e of graph.edges) {
      if (e.source === selected) s.add(e.target);
      if (e.target === selected) s.add(e.source);
    }
    return s;
  }, [focusMode, graph, selected]);

  return { focusMode, setFocusMode, neighborSet };
}
