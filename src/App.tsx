// App-Root: 3D-Szene + HUD-Overlay. UI-Dichte via useUiMode (simple|advanced).
import { useEffect, useRef } from 'react';
import { NeuralScene } from './scene/NeuralScene';
import {
  TopBar,
  NavRail,
  CategoryLegend,
  NodeTooltip,
  NodeDetail,
  CommandPalette,
} from './hud/HudRoot';
import { PhonePanel } from './hud/PhonePanel';
import { Calibrate } from './hud/Calibrate';
import { TuningPanel } from './hud/TuningPanel';
import { MetricsPanel, ActivityFeed } from './hud/Panels';
import { AssistantPanel } from './hud/Assistant';
import { TimeSlider, RelatedPanel } from './hud/Features';
import { HandCursor, useHandControl } from './hud/HandCursor';
import { parseSystemCommand, useHand, startVoiceListener, stopVoiceListener } from './lib/handControl';
import { useSelection, useGraph, useUi } from './state/stores';
import { useUiMode, useTheme, applyTheme } from './state/theme';
import { startMetricsLoop } from './data/metrics';
import { css } from './hud/styles';

function RelatedBridge() {
  const setSelected = useSelection((s) => s.setSelected);
  return <RelatedPanel onFly={(id) => setSelected(id)} />;
}

