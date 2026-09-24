// Theme- + Tuning- + UI-Mode-Stores. Alles in localStorage persistiert.
import { create } from 'zustand';
import type { ThemeDef, Tuning } from '../theme/types';
import { DEFAULT_TUNING } from '../theme/types';
import { THEMES, DEFAULT_THEME_ID, getTheme } from '../theme/registry';

export type { ThemeDef } from '../theme/types';
export { THEMES } from '../theme/registry';

/* ============ Theme ============ */
// S14: festes Styling — genau EIN Theme (cosmos), keine Auswahl mehr.
// Alte weave-theme-Schlüssel werden einmalig entsorgt.
interface ThemeState {
  theme: ThemeDef;
  setTheme: (id: string) => void;
}

try {
  localStorage.removeItem('weave-theme');
} catch {}

export const useTheme = create<ThemeState>((set) => ({
  theme: getTheme(DEFAULT_THEME_ID),
  setTheme: () => { /* fixes Styling — kein Theme-Wechsel mehr */ },
}));

/* ============ Tuning (Live-Regler) ============ */
interface TuningState {
  /** Nur die vom Nutzer geaenderten Felder — gilt themen-uebergreifend. */
  overrides: Partial<Tuning>;
  set: (patch: Partial<Tuning>) => void;
  reset: () => void;
}

function loadOverrides(): Partial<Tuning> {
  try {
    const o = JSON.parse(localStorage.getItem('weave-tuning') || '{}');
    // S13-Migration: layout:'sphere' im Speicher war fast immer der frühere
    // DEFAULT, keine aktive Wahl — einmalig verwerfen, damit das neue
    // Universum-Layout greift. Nach dem ersten aktiven Umschalten gilt
    // die Nutzerwahl wieder unverändert.
    if (o.layout === 'sphere' && o.__sphereWasChoice !== true) {
      delete o.layout;
    }
    return o;
  } catch {
    return {};
  }
}

export const useTuningStore = create<TuningState>((set) => ({
  overrides: loadOverrides(),
  set: (patch) =>
    set((s) => {
      const overrides = { ...s.overrides, ...patch };
      try {
        localStorage.setItem('weave-tuning', JSON.stringify(overrides));
      } catch {}
      return { overrides };
    }),
  reset: () => {
    try {
      localStorage.removeItem('weave-tuning');
    } catch {}
    set({ overrides: {} });
  },
}));

/** Effektives Tuning = Default <- Theme-Default <- Nutzer-Override. */
export function resolveTuning(theme: ThemeDef, overrides: Partial<Tuning>): Tuning {
  return { ...DEFAULT_TUNING, ...theme.tuning, ...overrides };
}

/** Hook: reaktives, aufgeloestes Tuning. */
export function useTuning(): Tuning {
  const theme = useTheme((s) => s.theme);
  const overrides = useTuningStore((s) => s.overrides);
  return resolveTuning(theme, overrides);
}

/** Non-Hook Zugriff (fuer useFrame / imperatives). */
export function currentTuning(): Tuning {
  return resolveTuning(useTheme.getState().theme, useTuningStore.getState().overrides);
}

/* ============ UI-Mode ============ */
type Mode = 'simple' | 'advanced';
interface UiModeState {
  mode: Mode;
  setMode: (m: Mode) => void;
  toggle: () => void;
}

function loadMode(): Mode {
  try {
    return (localStorage.getItem('weave-mode') as Mode) || 'simple';
  } catch {
    return 'simple';
  }
}

export const useUiMode = create<UiModeState>((set) => ({
  mode: loadMode(),
  setMode: (mode) => {
    try {
      localStorage.setItem('weave-mode', mode);
    } catch {}
    set({ mode });
  },
  toggle: () =>
    set((s) => {
      const mode: Mode = s.mode === 'simple' ? 'advanced' : 'simple';
      try {
        localStorage.setItem('weave-mode', mode);
      } catch {}
      return { mode };
    }),
}));

/* ============ CSS-Variablen ============ */
export function applyTheme(t: ThemeDef) {
  document.body.dataset.theme = t.id;
  document.body.dataset.themeKind = t.kind;
  const r = document.documentElement.style;
  const p = t.palette;
  r.setProperty('--accent', p.accent);
  r.setProperty('--accent-2', p.accent2);
  r.setProperty('--accent-soft', p.soft);
  r.setProperty('--bg', p.bg);
  r.setProperty('--panel', p.panel);
  r.setProperty('--line', p.line);
  r.setProperty('--text', p.text);
  r.setProperty('--dim', p.dim);
  r.setProperty('--muted', p.muted);
  r.setProperty('--ring', p.ring);
  r.setProperty('--sphere-shell', p.shell);
  r.setProperty('--sphere-dust', p.dust);
  r.setProperty('--cat-core', t.categories.core);
  r.setProperty('--cat-knowledge', t.categories.knowledge);
  r.setProperty('--cat-logic', t.categories.logic);
  r.setProperty('--cat-data', t.categories.data);
  r.setProperty('--cat-neutral', t.categories.neutral);
  r.setProperty('--font-display', t.fonts?.display ?? 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif');
  r.setProperty('--font-mono', t.fonts?.mono ?? 'ui-monospace, "SF Mono", "Cascadia Mono", monospace');
}

/** Alle Theme-Ids (fuer Screenshot-Scripts etc.). */
export const THEME_IDS = THEMES.map((t) => t.id);
