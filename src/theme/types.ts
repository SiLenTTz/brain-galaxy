// Theme-System v2 — modular & erweiterbar.
// Ein neues Theme = eine Datei in src/theme/themes/ + ein Eintrag in registry.ts.
import type { Category } from '../data/types';

/** Was in der Mitte der Sphaere schwebt — Startpunkt / Blickfang. */
export type Centerpiece =
  | {
      /** Bewegtes Irrlicht / Flamme / Orb — fuer Themes ohne Branding. */
      kind: 'wisp';
      form: 'wisp' | 'flame' | 'orb';
      colorA: string;
      colorB: string;
    }
  | {
      /** Stilisierte 3D-Gestalt (eigenstaendige Silhouette, kein IP-Nachbau). */
      kind: 'figure';
      form: 'demon' | 'queen';
      glow: string;
      accent: string;
      /** Optional: Pfad zu eigenem .glb (ueberschreibt die prozedurale Form). */
      modelUrl?: string;
      /** 'silhouette' (dunkel + Randglut, Standard) oder 'lit' (Material sichtbar). */
      modelStyle?: 'silhouette' | 'lit';
      /** Zielhoehe in Szenen-Einheiten (Default 3.2). */
      modelHeight?: number;
      /** Vertikale Position (Default -1.4). */
      modelY?: number;
    };

export interface ThemeBackground {
  /** Vertikaler Himmel-Gradient (0..1 -> css color). */
  gradient: Array<[number, string]>;
  /** Radiale Wolken-Blobs (rgba empfohlen). */
  blobs: string[];
  blobOpacity: number;
  /** Fallende Partikel (Asche/Staub/Regen). null = keine. */
  particles: null | { count: number; color: string; size: number; drift: number };
  /** Sternenfeld sichtbar? */
  stars: boolean;
}

export interface ThemePalette {
  accent: string;
  accent2: string;
  soft: string;
  /** Fresnel-Rim der Glashuelle. */
  shell: string;
  /** Staub im Kugelinneren. */
  dust: string;
  /** Status / Gauge / "ok". */
  ring: string;
  /** Canvas-Hintergrundfarbe (Fallback). */
  bg: string;
  /** Fog-Farbe. */
  fog: string;
  panel: string;
  line: string;
  text: string;
  dim: string;
  muted: string;
}

/** Vom Nutzer live justierbar (Tuning-Panel). Pro Theme vorbelegt. */
export interface Tuning {
  layout: 'sphere' | 'force' | 'universe';
  /** Multiplikator Satelliten-Groesse. */
  nodeScale: number;
  /** Multiplikator Hub-Groesse. */
  hubScale: number;
  /** Kanten-Dicke (relativ). */
  edgeWidth: number;
  /** Kanten-Deckkraft. */
  edgeOpacity: number;
  /** Kanten (Verbindungen) ueberhaupt anzeigen. */
  showEdges: boolean;
  /** Ordner-Kanten anzeigen (sonst nur Wikilinks). */
  showFolderEdges: boolean;
  /** Bloom / Glow-Staerke. */
  glow: number;
  /** Wie viele Labels dauerhaft sichtbar. */
  labels: 'none' | 'hubs' | 'all';
  /** S13/A3: nur Knoten mit Grad ≥ N zeigen (Hubs/Ordner bleiben sichtbar). */
  minDegree: number;
  /** Idle-Bewegung / Animations-Amplitude 0..1. */
  motion: number;
  /** Zentrums-Avatar (Figur/Irrlicht) anzeigen. */
  avatar: boolean;
  /** Groessen-Multiplikator fuer den Avatar. */
  avatarScale: number;
  /** Desktop-Hintergrund durchschimmern lassen, 0 = aus .. ~0.35. */
  wallpaper: number;
}

export interface ThemeDef {
  id: string;
  name: string;
  /** 'branded' -> Figur in der Mitte + Wortmarke; 'ambient' -> Wisp, kein Branding. */
  kind: 'branded' | 'ambient';
  /** Wortmarke oben links. Bei 'ambient' leer -> generisch. */
  wordmark?: string;
  centerpiece: Centerpiece;
  palette: ThemePalette;
  categories: Record<Category, string>;
  background: ThemeBackground;
  /** Theme-spezifische Tuning-Defaults (mergt ueber die globalen Defaults). */
  tuning: Partial<Tuning>;
  fonts?: { display: string; mono: string };
}

export const DEFAULT_TUNING: Tuning = {
  layout: 'universe',
  nodeScale: 1,
  hubScale: 1,
  edgeWidth: 1,
  edgeOpacity: 1,
  showEdges: true,
  showFolderEdges: false,
  glow: 1,
  labels: 'hubs',
  minDegree: 0,
  motion: 1,
  avatar: true,
  avatarScale: 1,
  wallpaper: 0,
};
