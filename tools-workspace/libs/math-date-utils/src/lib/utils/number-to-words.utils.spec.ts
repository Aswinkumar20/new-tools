import {
  applyCaseStyle,
  convertCardinalToOrdinal,
  convertChunkToWords,
  convertNumberToWords,
  parseNumberInput,
  resolveCurrency,
  resolveLocale,
  resolveNumberToWordsSuggestion
} from './number-to-words.utils';

describe('number-to-words.utils', () => {
  describe('parseNumberInput', () => {
    it('parses comma-separated values', () => {
      expect(parseNumberInput('1,234.5')).toBe(1234.5);
    });

    it('rejects empty input', () => {
      expect(parseNumberInput('')).toBeInstanceOf(Error);
    });

    it('rejects non-finite values', () => {
      expect(parseNumberInput('abc')).toBeInstanceOf(Error);
    });
  });

  describe('convertChunkToWords', () => {
    it('converts teens, tens, and hundreds', () => {
      expect(convertChunkToWords(15)).toBe('fifteen');
      expect(convertChunkToWords(42)).toBe('forty-two');
      expect(convertChunkToWords(105)).toBe('one hundred five');
    });
  });

  describe('convertCardinalToOrdinal', () => {
    it('maps special and regular endings', () => {
      expect(convertCardinalToOrdinal('one')).toBe('first');
      expect(convertCardinalToOrdinal('twenty-two')).toBe('twenty-second');
      expect(convertCardinalToOrdinal('one hundred')).toBe('one hundredth');
    });
  });

  describe('applyCaseStyle', () => {
    it('applies sentence, title, upper, and lower styles', () => {
      expect(applyCaseStyle('hello world', 'sentence')).toBe('Hello world');
      expect(applyCaseStyle('hello world', 'title')).toBe('Hello World');
      expect(applyCaseStyle('hello', 'upper')).toBe('HELLO');
      expect(applyCaseStyle('HELLO', 'lower')).toBe('hello');
    });
  });

  describe('convertNumberToWords', () => {
    const baseOptions = {
      locale: resolveLocale('en-US'),
      currency: resolveCurrency('USD'),
      includeAnd: true,
      includeCents: true,
      handleNegative: true,
      showCurrencySymbol: true,
      caseStyle: 'sentence' as const,
      format: 'cardinal' as const
    };

    it('converts cardinal numbers with decimals', () => {
      const text = convertNumberToWords(123.45, baseOptions);
      expect(text.toLowerCase()).toContain('one hundred');
      expect(text.toLowerCase()).toContain('point');
    });

    it('converts ordinal integers', () => {
      const text = convertNumberToWords(112, { ...baseOptions, format: 'ordinal' });
      expect(text.toLowerCase()).toContain('twelfth');
    });

    it('rejects ordinal decimals', () => {
      expect(() => convertNumberToWords(1.5, { ...baseOptions, format: 'ordinal' })).toThrow(
        'Ordinals do not support decimal fractions.'
      );
    });

    it('converts currency with cents', () => {
      const text = convertNumberToWords(12.5, { ...baseOptions, format: 'currency' });
      expect(text).toContain('$');
      expect(text.toLowerCase()).toContain('dollar');
      expect(text.toLowerCase()).toContain('cent');
    });

    it('uses Indian scale for en-IN', () => {
      const text = convertNumberToWords(100000, {
        ...baseOptions,
        locale: resolveLocale('en-IN'),
        includeAnd: false
      });
      expect(text.toLowerCase()).toContain('lakh');
    });
  });

  describe('resolveNumberToWordsSuggestion', () => {
    it('suggests validation help on errors', () => {
      expect(
        resolveNumberToWordsSuggestion({
          hasResult: false,
          hasError: true,
          format: 'cardinal',
          locale: 'en-US',
          numericInput: 'abc',
          isNegative: false,
          hasDecimal: false,
          absoluteValue: 0
        })?.id
      ).toBe('ntw-validation');
    });

    it('suggests currency converter for currency format', () => {
      expect(
        resolveNumberToWordsSuggestion({
          hasResult: true,
          hasError: false,
          format: 'currency',
          locale: 'en-US',
          numericInput: '100',
          isNegative: false,
          hasDecimal: false,
          absoluteValue: 100
        })?.id
      ).toBe('ntw-currency');
    });

    it('suggests ordinal companion tool', () => {
      expect(
        resolveNumberToWordsSuggestion({
          hasResult: true,
          hasError: false,
          format: 'ordinal',
          locale: 'en-UK',
          numericInput: '112',
          isNegative: false,
          hasDecimal: false,
          absoluteValue: 112
        })?.id
      ).toBe('ntw-ordinal');
    });
  });
});
