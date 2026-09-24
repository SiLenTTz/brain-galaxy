// Advanced-Panels: echte Vault-Metriken + Aktivitäts-Feed.
import { useEffect } from 'react';
import { useMetrics } from '../data/metrics';
import { useSelection } from '../state/stores';
import { useTheme } from '../state/theme';

export function MetricsPanel() {
  const stats = useMetrics((s) => s.stats);
  const histogram = useMetrics((s) => s.histogram);
  if (!stats) return null;
  const max = Math.max(1, ...histogram);
  return (
    <section className="panel glass corners">
      <h3><span className="dot" /> Vault-Status</h3>
      <div className="mgrid">
        <div className="mcell"><div className="mv accent">{stats.notes}</div><div className="ml">Notizen</div></div>
        <div className="mcell"><div className="mv">{stats.links}</div><div className="ml">Wikilinks</div></div>
        <div className="mcell"><div className="mv">{stats.clusters}</div><div className="ml">Cluster</div></div>
        <div className="mcell"><div className="mv">{stats.orphans}</div><div className="ml">ohne Link</div></div>
      </div>
      <div className="sub">Notizen pro Cluster</div>
      <div className="bars">
        {histogram.map((v, i) => (
          <i key={i} style={{ height: `${8 + (v / max) * 92}%` }} title={`${v}`} />
        ))}
      </div>
      <div className="sub" style={{ marginTop: 12 }}>
        {Math.round(stats.words / 1000)}k Wörter{stats.largest ? ` · größte: „${stats.largest.label}"` : ''}
      </div>
    </section>
  );
}

export function ActivityFeed() {
  const activity = useMetrics((s) => s.activity);
  const loadActivity = useMetrics((s) => s.loadActivity);
  const setSelected = useSelection((s) => s.setSelected);
  const accent = useTheme((s) => s.theme.palette.accent);
  useEffect(() => { loadActivity(); }, [loadActivity]);
  if (!activity.length) return null;
  return (
    <section className="panel glass corners">
      <h3><span className="dot" /> Zuletzt bearbeitet</h3>
      <div className="feed">
        {activity.map((a, i) => (
          <button key={i} className="fitem" onClick={() => a.id && setSelected(a.id)}>
            <span className="fdot" style={{ background: accent, boxShadow: `0 0 6px ${accent}` }} />
            <span>
              <span className="ftitle">{a.title}</span>
              <span className="fmeta">{a.detail} · {a.when}</span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