export default function App() {
  const mode = useUiMode((s) => s.mode);
  const themeId = useTheme((s) => s.theme.id);

  // Gestensteuerung (?hands=1):
  //   Faust halten    → voxtype diktiert → ins aktive Fenster (System, via Relay)
  //   OK/Pinch halten → Voice-Navigation: Palette filtert live, Loslassen wählt
  //   Offene Hand     → Voice-Suche: Transkript als Suchbegriff
  // v5: Nachbar-Sprung ( Wischen) — Liste der Wikilink-Nachbarn der Auswahl,
  // durchblättern ohne Neu-Auswahl. Ohne Auswahl: stärksten Knoten nehmen.
  const navIdx = useRef(0);
  const neighborList = () => {
    const st = useGraph.getState();
    const g = st.graph;
    if (!g) return [];
    const sel = useSelection.getState().selected;
    if (!sel) {
      const top = [...g.nodes].sort((x, y) => (y.degree ?? 0) - (x.degree ?? 0))[0];
      return top ? [top.id] : [];
    }
    const ids = new Set<string>();
    for (const e of g.edges) {
      if (e.kind !== 'wikilink') continue;
      if (e.source === sel) ids.add(e.target);
      if (e.target === sel) ids.add(e.source);
    }
    return [...ids].sort((x, y) => {
      const by = Object.fromEntries(g.nodes.map((n) => [n.id, n.degree ?? 0]));
      return (by[y] ?? 0) - (by[x] ?? 0);
    });
  };

  // v6: Voice-Verarbeitung — von Phone-Mic (Listener) UND Gesten-Engine
  const processVoice = (text: string) => {
      const t = text.toLowerCase().trim();
      const ui = useUi.getState();
      const rest = (re: RegExp) => text.replace(re, '').trim();

      // „menü X" / „menu X" → Menü öffnen MIT X als Suchbegriff (bleibt offen)
      const menuM = t.match(/^(?:öffne\s+|open\s+)?(menü|menu)\s*(.*)/);
      if (menuM) {
        ui.setPalette(true);
        const q = menuM[2].trim();
        if (q) ui.setPaletteQuery(q);
        useHand.setState({ hint: q ? `🎙 Menü: "${q}"` : '🎙 Menü offen' });
        return;
      }
      // „schließen" / „close" → aktuelles schließen (Modal > Knoten)
      if (/^(schließen|schliessen|close|zu|mach zu)\b/.test(t)) {
        if (ui.paletteOpen) { ui.setPalette(false); return; }
        if (ui.tuningOpen) { ui.setTuning(false); return; }
        if (ui.phonePanelOpen) { ui.setPhonePanel(false); return; }
        const sel = useSelection.getState().selected;
        if (sel) { useSelection.getState().setSelected(null); return; }
        const st = useGraph.getState();
        if (st.drill) st.drillUp();
        return;
      }
      // „suche …" → Palette mit Rest als Suchbegriff
      if (/^(suche|search|find|finde)\b/.test(t)) {
        ui.setPalette(true);
        ui.setPaletteQuery(rest(/^(suche|search|find|finde)\s*/i));
        return;
      }
      // „librarian …" → Rest in Librarian-Input + absenden (oder nur fokus.)
      if (/^(librarian|hibemind|hivemind|brain)\b/.test(t)) {
        const q = rest(/^(librarian|hivemind|brain)\s*/i);
        window.dispatchEvent(new CustomEvent('hands-librarian',
          { detail: q || '__focus__' }));
        return;
      }
      // „notiz …" → direkt ins Brain einsammeln (Capture)
      if (/^(notiz|note|neue notiz)\b/.test(t)) {
        const body = rest(/^(notiz|note|neue notiz)\s*/i);
        if (body) fetch('/api/v1/capture-proxy', { method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: body, category: 'offen' }) }).catch(() => {});
        useHand.setState({ hint: '🎙 Notiz → Inbox' });
        return;
      }
      // „autopilot" / „flug" → Easter-Egg
      if (/^(autopilot|autoflug|flugmodus)\b/.test(t)) {
        ui.setAutopilot(!ui.autopilot);
        return;
      }
    // Alles andere: DIKTAT → fokussiertes Element + Zwischenablage
    navigator.clipboard?.writeText(text).catch(() => {});
    const ae = document.activeElement as HTMLElement | null;
    if (ae && (ae.tagName === 'TEXTAREA' || ae.tagName === 'INPUT')) {
      (ae as HTMLInputElement).setRangeText(
        text, (ae as any).selectionStart ?? (ae as any).value?.length ?? 0,
        (ae as any).selectionEnd ?? (ae as any).value?.length ?? 0, 'end');
      ae.dispatchEvent(new Event('input', { bubbles: true }));
      useHand.setState({ hint: '🎙 Diktat → Editor + Clipboard ✓' });
    } else {
      useHand.setState({ hint: '🎙 Diktat → Zwischenablage ✓ (Editor fokussieren zum Einfügen)' });
    }
  };

  // IMMER aktiver Voice-Listener — funktioniert auch ohne laufende Gesten
  useEffect(() => {
    startVoiceListener(processVoice);
    return () => stopVoiceListener();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useHandControl({
    onVoice: processVoice,
    // v5: Wischen → Nachbar-Sprung
    onSwipe: (dir) => {
      const list = neighborList();
      if (list.length < 2) {
        if (list.length === 1) useSelection.getState().setSelected(list[0]);
        return;
      }
      const sel = useSelection.getState().selected;
      let i = list.indexOf(sel ?? '');
      i = i < 0 ? 0 : Math.min(list.length - 1, Math.max(0, i + dir));
      navIdx.current = i;
      useSelection.getState().setSelected(list[i]);
    },
    // v4: 🤏 OK schließt das oberste Modal (Menü > Panel > Detail > Auswahl)
    onCloseModal: () => {
      const ui = useUi.getState();
      if (ui.paletteOpen) { ui.setPalette(false); return; }
      if (ui.tuningOpen) { ui.setTuning(false); return; }
      if (ui.phonePanelOpen) { ui.setPhonePanel(false); return; }
      const sel = useSelection.getState().selected;
      if (sel) { useSelection.getState().setSelected(null); return; }
      const st = useGraph.getState();
      if (st.drill) st.drillUp();
    },
    // v4: ✊ Faust hält das Menü (Palette) offen
    onMenuHold: (open) => useUi.getState().setPalette(open),
    onNavStart: () => {
      useUi.getState().setPalette(true);
    },
    onNavInterim: (text) => {
      useUi.getState().setPaletteQuery(text);
    },
    onNavEnd: (finalText) => {
      // 1) System-Kommando? („öffne terminal", „nächstes Fenster", …)
      const sys = parseSystemCommand(finalText);
      if (sys) {
        (window as any).__omaSend?.(sys.oma);
        useHand.setState({ hint: sys.label });
        useUi.getState().setPalette(false);
        return;
      }
      // 2) Sonst: markierten Knoten der Palette übernehmen
      const sel = document.querySelector('.palette .presults button.sel') as HTMLElement | null;
      const nodeId = sel?.getAttribute('data-node-id');
      if (nodeId) useSelection.getState().setSelected(nodeId);
      useUi.getState().setPalette(false);
      // 3) Text mit Frage-Charakter (😊/?) → an den Librarian (Hivemind)
      if (/\?|\bwas\b|\bwie\b|\bwarum\b|\bwer\b|\bwann\b|\bwo\b/i.test(finalText) && finalText.length > 3) {
        window.dispatchEvent(new CustomEvent('hands-librarian', { detail: finalText }));
      }
    },
    onVoiceSearch: (transcript) => {
      useUi.getState().setPalette(true);
      useUi.getState().setPaletteQuery(transcript);
    },
  });

  useEffect(() => {
    startMetricsLoop();
    applyTheme(useTheme.getState().theme);
  }, []);
  // S8: Live-Aktualisierung — Indexer pushst 'graph-updated' via SSE,
  // EventSource reconnectet selbst; Quelle wird neu geladen (Auswahl bleibt id-basiert).
  useEffect(() => {
    let es: EventSource | null = null;
    try {
      es = new EventSource('/api/v1/events');
      es.addEventListener('graph-updated', () => useGraph.getState().refresh());
    } catch { /* kein SSE (z. B. Demo-Modus) — still weiter ohne Live-Push */ }
    return () => es?.close();
  }, []);
  useEffect(() => {
    applyTheme(useTheme.getState().theme);
  }, [themeId]);

  // K: Taste C = Hände kalibrieren (nicht während des Tippens)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 'c') return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      useUi.getState().setCalib(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Deep-Link: #node/<id> selektiert beim Laden, Selektion aktualisiert den Hash
  useEffect(() => {
    // S7b: Esc-Kette — erst Drill-down eine Ebene hoch, dann Auswahl lösen
    const esc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const st = useGraph.getState();
      if (st.drill) st.drillUp();
      else useSelection.getState().setSelected(null);
    };
    window.addEventListener('keydown', esc);
    const fromHash = () => {
      const m = location.hash.match(/^#node\/(.+)$/);
      if (m) useSelection.getState().setSelected(decodeURIComponent(m[1]));
    };
    fromHash();
    window.addEventListener('hashchange', fromHash);
    const unsub = useSelection.subscribe((s) => {
      if (s.selected && useUi.getState().autopilot) useUi.getState().setAutopilot(false);
      const next = s.selected ? `#node/${encodeURIComponent(s.selected)}` : ' ';
      if (location.hash !== next) history.replaceState(null, '', next);
    });
    return () => {
      window.removeEventListener('keydown', esc);
      window.removeEventListener('hashchange', fromHash);
      unsub();
    };
  }, []);

  const advanced = mode === 'advanced';

  return (
    <>
      <style>{css}</style>
      <div className="scene-root">
        <NeuralScene />
      </div>

      <TopBar />
      {advanced && <NavRail />}

      {advanced && (
        <div className="hud-right">
          <MetricsPanel />
          <ActivityFeed />
        </div>
      )}
      {advanced && <AssistantPanel />}
      {advanced && <TimeSlider onCutoff={(d) => window.dispatchEvent(new CustomEvent('weave-cutoff', { detail: d }))} />}
      {advanced && <RelatedBridge />}

      <CategoryLegend />
      <NodeTooltip />
      <NodeDetail />
      <CommandPalette />
      <PhonePanel />
      <Calibrate />
      <TuningPanel />
      <HandCursor />

      <div className="scanlines" />
    </>
  );
}
