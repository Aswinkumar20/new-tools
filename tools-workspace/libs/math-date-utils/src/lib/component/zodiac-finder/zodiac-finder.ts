import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, WritableSignal, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime } from 'rxjs';
import { Navigation } from '@tools-workspace/features-home';

interface ZodiacSign {
  name: string;
  symbol: string;
  start: { month: number; day: number };
  end: { month: number; day: number };
  element: 'Fire' | 'Earth' | 'Air' | 'Water';
  modality: 'Cardinal' | 'Fixed' | 'Mutable';
  rulingPlanet: string;
  keywords: string[];
  compatibility: { best: string[]; complementary: string[]; growth: string[] };
  shadowTraits: string[];
  affirmations: string[];
}

interface ChineseZodiacMeta {
  animal: string;
  keywords: string[];
  years: string;
}

interface ZodiacResult {
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

interface HistoryEntry {
  birthDate: string;
  sunSign: string;
  chineseAnimal: string;
  recordedAt: number;
}

type ZodiacFormGroup = FormGroup<{
  birthDate: FormControl<string>;
  birthTime: FormControl<string | null>;
  timezone: FormControl<string>;
  includeHistory: FormControl<boolean>;
}>;

const DEFAULT_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC';
const DEFAULT_LOCALE = navigator.language || 'en-US';
const DEFAULT_DATE = new Date();

const TIMEZONES = [
  DEFAULT_TZ,
  'UTC',
  'America/New_York',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
  'Asia/Kolkata',
  'Asia/Tokyo',
  'Australia/Sydney'
];

const ZODIAC_SIGNS: ZodiacSign[] = [
  {
    name: 'Aries',
  symbol: '♈',
  start: { month: 3, day: 21 },
  end: { month: 4, day: 19 },
  element: 'Fire',
  modality: 'Cardinal',
  rulingPlanet: 'Mars',
  keywords: ['Energetic', 'Pioneering', 'Confident'],
  compatibility: { best: ['Leo', 'Sagittarius', 'Gemini'], complementary: ['Aquarius', 'Libra'], growth: ['Cancer', 'Capricorn'] },
  shadowTraits: ['Impulsive', 'Impatient', 'Combative'],
  affirmations: ['I lead with courage.', 'My enthusiasm inspires others.']
  },
  {
    name: 'Taurus',
  symbol: '♉',
  start: { month: 4, day: 20 },
  end: { month: 5, day: 20 },
  element: 'Earth',
  modality: 'Fixed',
  rulingPlanet: 'Venus',
  keywords: ['Grounded', 'Persistent', 'Sensual'],
  compatibility: { best: ['Virgo', 'Capricorn', 'Cancer'], complementary: ['Pisces', 'Scorpio'], growth: ['Leo', 'Aquarius'] },
  shadowTraits: ['Stubborn', 'Possessive', 'Comfort-seeking'],
  affirmations: ['I trust the timing of growth.', 'Security flows from within.']
  },
  {
    name: 'Gemini',
  symbol: '♊',
  start: { month: 5, day: 21 },
  end: { month: 6, day: 20 },
  element: 'Air',
  modality: 'Mutable',
  rulingPlanet: 'Mercury',
  keywords: ['Curious', 'Adaptable', 'Expressive'],
  compatibility: { best: ['Libra', 'Aquarius', 'Aries'], complementary: ['Leo', 'Sagittarius'], growth: ['Virgo', 'Pisces'] },
  shadowTraits: ['Restless', 'Superficial', 'Scattered'],
  affirmations: ['My curiosity opens doors.', 'I communicate with clarity and kindness.']
  },
  {
    name: 'Cancer',
  symbol: '♋',
  start: { month: 6, day: 21 },
  end: { month: 7, day: 22 },
  element: 'Water',
  modality: 'Cardinal',
  rulingPlanet: 'Moon',
  keywords: ['Nurturing', 'Intuitive', 'Protective'],
  compatibility: { best: ['Scorpio', 'Pisces', 'Taurus'], complementary: ['Virgo', 'Capricorn'], growth: ['Aries', 'Libra'] },
  shadowTraits: ['Moody', 'Guarded', 'Overly sentimental'],
  affirmations: ['My sensitivity is strength.', 'I create safe spaces for myself and others.']
  },
  {
    name: 'Leo',
  symbol: '♌',
  start: { month: 7, day: 23 },
  end: { month: 8, day: 22 },
  element: 'Fire',
  modality: 'Fixed',
  rulingPlanet: 'Sun',
  keywords: ['Radiant', 'Generous', 'Bold'],
  compatibility: { best: ['Aries', 'Sagittarius', 'Gemini'], complementary: ['Libra', 'Aquarius'], growth: ['Taurus', 'Scorpio'] },
  shadowTraits: ['Ego-driven', 'Dramatic', 'Dominating'],
  affirmations: ['I shine without dimming others.', 'My heart leads with warmth.']
  },
  {
    name: 'Virgo',
  symbol: '♍',
  start: { month: 8, day: 23 },
  end: { month: 9, day: 22 },
  element: 'Earth',
  modality: 'Mutable',
  rulingPlanet: 'Mercury',
  keywords: ['Analytical', 'Supportive', 'Meticulous'],
  compatibility: { best: ['Taurus', 'Capricorn', 'Cancer'], complementary: ['Scorpio', 'Pisces'], growth: ['Gemini', 'Sagittarius'] },
  shadowTraits: ['Self-critical', 'Overthinking', 'Perfectionist'],
  affirmations: ['Progress over perfection.', 'My discernment is a gift.']
  },
  {
    name: 'Libra',
  symbol: '♎',
  start: { month: 9, day: 23 },
  end: { month: 10, day: 22 },
  element: 'Air',
  modality: 'Cardinal',
  rulingPlanet: 'Venus',
  keywords: ['Diplomatic', 'Artistic', 'Harmonious'],
  compatibility: { best: ['Gemini', 'Aquarius', 'Leo'], complementary: ['Sagittarius', 'Aries'], growth: ['Cancer', 'Capricorn'] },
  shadowTraits: ['Indecisive', 'People-pleasing', 'Avoids conflict'],
  affirmations: ['Balance begins within.', 'I honor my voice in every choice.']
  },
  {
    name: 'Scorpio',
  symbol: '♏',
  start: { month: 10, day: 23 },
  end: { month: 11, day: 21 },
  element: 'Water',
  modality: 'Fixed',
  rulingPlanet: 'Pluto & Mars',
  keywords: ['Transformative', 'Intense', 'Loyal'],
  compatibility: { best: ['Cancer', 'Pisces', 'Virgo'], complementary: ['Capricorn', 'Taurus'], growth: ['Leo', 'Aquarius'] },
  shadowTraits: ['Possessive', 'Secretive', 'Vengeful'],
  affirmations: ['I embrace transformation.', 'My depth is my power.']
  },
  {
    name: 'Sagittarius',
  symbol: '♐',
  start: { month: 11, day: 22 },
  end: { month: 12, day: 21 },
  element: 'Fire',
  modality: 'Mutable',
  rulingPlanet: 'Jupiter',
  keywords: ['Adventurous', 'Optimistic', 'Philosophical'],
  compatibility: { best: ['Aries', 'Leo', 'Aquarius'], complementary: ['Libra', 'Gemini'], growth: ['Virgo', 'Pisces'] },
  shadowTraits: ['Blunt', 'Restless', 'Commitment-shy'],
  affirmations: ['My curiosity is guided by wisdom.', 'Freedom and responsibility coexist.']
  },
  {
    name: 'Capricorn',
  symbol: '♑',
  start: { month: 12, day: 22 },
  end: { month: 1, day: 19 },
  element: 'Earth',
  modality: 'Cardinal',
  rulingPlanet: 'Saturn',
  keywords: ['Strategic', 'Resilient', 'Ambitious'],
  compatibility: { best: ['Taurus', 'Virgo', 'Scorpio'], complementary: ['Pisces', 'Cancer'], growth: ['Aries', 'Libra'] },
  shadowTraits: ['Reserved', 'Work-obsessed', 'Rigid'],
  affirmations: ['I build success step by step.', 'Structure supports my vision.']
  },
  {
    name: 'Aquarius',
  symbol: '♒',
  start: { month: 1, day: 20 },
  end: { month: 2, day: 18 },
  element: 'Air',
  modality: 'Fixed',
  rulingPlanet: 'Uranus & Saturn',
  keywords: ['Visionary', 'Independent', 'Humanitarian'],
  compatibility: { best: ['Gemini', 'Libra', 'Sagittarius'], complementary: ['Aries', 'Leo'], growth: ['Taurus', 'Scorpio'] },
  shadowTraits: ['Detached', 'Contrarian', 'Unpredictable'],
  affirmations: ['I innovate with heart.', 'Community thrives through my authenticity.']
  },
  {
    name: 'Pisces',
  symbol: '♓',
  start: { month: 2, day: 19 },
  end: { month: 3, day: 20 },
  element: 'Water',
  modality: 'Mutable',
  rulingPlanet: 'Neptune & Jupiter',
  keywords: ['Empathic', 'Imaginative', 'Fluid'],
  compatibility: { best: ['Cancer', 'Scorpio', 'Capricorn'], complementary: ['Taurus', 'Virgo'], growth: ['Gemini', 'Sagittarius'] },
  shadowTraits: ['Escapist', 'Overly trusting', 'Indecisive'],
  affirmations: ['My intuition is a compass.', 'Boundaries nurture my creativity.']
  }
];

const CHINESE_ZODIAC: ChineseZodiacMeta[] = [
  { animal: 'Rat', keywords: ['Strategic', 'Quick-witted', 'Resourceful'], years: '…1924, 1936, 1948, 1960, 1972, 1984, 1996, 2008, 2020' },
  { animal: 'Ox', keywords: ['Dependable', 'Patient', 'Strong'], years: '…1925, 1937, 1949, 1961, 1973, 1985, 1997, 2009, 2021' },
  { animal: 'Tiger', keywords: ['Courageous', 'Charismatic', 'Driven'], years: '…1926, 1938, 1950, 1962, 1974, 1986, 1998, 2010, 2022' },
  { animal: 'Rabbit', keywords: ['Gentle', 'Diplomatic', 'Creative'], years: '…1927, 1939, 1951, 1963, 1975, 1987, 1999, 2011, 2023' },
  { animal: 'Dragon', keywords: ['Magnetic', 'Ambitious', 'Trailblazer'], years: '…1928, 1940, 1952, 1964, 1976, 1988, 2000, 2012, 2024' },
  { animal: 'Snake', keywords: ['Wise', 'Elegant', 'Intuitive'], years: '…1929, 1941, 1953, 1965, 1977, 1989, 2001, 2013, 2025' },
  { animal: 'Horse', keywords: ['Adventurous', 'Energetic', 'Freedom-loving'], years: '…1930, 1942, 1954, 1966, 1978, 1990, 2002, 2014, 2026' },
  { animal: 'Goat', keywords: ['Artistic', 'Compassionate', 'Steady'], years: '…1931, 1943, 1955, 1967, 1979, 1991, 2003, 2015, 2027' },
  { animal: 'Monkey', keywords: ['Inventive', 'Playful', 'Clever'], years: '…1932, 1944, 1956, 1968, 1980, 1992, 2004, 2016, 2028' },
  { animal: 'Rooster', keywords: ['Vibrant', 'Observant', 'Earnest'], years: '…1933, 1945, 1957, 1969, 1981, 1993, 2005, 2017, 2029' },
  { animal: 'Dog', keywords: ['Loyal', 'Protective', 'Principled'], years: '…1934, 1946, 1958, 1970, 1982, 1994, 2006, 2018, 2030' },
  { animal: 'Pig', keywords: ['Generous', 'Optimistic', 'Supportive'], years: '…1935, 1947, 1959, 1971, 1983, 1995, 2007, 2019, 2031' }
];

const BIRTHSTONES: Record<string, string> = {
  January: 'Garnet',
  February: 'Amethyst',
  March: 'Aquamarine',
  April: 'Diamond',
  May: 'Emerald',
  June: 'Pearl or Moonstone',
  July: 'Ruby',
  August: 'Peridot',
  September: 'Sapphire',
  October: 'Opal',
  November: 'Topaz',
  December: 'Turquoise'
};

const LUCKY_COLORS: Record<string, string[]> = {
  Aries: ['Scarlet', 'Cobalt', 'Sunrise orange'],
  Taurus: ['Forest green', 'Rose pink', 'Earth brown'],
  Gemini: ['Yellow', 'Silver', 'Azure'],
  Cancer: ['Seafoam', 'Ivory', 'Moonlight silver'],
  Leo: ['Gold', 'Sunset orange', 'Royal purple'],
  Virgo: ['Olive', 'Warm beige', 'Soft grey'],
  Libra: ['Blush', 'Sky blue', 'Lavender'],
  Scorpio: ['Deep burgundy', 'Black', 'Midnight blue'],
  Sagittarius: ['Indigo', 'Teal', 'Plum'],
  Capricorn: ['Charcoal', 'Forest green', 'Navy'],
  Aquarius: ['Electric blue', 'Silver', 'Aquamarine'],
  Pisces: ['Sea green', 'Lilac', 'Mystic teal']
};

const NUMEROLOGY_KEYWORDS: Record<number, string[]> = {
  1: ['Leadership', 'Innovation', 'Courage'],
  2: ['Harmony', 'Diplomacy', 'Empathy'],
  3: ['Creativity', 'Expression', 'Optimism'],
  4: ['Stability', 'Structure', 'Discipline'],
  5: ['Freedom', 'Adventure', 'Adaptability'],
  6: ['Nurturing', 'Responsibility', 'Heart-centered'],
  7: ['Intuition', 'Analysis', 'Spiritual insight'],
  8: ['Ambition', 'Manifestation', 'Authority'],
  9: ['Humanitarian', 'Wisdom', 'Compassion']
};
@Component({
  selector: 'lib-zodiac-finder',
  standalone: true,
  templateUrl: './zodiac-finder.html',
  styleUrls: ['./zodiac-finder.scss'],
  imports: [CommonModule, ReactiveFormsModule, Navigation],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ZodiacFinderComponent {
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  readonly timezones = TIMEZONES;
  readonly signs = ZODIAC_SIGNS;

  readonly form: ZodiacFormGroup = this.fb.group({
    birthDate: this.fb.control(formatDateInput(DEFAULT_DATE), { validators: [Validators.required, isoDateValidator], nonNullable: true }),
    birthTime: this.fb.control<string | null>(null),
    timezone: this.fb.control(DEFAULT_TZ, { nonNullable: true, validators: [Validators.required] }),
    includeHistory: this.fb.control(true, { nonNullable: true })
  });

  readonly result: WritableSignal<ZodiacResult | null> = signal(null);
  readonly history: WritableSignal<HistoryEntry[]> = signal([]);

  readonly hasHistory = computed(() => this.history().length > 0);
  readonly summaryCards = computed(() => buildSummaryCards(this.result()));
  readonly compatibilityCards = computed(() => buildCompatibilityCards(this.result()));

  constructor() {
    this.form.valueChanges
      .pipe(debounceTime(120), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.calculate());

    this.calculate();
  }

  preset(date: 'today' | 'yesterday' | 'newYear'): void {
    const base = new Date();
    switch (date) {
      case 'today':
        this.form.patchValue({ birthDate: formatDateInput(base) });
        break;
      case 'yesterday':
        this.form.patchValue({ birthDate: formatDateInput(addDays(base, -1)) });
        break;
      case 'newYear':
        this.form.patchValue({ birthDate: `${base.getFullYear()}-01-01` });
        break;
    }
  }

  randomize(): void {
    const year = 1960 + Math.floor(Math.random() * 60);
    const month = Math.floor(Math.random() * 12);
    const day = 1 + Math.floor(Math.random() * 28);
    const date = new Date(year, month, day);
    this.form.patchValue({ birthDate: formatDateInput(date) });
  }

  applyHistory(entry: HistoryEntry): void {
    this.form.patchValue({ birthDate: entry.birthDate });
  }

  clearHistory(): void {
    this.history.set([]);
  }

  private calculate(): void {
    if (this.form.invalid) {
      this.result.set(null);
      return;
    }

    const { birthDate, birthTime, timezone, includeHistory } = this.form.getRawValue();
    if (!birthDate || !timezone) {
      this.result.set(null);
      return;
    }

    const calculation = computeZodiac(birthDate, birthTime ?? undefined, timezone);
    this.result.set(calculation);

    if (includeHistory && calculation) {
      this.history.update((entries) => [
        { birthDate: calculation.birthDate, sunSign: calculation.sunSign.name, chineseAnimal: calculation.chineseAnimal.animal, recordedAt: Date.now() },
        ...entries.filter((item) => item.birthDate !== calculation.birthDate)
      ].slice(0, 10));
    }
  }
}

function isoDateValidator(control: import('@angular/forms').AbstractControl) {
  const raw = `${control.value ?? ''}`.trim();
  if (!raw) {
    return null;
  }
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? null : { isoDate: true };
}

function formatDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, offset: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + offset);
  return copy;
}

function computeZodiac(birthDate: string, birthTime: string | undefined, timezone: string): ZodiacResult {
  const date = new Date(`${birthDate}T${birthTime ?? '12:00'}:00`);
  const dayOfWeek = new Intl.DateTimeFormat(DEFAULT_LOCALE, { weekday: 'long', timeZone: timezone }).format(date);

  const sunSign = findSunSign(date);
  const cuspInfo = determineCusp(date, sunSign);
  const chinese = chineseZodiac(date.getFullYear());
  const lifePath = computeLifePathNumber(birthDate);

  const monthName = new Intl.DateTimeFormat('en-US', { month: 'long' }).format(date);
  const birthstone = BIRTHSTONES[monthName] ?? '—';

  const lucky = LUCKY_COLORS[sunSign.name] ?? ['Sky blue'];

  const season = describeSeason(date);
  const lunarPhase = approximateMoonPhase(date);

  return {
    sunSign,
    cuspLabel: cuspInfo.label,
    cuspWith: cuspInfo.with,
    birthDate,
    dayOfWeek,
    chineseAnimal: chinese,
    lifePathNumber: lifePath,
    numerologyKeywords: NUMEROLOGY_KEYWORDS[lifePath],
    birthstone,
    luckyColors: lucky,
    season,
    lunarPhase,
    bestMatch: sunSign.compatibility.best[0] ?? '—',
    growthMatch: sunSign.compatibility.growth[0] ?? '—',
    summary: buildSummaryLines(sunSign, chinese, cuspInfo.label, lunarPhase)
  };
}

function findSunSign(date: Date): ZodiacSign {
  const month = date.getMonth() + 1;
  const day = date.getDate();

  return ZODIAC_SIGNS.find((sign) => {
    if (sign.start.month === sign.end.month) {
      return month === sign.start.month && day >= sign.start.day && day <= sign.end.day;
    }
    if (sign.start.month < sign.end.month) {
      if (month === sign.start.month && day >= sign.start.day) {
        return true;
      }
      if (month === sign.end.month && day <= sign.end.day) {
        return true;
      }
      return month > sign.start.month && month < sign.end.month;
    }
    // Capricorn case spans year-end
    if (month === sign.start.month && day >= sign.start.day) {
      return true;
    }
    if (month === sign.end.month && day <= sign.end.day) {
      return true;
    }
    return month > sign.start.month || month < sign.end.month;
  }) ?? ZODIAC_SIGNS[0];
}

function determineCusp(date: Date, sign: ZodiacSign): { label: string | null; with?: ZodiacSign } {
  const prevSign = getAdjacentSign(sign, -1);
  const nextSign = getAdjacentSign(sign, 1);

  const isNearStart = isWithinDaysOf(date, sign.start, -2, 0);
  if (isNearStart) {
    return { label: `Cusp with ${prevSign.name}`, with: prevSign };
  }

  const isNearEnd = isWithinDaysOf(date, sign.end, 0, 2);
  if (isNearEnd) {
    return { label: `Cusp with ${nextSign.name}`, with: nextSign };
  }

  return { label: null };
}

function getAdjacentSign(sign: ZodiacSign, offset: number): ZodiacSign {
  const index = ZODIAC_SIGNS.findIndex((item) => item.name === sign.name);
  const nextIndex = (index + offset + ZODIAC_SIGNS.length) % ZODIAC_SIGNS.length;
  return ZODIAC_SIGNS[nextIndex];
}

function isWithinDaysOf(date: Date, boundary: { month: number; day: number }, minOffset: number, maxOffset: number): boolean {
  const year = date.getFullYear();
  const boundaryDate = new Date(year, boundary.month - 1, boundary.day);
  const diff = (date.getTime() - boundaryDate.getTime()) / (1000 * 60 * 60 * 24);
  return diff >= minOffset && diff <= maxOffset;
}

function chineseZodiac(year: number): ChineseZodiacMeta {
  const animals = CHINESE_ZODIAC;
  const index = (year - 4) % 12;
  return animals[(index + 12) % 12];
}

function computeLifePathNumber(birthDate: string): number {
  const digits = birthDate
    .split('')
    .filter((character: string) => /\d/.test(character))
    .map((character: string) => Number.parseInt(character, 10));
  let total = digits.reduce((sum, num) => sum + num, 0);
  while (total > 9 && total !== 11 && total !== 22 && total !== 33) {
    total = total
      .toString()
      .split('')
      .map((character: string) => Number.parseInt(character, 10))
      .reduce((sum: number, num: number) => sum + num, 0);
  }
  return total;
}

function describeSeason(date: Date): string {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const value = month * 100 + day;
  if (value >= 320 && value <= 620) {
    return 'Northern hemisphere: Spring · Southern hemisphere: Autumn';
  }
  if (value >= 621 && value <= 922) {
    return 'Northern hemisphere: Summer · Southern hemisphere: Winter';
  }
  if (value >= 923 && value <= 1220) {
    return 'Northern hemisphere: Autumn · Southern hemisphere: Spring';
  }
  return 'Northern hemisphere: Winter · Southern hemisphere: Summer';
}

function approximateMoonPhase(date: Date): string {
  const knownNewMoon = new Date(Date.UTC(2000, 0, 6, 18, 14));
  const diff = date.getTime() - knownNewMoon.getTime();
  const lunations = diff / (1000 * 60 * 60 * 24 * 29.530588853);
  const phase = lunations - Math.floor(lunations);

  if (phase < 0.03 || phase > 0.97) {
    return 'New Moon energy';
  }
  if (phase < 0.22) {
    return 'Waxing Crescent momentum';
  }
  if (phase < 0.28) {
    return 'First Quarter activation';
  }
  if (phase < 0.47) {
    return 'Waxing Gibbous refinement';
  }
  if (phase < 0.53) {
    return 'Full Moon illumination';
  }
  if (phase < 0.72) {
    return 'Waning Gibbous integration';
  }
  if (phase < 0.78) {
    return 'Last Quarter release';
  }
  return 'Waning Crescent reflection';
}

function buildSummaryLines(sign: ZodiacSign, chinese: ChineseZodiacMeta, cuspLabel: string | null, lunarPhase: string): string[] {
  const lines = [
    `${sign.symbol} ${sign.name} embodies ${sign.element.toLowerCase()} energy with a ${sign.modality.toLowerCase()} tempo.`,
    `Chinese zodiac: ${chinese.animal} · Keywords: ${chinese.keywords.join(', ')}.`,
    `Current lunar emphasis: ${lunarPhase}.`,
    `Ruling planet influence: ${sign.rulingPlanet}.`
  ];
  if (cuspLabel) {
    lines.push(`You dance on the ${cuspLabel}, blending perspectives.`);
  }
  return lines;
}

function buildSummaryCards(result: ZodiacResult | null): Array<{ title: string; value: string; footnote?: string }> {
  if (!result) {
    return [];
  }
  return [
    {
      title: 'Sun sign',
      value: `${result.sunSign.symbol} ${result.sunSign.name}`,
      footnote: result.cuspLabel ?? `${result.sunSign.element} · ${result.sunSign.modality}`
    },
    {
      title: 'Chinese zodiac',
      value: result.chineseAnimal.animal,
      footnote: result.chineseAnimal.keywords.join(', ')
    },
    {
      title: 'Life path',
      value: result.lifePathNumber.toString(),
      footnote: result.numerologyKeywords.join(' · ')
    },
    {
      title: 'Birthstone',
      value: result.birthstone,
      footnote: `Lucky colors: ${result.luckyColors.join(', ')}`
    }
  ];
}

function buildCompatibilityCards(result: ZodiacResult | null): Array<{ heading: string; description: string }> {
  if (!result) {
    return [];
  }
  return [
    {
      heading: `Natural synergy · ${result.bestMatch}`,
      description: `${result.sunSign.name} often thrives with ${result.bestMatch} thanks to shared vibrational pace and mutual inspiration.`
    },
    {
      heading: `Growth edge · ${result.growthMatch}`,
      description: `${result.growthMatch} invites you to stretch, heal, and balance contrasting styles for holistic evolution.`
    },
    {
      heading: 'Affirmation',
      description: result.sunSign.affirmations.join(' ')
    }
  ];
}
