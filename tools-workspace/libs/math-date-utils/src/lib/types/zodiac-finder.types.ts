import type { FormControl, FormGroup } from '@angular/forms';

export type ZodiacElement = 'Fire' | 'Earth' | 'Air' | 'Water';
export type ZodiacModality = 'Cardinal' | 'Fixed' | 'Mutable';

export interface ZodiacSign {
  name: string;
  symbol: string;
  start: { month: number; day: number };
  end: { month: number; day: number };
  element: ZodiacElement;
  modality: ZodiacModality;
  rulingPlanet: string;
  keywords: string[];
  compatibility: { best: string[]; complementary: string[]; growth: string[] };
  shadowTraits: string[];
  affirmations: string[];
}

export interface ChineseZodiacMeta {
  animal: string;
  keywords: string[];
  years: string;
}

export interface ZodiacResult {
  sunSign: ZodiacSign;
  cuspLabel: string | null;
  cuspWith?: ZodiacSign;
  birthDate: string;
  dayOfWeek: string;
  chineseAnimal: ChineseZodiacMeta;
  lifePathNumber: number;
  numerologyKeywords: string[];
  birthstone: string;
  luckyColors: string[];
  season: string;
  lunarPhase: string;
  bestMatch: string;
  growthMatch: string;
  summary: string[];
}

export interface ZodiacHistoryEntry {
  birthDate: string;
  sunSign: string;
  chineseAnimal: string;
  recordedAt: number;
}

export type ZodiacFormGroup = FormGroup<{
  birthDate: FormControl<string>;
  birthTime: FormControl<string | null>;
  timezone: FormControl<string>;
  includeHistory: FormControl<boolean>;
}>;

export interface ZodiacFormValues {
  birthDate: string;
  birthTime: string | null;
  timezone: string;
  includeHistory: boolean;
}

export interface ZodiacSummaryCard {
  title: string;
  value: string;
  footnote?: string;
}

export interface ZodiacCompatibilityCard {
  heading: string;
  description: string;
}

export interface ZodiacCuspInfo {
  label: string | null;
  with?: ZodiacSign;
}

export type ZodiacDatePreset = 'today' | 'yesterday' | 'newYear';

export interface ZodiacSuggestionContext {
  hasResult: boolean;
  hasError: boolean;
  hasCusp: boolean;
  lifePathNumber: number | null;
  sunSignName: string | null;
  birthDate: string;
}
