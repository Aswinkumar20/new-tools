import type { AbstractControl, ValidationErrors } from '@angular/forms';
import {
  CHINESE_ZODIAC,
  ZODIAC_BIRTHSTONES,
  ZODIAC_DEFAULT_LOCALE,
  ZODIAC_LUCKY_COLORS,
  ZODIAC_NUMEROLOGY_KEYWORDS,
  ZODIAC_SIGNS
} from '../constants/zodiac-finder.constants';
import type { MdToolSuggestion } from '../shared/md-tool-suggestion.model';
import type {
  ChineseZodiacMeta,
  ZodiacCompatibilityCard,
  ZodiacCuspInfo,
  ZodiacDatePreset,
  ZodiacHistoryEntry,
  ZodiacResult,
  ZodiacSign,
  ZodiacSuggestionContext,
  ZodiacSummaryCard
} from '../types/zodiac-finder.types';

export function isoDateValidator(control: AbstractControl): ValidationErrors | null {
  const raw = `${control.value ?? ''}`.trim();
  if (!raw) {
    return null;
  }
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? null : { isoDate: true };
}

export function formatDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function addDays(date: Date, offset: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + offset);
  return copy;
}

export function resolveZodiacPresetDate(
  preset: ZodiacDatePreset,
  today: Date = new Date()
): string {
  switch (preset) {
    case 'today':
      return formatDateInput(today);
    case 'yesterday':
      return formatDateInput(addDays(today, -1));
    case 'newYear':
      return `${today.getFullYear()}-01-01`;
  }
}

export function computeZodiac(
  birthDate: string,
  birthTime: string | undefined,
  timezone: string,
  locale: string = ZODIAC_DEFAULT_LOCALE
): ZodiacResult {
  const date = new Date(`${birthDate}T${birthTime ?? '12:00'}:00`);
  const dayOfWeek = new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    timeZone: timezone
  }).format(date);

  const sunSign = findSunSign(date);
  const cuspInfo = determineCusp(date, sunSign);
  const chinese = chineseZodiac(date.getFullYear());
  const lifePath = computeLifePathNumber(birthDate);

  const monthName = new Intl.DateTimeFormat('en-US', { month: 'long' }).format(date);
  const birthstone = ZODIAC_BIRTHSTONES[monthName] ?? '—';
  const lucky = ZODIAC_LUCKY_COLORS[sunSign.name] ?? ['Sky blue'];
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
    numerologyKeywords: ZODIAC_NUMEROLOGY_KEYWORDS[lifePath] ?? [],
    birthstone,
    luckyColors: lucky,
    season,
    lunarPhase,
    bestMatch: sunSign.compatibility.best[0] ?? '—',
    growthMatch: sunSign.compatibility.growth[0] ?? '—',
    summary: buildSummaryLines(sunSign, chinese, cuspInfo.label, lunarPhase)
  };
}

export function findSunSign(date: Date): ZodiacSign {
  const month = date.getMonth() + 1;
  const day = date.getDate();

  return (
    ZODIAC_SIGNS.find((sign) => {
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
    }) ?? ZODIAC_SIGNS[0]
  );
}

