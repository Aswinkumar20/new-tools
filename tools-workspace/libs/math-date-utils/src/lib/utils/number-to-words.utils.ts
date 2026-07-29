import {
  NUMBER_TO_WORDS_CURRENCIES,
  NUMBER_TO_WORDS_FORMAT_OPTIONS,
  NUMBER_TO_WORDS_LARGE_NUMBER,
  NUMBER_TO_WORDS_LOCALES
} from '../constants/number-to-words.constants';
import type { MdToolSuggestion } from '../shared/md-tool-suggestion.model';
import type {
  CaseStyle,
  ConverterOptions,
  CurrencyCode,
  CurrencyDefinition,
  LocaleCode,
  LocaleDefinition,
  NumberChunk,
  NumberFormat,
  NumberToWordsSuggestionContext,
  ScaleDefinition
} from '../types/number-to-words.types';

const ONES = [
  '',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen'
];

const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

export function resolveLocale(localeId: LocaleCode | null | undefined): LocaleDefinition {
  return NUMBER_TO_WORDS_LOCALES.find((item) => item.id === (localeId ?? 'en-US')) ?? NUMBER_TO_WORDS_LOCALES[0];
}

export function resolveCurrency(currencyCode: CurrencyCode | null | undefined): CurrencyDefinition {
  return (
    NUMBER_TO_WORDS_CURRENCIES.find((item) => item.code === (currencyCode ?? 'USD')) ??
    NUMBER_TO_WORDS_CURRENCIES[0]
  );
}

export function currenciesForLocale(localeId: LocaleCode): CurrencyDefinition[] {
  return NUMBER_TO_WORDS_CURRENCIES.filter((item) => item.supportedLocales.includes(localeId));
}

export function formatOptionLabel(format: NumberFormat): string {
  return NUMBER_TO_WORDS_FORMAT_OPTIONS.find((item) => item.id === format)?.label ?? 'Cardinal';
}

export function parseNumberInput(value: string): number | Error {
  if (!value.trim()) {
    return new Error('Enter a number to convert.');
  }

  const normalised = value.split(',').join('').trim();
  const parsed = Number(normalised);

  if (!Number.isFinite(parsed)) {
    return new Error('Number is too large to convert.');
  }

  if (Math.abs(parsed) > Number.MAX_SAFE_INTEGER) {
    return new Error('Number exceeds the supported safe range.');
  }

  return parsed;
}

export function convertNumberToWords(value: number, options: ConverterOptions): string {
  return new NumberToWordsConverter(options).convert(value);
}

export function mapConversionError(error: unknown): string {
  return error instanceof Error ? error.message : 'Unable to process number.';
}

export function resolveNumberToWordsSuggestion(
  context: NumberToWordsSuggestionContext
): MdToolSuggestion | null {
  const { hasResult, hasError, format, locale, isNegative, hasDecimal, absoluteValue } = context;

  if (hasError) {
    return {
      id: 'ntw-validation',
      title: 'Check the number format',
      reason:
        'Use an optional minus sign, digits, and up to six decimal places. Percentage Calculator helps when you only have a percent to convert.',
      actionLabel: 'Open Percentage Calculator',
      path: '/math-date-utils/percentage-calculator'
    };
  }

  if (hasResult && format === 'currency') {
    return {
      id: 'ntw-currency',
      title: 'Currency wording ready',
      reason:
        'Currency Converter can translate the amount into another currency before you spell it out for cheques or invoices.',
      actionLabel: 'Open Currency Converter',
      path: '/math-date-utils/currency-converter'
    };
  }

  if (hasResult && format === 'ordinal') {
    return {
      id: 'ntw-ordinal',
      title: 'Ordinal wording detected',
      reason:
        'Date to Day of Week pairs well with ordinal ranks when labeling schedules or event positions.',
      actionLabel: 'Open Date to Day of Week',
      path: '/math-date-utils/date-to-day-of-week'
    };
  }

  if (hasResult && locale === 'en-IN') {
    return {
      id: 'ntw-india',
      title: 'Indian numbering scale in use',
      reason:
        'Lakh/crore wording is active. Currency Converter helps when you also need FX for INR amounts.',
      actionLabel: 'Open Currency Converter',
      path: '/math-date-utils/currency-converter'
    };
  }

  if (hasResult && absoluteValue >= NUMBER_TO_WORDS_LARGE_NUMBER) {
    return {
      id: 'ntw-large',
      title: 'Very large number detected',
      reason:
        'Loan EMI Calculator can turn large principals into monthly payment words for contracts.',
      actionLabel: 'Open Loan EMI Calculator',
      path: '/math-date-utils/loan-emi-calculator'
    };
  }

  if (hasResult && hasDecimal) {
    return {
      id: 'ntw-decimal',
      title: 'Decimal fraction present',
      reason:
        'Percentage Calculator converts the fractional part into a percent for reports and slides.',
      actionLabel: 'Open Percentage Calculator',
      path: '/math-date-utils/percentage-calculator'
    };
  }

  if (hasResult && isNegative) {
    return {
      id: 'ntw-negative',
      title: 'Negative value detected',
      reason:
        'Currency Converter is useful when reconciling negative balances across currencies before wording them.',
      actionLabel: 'Open Currency Converter',
      path: '/math-date-utils/currency-converter'
    };
  }

  if (hasResult) {
    return {
      id: 'ntw-fraction',
      title: 'Need a fractional view?',
      reason:
        'Fraction Calculator helps when the number came from a ratio you still want to simplify.',
      actionLabel: 'Open Fraction Calculator',
      path: '/math-date-utils/fraction-calculator'
    };
  }

  return {
    id: 'ntw-start',
    title: 'Enter a number to convert',
    reason:
      'Pick locale, case, and format to spell amounts for invoices, ranks, or cheques. Related tools help with FX and percents.',
    actionLabel: 'Open Currency Converter',
    path: '/math-date-utils/currency-converter'
  };
}

