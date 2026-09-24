// Theme-Registry — S14: GENAU EIN fixes Styling („cosmos"). Die Theme-Wahl
// wurde entfernt (Entscheidung 2026-09-10); getTheme/DEFAULT bleiben
// als API für Shots/Tests erhalten.
import type { ThemeDef } from './types';
import { cosmos } from './themes/cosmos';

export const THEMES: ThemeDef[] = [cosmos];

export const DEFAULT_THEME_ID = 'cosmos';

export function getTheme(id: string): ThemeDef {
  // id wird ignoriert — es gibt nur cosmos
  return THEMES[0];
}
