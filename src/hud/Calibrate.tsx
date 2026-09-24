// Calibrate.tsx — geführte Hand-Kalibrierung (Taste C), LIVE.
// Pro Schritt wird genau EIN Feature scharf geschaltet (setCalibAllow) und
// läuft im Hintergrund echt mit — man sieht/fühlt während der Messung,
// was man tuned (z. B. zoomt das Universum beim Zoom-Schritt wirklich).
// Canyon-Methode: Pose + Impostor samplen, Schwelle zwischen die Bänder.
import { useEffect, useRef, useState } from 'react';
import {
  useHand, setCalibSink, setCalibAllow, calibActionAge, saveCal, resetCal, CAL,
  type CalibFrame, type HandCalib,
} from '../lib/handControl';
import { useUi } from '../state/stores';

type Role = 'relaxed' | 'point' | 'ok' | 'fist' | 'prayer' | 'zoom' | 'fly';
type Which = 'A' | 'B' | 'both';   // A = rechte (Selektor), B = linke (Modi)

interface Step {
  role: Role;
  which: Which;
  title: string;
  hint: string;
  feature: string | null;   // setCalibAllow — null = alles normal
}

const STEPS: Step[] = [
  { role: 'relaxed', which: 'A', feature: '',
    title: '🖐 RECHTE Hand locker offen', hint: 'Rechte Hand entspannt offen halten — Grund-Band (Impostor) für alle Schwellen.' },
  { role: 'relaxed', which: 'B', feature: '',
    title: '🖐 LINKE Hand locker offen', hint: 'Jetzt die linke Hand entspannt offen — auch sie bekommt eigene Messwerte.' },
  { role: 'point', which: 'A', feature: 'point',
    title: '☝️ RECHT: Zeigefinger', hint: 'Nur mit der rechten Hand den Zeigefinger ausstrecken — der Cursor folgt live.' },
  { role: 'point', which: 'B', feature: 'point',
    title: '☝️ LINKS: Zeigefinger', hint: 'Gleiches mit der linken Hand.' },
  { role: 'ok', which: 'A', feature: 'ok',
    title: '🤏 RECHT: OK-Zeichen', hint: 'Daumen+Zeige zusammen, Mittel-/Ringfinger gestreckt. (Schließen ist hier deaktiviert.)' },
  { role: 'ok', which: 'B', feature: 'ok',
    title: '🤏 LINKS: OK-Zeichen', hint: 'Nochmal links — jede Hand wird einzeln vermessen.' },
  { role: 'fist', which: 'B', feature: 'fist',
    title: '✊ LINKS: Faust (Menü!)', hint: 'Linke Hand zur Faust — das Menü öffnet sich LIVE und bleibt, solange die Faust hält.' },
  { role: 'fist', which: 'A', feature: 'fist',
    title: '✊ RECHT: Faust', hint: 'Jetzt rechte Hand zur Faust (gleiche Messung).' },
  { role: 'prayer', which: 'both', feature: 'prayer',
    title: '🙏 Beide Hände zusammen', hint: 'Handflächen aneinander — misst die Librarian-Distanz.' },
  { role: 'zoom', which: 'both', feature: 'zoom',
    title: '🔍 Zoom (LIVE!)', hint: 'Beide Hände offen, in angenehmem Tempo auseinander/zusammen — das Universum zoomt wirklich mit. Deine Bewegung setzt die Zoom-Stärke.' },
  { role: 'fly', which: 'both', feature: 'fly',
    title: '🐍 Fliegen (LIVE!)', hint: 'Beide Hände offen und locker schlangeln — du fliegst wirklich. Deine Wellen-Amplitude setzt die Flug-Stärke.' },
];

const SAMPLE_MS = 4500;
const MIN_SAMPLES = 35;

/** Erwartete Haltung je Schritt — die Messung läuft NUR weiter, solange die
 *  Geste korrekt erkannt wird (grün); sonst pausiert sie (Anforderung). */
function postureMatches(step: { role: Role; which: Which }, f: CalibFrame): boolean {
  const m = step.which === 'A' ? f.A : step.which === 'B' ? f.B : (f.A ?? f.B);
  if (step.role === 'prayer') return f.hands >= 2 && f.nDist != null && f.nDist < 0.25;
  if (step.role === 'zoom' || step.role === 'fly') return f.hands >= 2;
  if (!m) return false;
  const p = (m as { p: string }).p;
  switch (step.role) {
    case 'relaxed': return p === 'palm' || p === 'other';
    case 'point': return p === 'point';
    case 'ok': return p === 'pinch';
    case 'fist': return p === 'fist';
    default: return true;
  }
}

