import type { MdRelatedToolLink } from '../shared/md-tool-suggestion.model';
import type {
  ChineseZodiacMeta,
  ZodiacFormValues,
  ZodiacSign
} from '../types/zodiac-finder.types';

export const ZODIAC_HISTORY_LIMIT = 10;

export const ZODIAC_DEFAULT_TIMEZONE =
  typeof Intl !== 'undefined'
    ? (Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC')
    : 'UTC';

export const ZODIAC_DEFAULT_LOCALE =
  typeof navigator !== 'undefined' ? navigator.language || 'en-US' : 'en-US';

export const ZODIAC_TIMEZONES: ReadonlyArray<string> = [
  ZODIAC_DEFAULT_TIMEZONE,
  'UTC',
  'America/New_York',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
  'Asia/Kolkata',
  'Asia/Tokyo',
  'Australia/Sydney'
];

export const ZODIAC_SIGNS: ReadonlyArray<ZodiacSign> = [
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

export const CHINESE_ZODIAC: ReadonlyArray<ChineseZodiacMeta> = [
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

export const ZODIAC_BIRTHSTONES: Readonly<Record<string, string>> = {
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

export const ZODIAC_LUCKY_COLORS: Readonly<Record<string, string[]>> = {
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

export const ZODIAC_NUMEROLOGY_KEYWORDS: Readonly<Record<number, string[]>> = {
  1: ['Leadership', 'Innovation', 'Courage'],
  2: ['Harmony', 'Diplomacy', 'Empathy'],
  3: ['Creativity', 'Expression', 'Optimism'],
  4: ['Stability', 'Structure', 'Discipline'],
  5: ['Freedom', 'Adventure', 'Adaptability'],
  6: ['Nurturing', 'Responsibility', 'Heart-centered'],
  7: ['Intuition', 'Analysis', 'Spiritual insight'],
  8: ['Ambition', 'Manifestation', 'Authority'],
  9: ['Humanitarian', 'Wisdom', 'Compassion'],
  11: ['Intuition', 'Inspiration', 'Illumination'],
  22: ['Master builder', 'Vision', 'Legacy'],
  33: ['Compassion', 'Healing', 'Service'],
};

export function createZodiacDefaultFormValues(now = new Date()): ZodiacFormValues {
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, '0');
  const day = `${now.getDate()}`.padStart(2, '0');
  return {
    birthDate: `${year}-${month}-${day}`,
    birthTime: null,
    timezone: ZODIAC_DEFAULT_TIMEZONE,
    includeHistory: true
  };
}

/** Captured at module load to mirror previous DEFAULT_DATE timing. */
export const ZODIAC_DEFAULT_FORM: ZodiacFormValues = createZodiacDefaultFormValues();

export const ZODIAC_RELATED_TOOLS: ReadonlyArray<MdRelatedToolLink> = [
  {
    label: 'Age Calculator',
    path: '/math-date-utils/age-calculator',
    description: 'Turn the same birth date into exact age and milestones'
  },
  {
    label: 'Date to Day of Week',
    path: '/math-date-utils/date-to-day-of-week',
    description: 'Confirm weekday and calendar context for birth dates'
  },
  {
    label: 'Date Difference Calculator',
    path: '/math-date-utils/date-difference-calculator',
    description: 'Measure spans between birthdays and special dates'
  },
  {
    label: 'Number to Words',
    path: '/math-date-utils/number-to-words',
    description: 'Spell out life-path numbers for notes and cards'
  }
];
