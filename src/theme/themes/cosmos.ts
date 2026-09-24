import type { ThemeDef } from '../types';

// COSMOS — das EINE feste Styling (S14, 2026-09-10: „Themes raus, fixes
// Styling"). Basiert auf Universe, aber heller & goldlastiger (Cosmic-Web-
// Vorbild): leuchtende Knoten, kühle Filamente, dunkle Voids, Nebel-Hauch.
export const cosmos: ThemeDef = {
  id: 'cosmos',
  name: 'Cosmos',
  kind: 'ambient',
  centerpiece: { kind: 'wisp', form: 'orb', colorA: '#ffd9a0', colorB: '#7fd4ff' },
  palette: {
    accent: '#ffcf8f',
    accent2: '#6fe0ff',
    soft: '#e8d9ff',
    shell: '#8f6fff',
    dust: '#cabfe8',
    ring: '#7dffb8',
    bg: '#050614',
    fog: '#090b1c',
    panel: 'rgba(14,13,32,0.6)',
    line: 'rgba(170,150,255,0.22)',
    text: '#f4efff',
    dim: '#c2b8e0',
    muted: '#8d84ad',
  },
  categories: {
    core: '#ffd98c',
    knowledge: '#8fd4ff',
    logic: '#ff8fc4',
    data: '#7cf0d8',
    neutral: '#a894ff',
  },
  background: {
    gradient: [
      [0, '#0d0824'],
      [0.5, '#080618'],
      [1, '#020310'],
    ],
    blobs: ['rgba(140,90,220,0.42)', 'rgba(70,110,220,0.34)', 'rgba(230,150,90,0.20)'],
    blobOpacity: 0.5,
    particles: { count: 160, color: '#d8caff', size: 0.22, drift: -2 },
    stars: true,
  },
  // heller als Universe: Glow-Reward für „mehr Glow für die Sterne"
  tuning: { glow: 1.4, motion: 1, edgeOpacity: 1.15 },
};