function pct(a: number[], p: number): number {
  const s = a.filter(Number.isFinite).sort((x, y) => x - y);
  if (!s.length) return NaN;
  return s[Math.min(s.length - 1, Math.max(0, Math.round((s.length - 1) * p)))];
}
function canyon(hiBand: number[], loBand: number[], minGap: number, fb: number, loC: number, hiC: number): number {
  const hiV = pct(hiBand, 0.25), loV = pct(loBand, 0.75);
  if (!Number.isFinite(hiV) || !Number.isFinite(loV) || hiV - loV < minGap) return fb;
  return Math.min(hiC, Math.max(loC, (hiV + loV) / 2));
}
const fmt = (x: number) => (Number.isFinite(x) ? x.toFixed(2) : '–');

export function Calibrate() {
  const open = useUi((s) => s.calibOpen);
  const setOpen = useUi((s) => s.setCalib);
  const hands = useUi((s) => s.hands);
  const setHands = useUi((s) => s.setHands);
  const handActive = useHand((s) => s.active);
  const [stepIdx, setStepIdx] = useState(-1);   // -1 Intro, -2 Ergebnis
  const [runId, setRunId] = useState(0);        // Retry ohne Index-Hacks
  const [progress, setProgress] = useState(0);
  const [live, setLive] = useState<CalibFrame | null>(null);
  const [result, setResult] = useState<HandCalib | null>(null);
  const [bands, setBands] = useState<string>('');
  const retried = useRef<Record<number, boolean>>({});
  const [matchedPct, setMatchedPct] = useState(0);
  const matchedPctRef = useRef(0);
  const samples = useRef<Record<string, { extR: number[][]; pinch: number[] }>>({});
  const extra = useRef<{ nDist: number[]; zoomD: number[]; flyE: number[] }>({ nDist: [], zoomD: [], flyE: [] });

  // Engine läuft (Webcam); beim Schließen alles zurücksetzen
  useEffect(() => {
    if (open && hands === 'off') setHands('webcam');
    if (!open) {
      setCalibSink(null); setCalibAllow(null);
      setStepIdx(-1); setResult(null); setProgress(0); retried.current = {};
    }
  }, [open, hands, setHands]);
  useEffect(() => () => { setCalibSink(null); setCalibAllow(null); }, []);

  const step = STEPS[stepIdx];

  // Schritt-Sampling + Timer + LIVE-Freigabe genau dieses Features
  useEffect(() => {
    if (!open || !step) { setCalibAllow(null); return; }
    setCalibAllow(step.feature);
    let matchedMs = 0, lastFrame = 0;
    let done = false, lastLive = 0;
    const sink = (f: CalibFrame) => {
      const now = performance.now();
      const dt = lastFrame ? Math.min(200, now - lastFrame) : 0;
      lastFrame = now;
      if (now - lastLive > 160) { lastLive = now; setLive(f); }
      const m = step.which === 'A' ? f.A : step.which === 'B' ? f.B : (f.A ?? f.B);
      const present = step.which === 'both' ? f.hands >= 2 : !!m;
      const recognized = postureMatches(step, f);
      const steady = f.jitter < 16 || step.role === 'zoom' || step.role === 'fly';
      // NUR bei erkannter Geste zählt Zeit + Samples — sonst pausiert alles
      if (recognized) matchedMs += dt;
      const pctNow = Math.min(1, matchedMs / SAMPLE_MS);
      matchedPctRef.current = pctNow;
      setMatchedPct(pctNow);
      const settle = matchedMs > 600;   // 0.6 s erkannt = eingefahren
      if (recognized && present && steady && m) {
        if (step.role === 'zoom') {
          if (f.dPair != null) extra.current.zoomD.push(Math.abs(f.dPair));
        } else if (step.role === 'fly') {
          if (f.latE != null) extra.current.flyE.push(f.latE);
        } else {
          const key = step.role + step.which;
          const b = (samples.current[key] ??= { extR: [], pinch: [] });
          b.extR.push(m.extR);
          b.pinch.push(m.pinch);
          if (step.role === 'prayer' && f.nDist != null) extra.current.nDist.push(f.nDist);
        }
      }
      if (!done && matchedMs >= SAMPLE_MS) {
        done = true;
        const got = step.role === 'zoom' ? extra.current.zoomD.length
          : step.role === 'fly' ? extra.current.flyE.length
          : (samples.current[step.role + step.which]?.extR.length ?? 0);
        if (got < MIN_SAMPLES && !retried.current[stepIdx]) {
          retried.current[stepIdx] = true;
          setRunId((r) => r + 1);          // gleicher Schritt, Timer neu
          return;
        }
        setStepIdx(stepIdx + 1 < STEPS.length ? stepIdx + 1 : -2);
      }
    };
    setCalibSink(sink);
    return () => setCalibSink(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, stepIdx, runId]);

  // Ergebnis — im Effect, nie im Render
  useEffect(() => {
    if (stepIdx !== -2 || result) return;
    const s = samples.current;
    const g = (role: string) =>
      [s[role + 'A'], s[role + 'B']].filter(Boolean) as { extR: number[][]; pinch: number[] }[];
    const finger = (role: string, i: number) => g(role).flatMap((b) => b.extR.map((r) => r[i]));
    const pinches = (role: string) => g(role).flatMap((b) => b.pinch);
    const extBand = [...finger('point', 0), ...finger('relaxed', 0), ...finger('relaxed', 1),
                     ...finger('relaxed', 2), ...finger('relaxed', 3)];
    const curlBand = [...finger('fist', 0), ...finger('fist', 1), ...finger('fist', 2), ...finger('fist', 3)];
    const relPinch = pinches('relaxed'), okPinch = pinches('ok'), fistPinch = pinches('fist');
    const nD = pct(extra.current.nDist, 0.5);
    const flyMed = pct(extra.current.flyE, 0.5);
    const zoomMed = pct(extra.current.zoomD, 0.5);
    const c: HandCalib = {
      extK: canyon(extBand, curlBand, 0.06, CAL.extK, 1.05, 1.5),
      pinchK: canyon(relPinch, okPinch, 0.15, CAL.pinchK, 0.25, 0.8),
      fistK: canyon(relPinch, fistPinch, 0.12, CAL.fistK, 0.5, 1.1),
      prayerDist: Number.isFinite(nD) ? Math.min(0.3, nD * 1.6) : CAL.prayerDist,
      flyThresh: Number.isFinite(flyMed) && flyMed > 120 ? Math.max(220, flyMed * 0.42) : CAL.flyThresh,
      flyNorm: Number.isFinite(flyMed) && flyMed > 120 ? Math.max(500, flyMed * 1.1) : CAL.flyNorm,
      zoomK: Number.isFinite(zoomMed) && zoomMed > 0.3
        ? Math.min(3.5, Math.max(0.15, 1.7 / zoomMed)) : CAL.zoomK,
    };
    saveCal(c);
    setResult(c);
    setBands(`Bänder: ext ${fmt(pct(extBand, .25))}|${fmt(pct(curlBand, .75))}`
      + ` · pinch ${fmt(pct(relPinch, .25))}|${fmt(pct(okPinch, .75))}`
      + ` · fist ${fmt(pct(relPinch, .25))}|${fmt(pct(fistPinch, .75))}`
      + ` · flyE ${fmt(flyMed)} · zoomΔ ${fmt(zoomMed)}px`
      + `\nSamples: R:${(s['relaxedA']?.extR.length ?? 0) + (s['relaxedB']?.extR.length ?? 0)}`
      + ` P:${(s['pointA']?.extR.length ?? 0) + (s['pointB']?.extR.length ?? 0)}`
      + ` O:${(s['okA']?.pinch.length ?? 0) + (s['okB']?.pinch.length ?? 0)}`
      + ` F:${(s['fistA']?.pinch.length ?? 0) + (s['fistB']?.pinch.length ?? 0)}`
      + ` Z:${extra.current.zoomD.length} Fl:${extra.current.flyE.length}`);
  }, [stepIdx, result]);

  // Esc bricht ab
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, setOpen]);

  if (!open) return null;

  const m = live ? (step?.which === 'A' ? live.A : step?.which === 'B' ? live.B : (live.A ?? live.B)) : null;
  const present = step ? (step.which === 'both' ? (live?.hands ?? 0) >= 2 : !!m) : true;

  return (
    <div className="modal-backdrop" onClick={() => stepIdx === -1 && setOpen(false)}>
      <div className="modal corners calib-panel" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Hände kalibrieren">
        <div className="modal-head">
          <b>🤲 HÄNDE KALIBRIEREN (LIVE)</b>
          <button className="x" onClick={() => setOpen(false)} aria-label="Schließen">✕</button>
        </div>
        <div className="modal-body">
          <div className="tk calib-status" style={{ color: handActive ? 'transparent' : 'var(--muted)' }}>
            Gesten-Engine startet (Webcam) … Kamera erlauben.</div>
          {stepIdx === -1 && (
            <>
              <div className="tk" style={{ lineHeight: 1.6 }}>
                {STEPS.length} Schritte à ~4,5 s — <b>jede Hand einzeln</b> (rechts = Auswahl,
                links = Modi), danach Gebet, <b>Zoom &amp; Fliegen LIVE</b>: das Feature läuft
                während der Messung wirklich mit, deine Bewegung bestimmt die Stärke.
                Zu wenige Samples → der Schritt wiederholt sich. Nach Kamerawechsel: <kbd>C</kbd> erneut.
              </div>
              <div className="pp-actions" style={{ marginTop: 14 }}>
                <button onClick={() => setStepIdx(0)}>Starten</button>
                <button onClick={() => { resetCal(); setOpen(false); }}>Zurücksetzen</button>
              </div>
            </>
          )}
          {step && (
            <>
              <div className="sec-label">Schritt {stepIdx + 1}/{STEPS.length}{retried.current[stepIdx] ? ' · nochmals — ruhiger halten' : ''}</div>
              <div style={{ fontSize: 20, fontWeight: 700, margin: '4px 0 6px' }}>{step.title}</div>
              <div className="tk calib-status">{step.hint}</div>
              <div className="tk calib-status" style={{
                color: live && postureMatches(step, live) ? '#7dffb8' : '#ffd27a' }}>
                {calibActionAge() < 400
                  ? '⚡ AKTION LÄUFT — Geste feuert!'
                  : live && postureMatches(step, live)
                    ? `✓ ERKANNT — messe … (${Math.round(matchedPctRef.current * 100)} %)`
                    : '⏸ PAUSIERT — Geste wird (noch) nicht erkannt. Position anpassen!'}
              </div>
              <div style={{ height: 10, borderRadius: 6, background: 'var(--panel)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${progress * 100}%`, background: 'var(--accent)', transition: 'width .2s' }} />
              </div>
              <div className="tk calib-metrics" style={{ marginTop: 6, fontFamily: 'var(--font-mono)', fontSize: 10,
                fontVariantNumeric: 'tabular-nums', whiteSpace: 'pre' }}>
                {m ? `pinch=${m.pinch.toFixed(2)} ext=[${m.extR.map((r) => r.toFixed(2)).join(' ')}]` : '—'} Hände={live?.hands ?? 0}
                {step.role === 'zoom' && live?.dPair != null ? ` Δ=${live.dPair.toFixed(1)}px` : ''}
                {step.role === 'fly' && live?.latE != null ? ` E=${live.latE.toFixed(0)}` : ''}
              </div>
              <div className="pp-actions" style={{ marginTop: 12 }}>
                <button onClick={() => setStepIdx(stepIdx + 1 < STEPS.length ? stepIdx + 1 : -2)}>Weiter</button>
                <button onClick={() => (stepIdx > 0 ? setStepIdx(stepIdx - 1) : setStepIdx(-1))}>Zurück</button>
              </div>
            </>
          )}
          {result && (
            <>
              <div className="tk" style={{ marginTop: 10, color: '#7dffb8' }}>✓ Gespeichert — aus deinen Händen gemessen:</div>
              <div className="tk" style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, marginTop: 4 }}>
                extK={result.extK.toFixed(2)} · pinchK={result.pinchK.toFixed(2)} · fistK={result.fistK.toFixed(2)}
                {' '}· prayer={result.prayerDist.toFixed(2)} · zoomK={result.zoomK.toFixed(2)} · fly={result.flyThresh.toFixed(0)}/{result.flyNorm.toFixed(0)}
              </div>
              <div className="tk" style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, marginTop: 6, opacity: .75, whiteSpace: 'pre-wrap' }}>
                {bands}
              </div>
              <div className="pp-actions" style={{ marginTop: 10 }}>
                <button onClick={() => setOpen(false)}>Fertig — testen!</button>
                <button onClick={() => {
                  setResult(null); samples.current = {};
                  extra.current = { nDist: [], zoomD: [], flyE: [] };
                  retried.current = {}; setStepIdx(0);
                }}>Erneut kalibrieren</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