class NumberToWordsConverter {
  private readonly locale: LocaleDefinition;
  private readonly currency: CurrencyDefinition;
  private readonly includeAnd: boolean;
  private readonly includeCents: boolean;
  private readonly handleNegative: boolean;
  private readonly showCurrencySymbol: boolean;
  private readonly caseStyle: CaseStyle;
  private readonly format: NumberFormat;

  constructor(options: ConverterOptions) {
    this.locale = options.locale;
    this.currency = options.currency;
    this.includeAnd = options.includeAnd;
    this.includeCents = options.includeCents;
    this.handleNegative = options.handleNegative;
    this.showCurrencySymbol = options.showCurrencySymbol;
    this.caseStyle = options.caseStyle;
    this.format = options.format;
  }

  convert(value: number): string {
    const isNegative = value < 0;
    const absoluteValue = Math.abs(value);

    const integerPart = Math.floor(absoluteValue);
    const decimalPart = Number.parseFloat((absoluteValue - integerPart).toFixed(6));

    let words: string;

    switch (this.format) {
      case 'ordinal':
        words = this.convertOrdinal(integerPart, decimalPart);
        break;
      case 'currency':
        words = this.convertCurrency(integerPart, decimalPart);
        break;
      default:
        words = this.convertCardinal(integerPart, decimalPart);
        break;
    }

    if (isNegative && this.handleNegative) {
      words = `negative ${words}`;
    }

    return applyCaseStyle(words.trim(), this.caseStyle);
  }

  private convertCardinal(integerPart: number, decimalPart: number): string {
    const integerWords = this.toWords(integerPart);
    if (decimalPart === 0) {
      return integerWords;
    }

    const decimalWords = decimalDigitsToWords(decimalPart);
    return `${integerWords} point ${decimalWords}`;
  }

  private convertOrdinal(integerPart: number, decimalPart: number): string {
    if (decimalPart !== 0) {
      throw new Error('Ordinals do not support decimal fractions.');
    }

    const cardinal = this.toWords(integerPart);
    return convertCardinalToOrdinal(cardinal);
  }

  private convertCurrency(integerPart: number, decimalPart: number): string {
    const { majorSingular, majorPlural, minorSingular, minorPlural, symbol } = this.currency;
    const majorLabel = integerPart === 1 ? majorSingular : majorPlural;
    const majorWords =
      integerPart === 0 ? `zero ${majorPlural}` : `${this.toWords(integerPart)} ${majorLabel}`;

    if (!this.includeCents || decimalPart === 0) {
      return this.showCurrencySymbol ? `${symbol} ${majorWords}` : majorWords;
    }

    const centsValue = Math.round(decimalPart * 100);
    const centsLabel = centsValue === 1 ? minorSingular : minorPlural;
    const centsWords =
      centsValue === 0 ? `zero ${minorPlural}` : `${this.toWords(centsValue)} ${centsLabel}`;

    const connector = this.includeAnd ? ' and ' : ', ';
    const phrase = `${majorWords}${connector}${centsWords}`;
    return this.showCurrencySymbol ? `${symbol} ${phrase}` : phrase;
  }

