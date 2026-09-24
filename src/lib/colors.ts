// Kategorie-Farben: dynamisch aus dem aktiven Theme (theme.ts)
import type { Category } from '../data/types';
import { useTheme } from '../state/theme';

export function categoryColor(cat: Category): string {
  return useTheme.getState().theme.categories[cat] ?? '#8fa3c4';
}

export const CATEGORY_LABELS: Record<Category, string> = {
  core: 'Core',
  knowledge: 'Knowledge',
  logic: 'Logic',
  data: 'Data',
  neutral: 'Shell / Sub',
};
