// Fusion des dictées 6e (générées depuis les ODT) et 5e (progression de la collègue)

import { DICTEES_DATA, type DicteeData } from './dictees-data';
import { DICTEES_5E_DATA } from './dictees-5e-data';

export type DicteeLevel = '6e' | '5e';

export interface AppDictee extends DicteeData {
  level: DicteeLevel;
  orthoPoint?: string;
  lexicalTheme?: string;
  starWord?: string;
}

export const LEVELS: DicteeLevel[] = ['6e', '5e'];

export const ALL_DICTEES: AppDictee[] = [
  ...DICTEES_DATA.map(d => ({ ...d, level: '6e' as const })),
  ...DICTEES_5E_DATA,
];