export function determineCusp(date: Date, sign: ZodiacSign): ZodiacCuspInfo {
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

export function getAdjacentSign(sign: ZodiacSign, offset: number): ZodiacSign {
  const index = ZODIAC_SIGNS.findIndex((item) => item.name === sign.name);
  const nextIndex = (index + offset + ZODIAC_SIGNS.length) % ZODIAC_SIGNS.length;
  return ZODIAC_SIGNS[nextIndex];
}

export function isWithinDaysOf(
  date: Date,
  boundary: { month: number; day: number },
  minOffset: number,
  maxOffset: number
): boolean {
  const year = date.getFullYear();
  const boundaryDate = new Date(year, boundary.month - 1, boundary.day);
  const diff = (date.getTime() - boundaryDate.getTime()) / (1000 * 60 * 60 * 24);
  return diff >= minOffset && diff <= maxOffset;
}

export function chineseZodiac(year: number): ChineseZodiacMeta {
  const animals = CHINESE_ZODIAC;
  const index = (year - 4) % 12;
  return animals[(index + 12) % 12];
}

export function computeLifePathNumber(birthDate: string): number {
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

export function describeSeason(date: Date): string {
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

export function approximateMoonPhase(date: Date): string {
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

export function buildSummaryLines(
  sign: ZodiacSign,
  chinese: ChineseZodiacMeta,
  cuspLabel: string | null,
  lunarPhase: string
): string[] {
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

export function buildSummaryCards(result: ZodiacResult | null): ZodiacSummaryCard[] {
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
      footnote: result.numerologyKeywords?.join(' · ') ?? ''
    },
    {
      title: 'Birthstone',
      value: result.birthstone,
      footnote: `Lucky colors: ${result.luckyColors.join(', ')}`
    }
  ];
}

export function buildCompatibilityCards(
  result: ZodiacResult | null
): ZodiacCompatibilityCard[] {
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

export function formatZodiacResultText(result: ZodiacResult): string {
  return [
    `${result.sunSign.symbol} ${result.sunSign.name}`,
    `Chinese: ${result.chineseAnimal.animal}`,
    `Life path: ${result.lifePathNumber}`,
    `Season: ${result.season} · Moon: ${result.lunarPhase}`,
    ...result.summary
  ].join('\n');
}

export function prependZodiacHistory(
  entries: ZodiacHistoryEntry[],
  entry: ZodiacHistoryEntry,
  limit: number
): ZodiacHistoryEntry[] {
  return [
    entry,
    ...entries.filter((item) => item.birthDate !== entry.birthDate)
  ].slice(0, limit);
}

export function createRandomBirthDate(random: () => number = Math.random): Date {
  const year = 1960 + Math.floor(random() * 60);
  const month = Math.floor(random() * 12);
  const day = 1 + Math.floor(random() * 28);
  return new Date(year, month, day);
}

export function resolveZodiacSuggestion(
  context: ZodiacSuggestionContext
): MdToolSuggestion | null {
  const { hasResult, hasError, hasCusp, lifePathNumber, birthDate } = context;

  if (hasError) {
    return {
      id: 'zf-invalid-date',
      title: 'Use a YYYY-MM-DD birth date',
      reason:
        'Zodiac lookups need a valid calendar date. Date to Day of Week can also confirm weekdays once the date is fixed.',
      actionLabel: 'Open Date to Day of Week',
      path: '/math-date-utils/date-to-day-of-week'
    };
  }

  if (hasResult && hasCusp) {
    return {
      id: 'zf-cusp',
      title: 'Cusp birthday detected',
      reason:
        'Dates near sign boundaries blend neighboring traits. Date Difference Calculator can measure how close this birthday sits to the cusp edge.',
      actionLabel: 'Open Date Difference',
      path: '/math-date-utils/date-difference-calculator'
    };
  }

  if (
    hasResult &&
    lifePathNumber !== null &&
    (lifePathNumber === 11 || lifePathNumber === 22 || lifePathNumber === 33)
  ) {
    return {
      id: 'zf-master-number',
      title: `Master life path ${lifePathNumber}`,
      reason:
        'Master numbers stay unreduced in this tool. Number to Words can spell the digits for notes, cards, or journaling.',
      actionLabel: 'Open Number to Words',
      path: '/math-date-utils/number-to-words'
    };
  }

  if (hasResult && birthDate) {
    return {
      id: 'zf-age-next',
      title: 'Want exact age from this birthday?',
      reason:
        'Age Calculator uses the same birth date to compute exact age, milestones, and timelines without retyping.',
      actionLabel: 'Open Age Calculator',
      path: '/math-date-utils/age-calculator'
    };
  }

  return null;
}
