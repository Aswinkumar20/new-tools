import {
  addDays,
  chineseZodiac,
  computeLifePathNumber,
  computeZodiac,
  createRandomBirthDate,
  findSunSign,
  formatDateInput,
  formatZodiacResultText,
  prependZodiacHistory,
  resolveZodiacPresetDate,
  resolveZodiacSuggestion
} from './zodiac-finder.utils';
import type { ZodiacHistoryEntry } from '../types/zodiac-finder.types';

describe('zodiac-finder.utils', () => {
  describe('computeZodiac', () => {
    it('resolves Aries for a mid-sign date', () => {
      const result = computeZodiac('1990-04-01', undefined, 'UTC');
      expect(result.sunSign.name).toBe('Aries');
      expect(result.birthDate).toBe('1990-04-01');
      expect(result.chineseAnimal.animal).toBe(chineseZodiac(1990).animal);
      expect(result.summary.length).toBeGreaterThan(2);
      expect(formatZodiacResultText(result)).toContain('Aries');
    });

    it('handles Capricorn year-span dates', () => {
      expect(findSunSign(new Date(2000, 11, 25)).name).toBe('Capricorn');
      expect(findSunSign(new Date(2001, 0, 10)).name).toBe('Capricorn');
    });

    it('detects cusp near sign boundaries', () => {
      const cusp = computeZodiac('1990-03-20', undefined, 'UTC');
      expect(cusp.sunSign.name).toBe('Pisces');
      expect(cusp.cuspLabel).toContain('Cusp');
    });
  });

  describe('numerology and chinese zodiac', () => {
    it('computes life path and preserves master numbers', () => {
      expect(computeLifePathNumber('1990-04-01')).toBeGreaterThan(0);
      expect(computeLifePathNumber('1960-01-05')).toBe(22);
    });

    it('maps chinese animals by year cycle', () => {
      expect(chineseZodiac(2020).animal).toBe('Rat');
      expect(chineseZodiac(2024).animal).toBe('Dragon');
    });
  });

  describe('presets and history', () => {
    it('resolves presets and random dates', () => {
      const base = new Date(2024, 5, 15);
      expect(resolveZodiacPresetDate('today', base)).toBe(formatDateInput(base));
      expect(resolveZodiacPresetDate('yesterday', base)).toBe(formatDateInput(addDays(base, -1)));
      expect(resolveZodiacPresetDate('newYear', base)).toBe('2024-01-01');

      const random = createRandomBirthDate(() => 0.5);
      expect(random.getFullYear()).toBeGreaterThanOrEqual(1960);
    });

    it('prepends unique history entries', () => {
      const entry = (birthDate: string): ZodiacHistoryEntry => ({
        birthDate,
        sunSign: 'Aries',
        chineseAnimal: 'Horse',
        recordedAt: Date.now()
      });
      const next = prependZodiacHistory([entry('1990-01-01')], entry('1991-01-01'), 2);
      expect(next[0].birthDate).toBe('1991-01-01');
      expect(next).toHaveLength(2);
    });
  });

  describe('resolveZodiacSuggestion', () => {
    it('suggests age calculator for valid results', () => {
      const suggestion = resolveZodiacSuggestion({
        hasResult: true,
        hasError: false,
        hasCusp: false,
        lifePathNumber: 7,
        sunSignName: 'Aries',
        birthDate: '1990-04-01'
      });
      expect(suggestion?.id).toBe('zf-age-next');
    });

    it('prioritizes cusp and master-number guidance', () => {
      expect(
        resolveZodiacSuggestion({
          hasResult: true,
          hasError: false,
          hasCusp: true,
          lifePathNumber: 11,
          sunSignName: 'Aries',
          birthDate: '1990-03-21'
        })?.id
      ).toBe('zf-cusp');

      expect(
        resolveZodiacSuggestion({
          hasResult: true,
          hasError: false,
          hasCusp: false,
          lifePathNumber: 22,
          sunSignName: 'Taurus',
          birthDate: '1990-05-01'
        })?.id
      ).toBe('zf-master-number');
    });

    it('suggests recovery path for invalid dates', () => {
      expect(
        resolveZodiacSuggestion({
          hasResult: false,
          hasError: true,
          hasCusp: false,
          lifePathNumber: null,
          sunSignName: null,
          birthDate: ''
        })?.id
      ).toBe('zf-invalid-date');
    });
  });
});