  private toWords(value: number): string {
    if (value === 0) {
      return 'zero';
    }

    const parts: string[] = [];
    const chunks = splitNumberIntoChunks(value, this.locale.scale);

    for (const chunk of chunks) {
      if (chunk.value === 0) {
        continue;
      }

      const chunkWords = convertChunkToWords(chunk.value);
      const scaleWord = this.locale.scale.thousands[chunk.scaleIndex] ?? '';
      const segment = scaleWord ? `${chunkWords} ${scaleWord}` : chunkWords;
      parts.push(segment.trim());
    }

    const connector = this.includeAnd ? ' and ' : ' ';
    const ordered = [...parts].reverse().filter((segment) => segment.length > 0);
    const combined = ordered.join(connector);
    return combined
      .split(/\s+/)
      .filter((segment) => segment.length > 0)
      .join(' ')
      .trim();
  }
}

export function splitNumberIntoChunks(value: number, scale: ScaleDefinition): NumberChunk[] {
  const chunks: NumberChunk[] = [];
  let remaining = value;
  let index = 0;

  while (remaining > 0) {
    const groupSize =
      index === 0 ? scale.primaryGroupSize : (scale.secondaryGroupSize ?? scale.primaryGroupSize);
    const divisor = Math.pow(10, groupSize);
    const chunkValue = remaining % divisor;
    remaining = Math.floor(remaining / divisor);

    chunks.push({
      value: chunkValue,
      scaleIndex: index
    });

    index += 1;
  }

  return chunks;
}

export function convertChunkToWords(value: number): string {
  if (value === 0) {
    return '';
  }

  if (value < 20) {
    return ONES[value];
  }

  if (value < 100) {
    const ten = Math.floor(value / 10);
    const unit = value % 10;
    if (unit === 0) {
      return TENS[ten];
    }

    return `${TENS[ten]}-${ONES[unit]}`;
  }

  const hundred = Math.floor(value / 100);
  const remainder = value % 100;
  const hundredPart = `${ONES[hundred]} hundred`;
  if (remainder === 0) {
    return hundredPart;
  }

  return `${hundredPart} ${convertChunkToWords(remainder)}`;
}

export function convertCardinalToOrdinal(cardinal: string): string {
  const words = cardinal.trim().split(/\s+/);
  if (words.length === 0) {
    return cardinal;
  }

  const lastWord = words.pop()!;
  const ordinalWord = convertWordToOrdinal(lastWord);
  words.push(ordinalWord);
  return words.join(' ');
}

function convertWordToOrdinal(word: string): string {
  const specialOrdinals: Record<string, string> = {
    one: 'first',
    two: 'second',
    three: 'third',
    five: 'fifth',
    eight: 'eighth',
    nine: 'ninth',
    twelve: 'twelfth'
  };

  if (specialOrdinals[word]) {
    return specialOrdinals[word];
  }

  if (word.endsWith('y')) {
    return `${word.slice(0, -1)}ieth`;
  }

  if (word.endsWith('teen')) {
    return `${word}th`;
  }

  if (word.endsWith('ty')) {
    return `${word.slice(0, -2)}tieth`;
  }

  if (word.includes('-')) {
    const [tens, units] = word.split('-');
    return `${tens}-${convertWordToOrdinal(units)}`;
  }

  return `${word}th`;
}

function decimalDigitsToWords(decimal: number): string {
  const digits = decimal.toString().split('.')[1] ?? '';
  const words = digits.split('').map((digit) => ONES[Number.parseInt(digit, 10)]);
  return words.join(' ');
}

export function applyCaseStyle(value: string, style: CaseStyle): string {
  switch (style) {
    case 'upper':
      return value.toUpperCase();
    case 'lower':
      return value.toLowerCase();
    case 'title':
      return value
        .split(/\s+/)
        .map((word: string) => (word ? word.charAt(0).toUpperCase() + word.slice(1) : word))
        .join(' ');
    default:
      return value.charAt(0).toUpperCase() + value.slice(1);
  }
}
