// Darstellungs-Regler — immer verfügbar (Zahnrad in der TopBar).
import { useUi } from '../state/stores';
import { useTuning, useTuningStore } from '../state/theme';

function Slider({
  label,
  value,
  min,
  max,
  step,
  fmt,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  fmt?: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="trow">
      <label>
        {label} <b>{fmt ? fmt(value) : value.toFixed(2)}</b>
      </label>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

export function TuningPanel() {
  const open = useUi((s) => s.tuningOpen);
  const setOpen = useUi((s) => s.setTuning);
  const t = useTuning();
  const set = useTuningStore((s) => s.set);
  const reset = useTuningStore((s) => s.reset);

  return (
    <div className={`tuning ${open ? 'open' : ''}`}>
      <div className="thead">
        DARSTELLUNG
        <button className="x" onClick={() => setOpen(false)} aria-label="Schließen">✕</button>
      </div>

      <div className="trow">
        <label>Layout</label>
        <div className="seg">
          <button className={t.layout === 'universe' ? 'on' : ''} onClick={() => set({ layout: 'universe' })}>UNIVERSUM</button>
          <button className={t.layout === 'force' ? 'on' : ''} onClick={() => set({ layout: 'force' })}>CLUSTER</button>
          <button className={t.layout === 'sphere' ? 'on' : ''} onClick={() => set({ layout: 'sphere' })}>SPHÄRE</button>
        </div>
      </div>

      <Slider label="Node-Größe" value={t.nodeScale} min={0.4} max={2.2} step={0.05} fmt={(v) => `${v.toFixed(2)}×`} onChange={(v) => set({ nodeScale: v })} />
      <Slider label="Hub-Größe" value={t.hubScale} min={0.4} max={2.4} step={0.05} fmt={(v) => `${v.toFixed(2)}×`} onChange={(v) => set({ hubScale: v })} />
      <Slider label="Bedeutung: Grad ≥" value={t.minDegree} min={0} max={20} step={1} fmt={(v) => (v === 0 ? 'alles' : `≥ ${v}`)} onChange={(v) => set({ minDegree: v })} />
      <div className="trow">
        <label className="tcheck">
          <input type="checkbox" checked={t.showEdges} onChange={(e) => set({ showEdges: e.target.checked })} />
          Kanten (Verbindungen) zeigen
        </label>
      </div>
      {t.showEdges && (
        <>
          <Slider label="Kanten-Dicke" value={t.edgeWidth} min={0.3} max={3} step={0.05} fmt={(v) => `${v.toFixed(2)}×`} onChange={(v) => set({ edgeWidth: v })} />
          <Slider label="Kanten-Deckkraft" value={t.edgeOpacity} min={0.15} max={1.4} step={0.05} fmt={(v) => `${Math.round(v * 100)}%`} onChange={(v) => set({ edgeOpacity: v })} />
        </>
      )}
      <Slider label="Glühen" value={t.glow} min={0.3} max={2.2} step={0.05} fmt={(v) => `${v.toFixed(2)}×`} onChange={(v) => set({ glow: v })} />
      <Slider label="Bewegung" value={t.motion} min={0} max={1.5} step={0.05} fmt={(v) => `${Math.round(v * 100)}%`} onChange={(v) => set({ motion: v })} />
      <Slider label="Desktop-Hintergrund" value={t.wallpaper} min={0} max={0.4} step={0.02} fmt={(v) => (v <= 0 ? 'aus' : `${Math.round(v * 100)}%`)} onChange={(v) => set({ wallpaper: v })} />

      <div className="trow">
        <label>Labels</label>
        <div className="seg">
          {(['none', 'hubs', 'all'] as const).map((v) => (
            <button key={v} className={t.labels === v ? 'on' : ''} onClick={() => set({ labels: v })}>
              {v === 'none' ? 'AUS' : v === 'hubs' ? 'HUBS' : 'ALLE'}
            </button>
          ))}
        </div>
      </div>

      <div className="trow">
        <label className="tcheck">
          <input
            type="checkbox"
            checked={t.avatar}
            onChange={(e) => set({ avatar: e.target.checked })}
          />
          Avatar in der Mitte zeigen
        </label>
      </div>
      {t.avatar && (
        <Slider label="Avatar-Größe" value={t.avatarScale} min={0.4} max={2.2} step={0.05} fmt={(v) => `${v.toFixed(2)}×`} onChange={(v) => set({ avatarScale: v })} />
      )}
      <div className="trow">
        <label className="tcheck">
          <input
            type="checkbox"
            checked={t.showFolderEdges}
            onChange={(e) => set({ showFolderEdges: e.target.checked })}
          />
          Ordner-Kanten zeigen
        </label>
      </div>

      <button className="treset" onClick={reset}>AUF THEME-STANDARD ZURÜCKSETZEN</button>
    </div>
  );
}
