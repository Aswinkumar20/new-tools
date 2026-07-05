import { CommonModule } from '@angular/common';
import { Component, computed, effect, EffectRef, inject, OnDestroy, signal, Signal, WritableSignal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Navigation, TooltipDirective, AssetService } from '@tools-workspace/features-home';
import { Subscription, debounceTime, distinctUntilChanged } from 'rxjs';

@Component({
  selector: 'lib-number-to-words',
  standalone: true,
  templateUrl: './number-to-words.html',
  styleUrls: ['./number-to-words.scss'],
  imports: [CommonModule, ReactiveFormsModule, Navigation, TooltipDirective]
})
export class NumberToWordsComponent implements OnDestroy {
  private readonly fb = inject(FormBuilder);
  readonly assetService = inject(AssetService);

  private readonly maxHistoryEntries = 12;
  private readonly conversionSubscription: Subscription;
  private readonly effectRefs: EffectRef[] = [];

  readonly form = this.fb.group({
    numericInput: this.fb.control('123456.78', [Validators.required, Validators.pattern(/^-?\d+(\.\d{0,6})?$/)]),
    locale: this.fb.control<LocaleCode>('en-US', { nonNullable: true }),
    format: this.fb.control<NumberFormat>('cardinal', { nonNullable: true }),
    currency: this.fb.control<CurrencyCode>('USD', { nonNullable: true }),
    showCurrencySymbol: this.fb.control(true, { nonNullable: true }),
    includeCents: this.fb.control(true, { nonNullable: true }),
    caseStyle: this.fb.control<CaseStyle>('sentence', { nonNullable: true }),
    includeAnd: this.fb.control(true, { nonNullable: true }),
    handleNegative: this.fb.control(true, { nonNullable: true })
  });

  readonly result: WritableSignal<ConversionResult | null> = signal(null);
  readonly statusMessage = signal<string | null>(null);
  readonly isCopySuccess = signal(false);
  readonly historyEntries: WritableSignal<ConversionHistory[]> = signal([]);
  readonly errorMessage = signal<string | null>(null);

  readonly locales: LocaleDefinition[] = LOCALES;
  readonly formats: FormatOption[] = FORMAT_OPTIONS;
  readonly caseStyles: CaseStyleOption[] = CASE_STYLES;
  readonly sampleNumbers: SampleNumber[] = SAMPLE_NUMBERS;

  readonly selectedLocale: Signal<LocaleDefinition> = computed(
    () => this.locales.find((item) => item.id === this.form.get('locale')!.value) ?? LOCALES[0]
  );

  readonly availableCurrencies: Signal<CurrencyDefinition[]> = computed(() => {
    const locale = this.selectedLocale();
    return CURRENCIES.filter((item) => item.supportedLocales.includes(locale.id));
  });

  readonly formattedOutput = computed(() => this.result()?.text ?? '');
  readonly formatLabel = computed(() => {
    const format = this.form.get('format')!.value ?? 'cardinal';
    return FORMAT_OPTIONS.find((item) => item.id === format)?.label ?? 'Cardinal';
  });

  readonly badgeMeta = computed(() => ({
    locale: this.selectedLocale().label,
    format: this.formatLabel(),
    historyCount: this.historyEntries().length
  }));

  readonly isCurrencyFormat = computed(() => this.form.get('format')!.value === 'currency');
  readonly selectedCaseDescription = computed(() => {
    const current = this.form.get('caseStyle')!.value ?? 'sentence';
    return CASE_STYLES.find((style) => style.id === current)?.description ?? '';
  });

  constructor() {
    this.conversionSubscription = this.form.valueChanges
      .pipe(debounceTime(120), distinctUntilChanged())
      .subscribe(() => this.convert());

    this.effectRefs.push(
      effect(() => {
        const available = this.availableCurrencies();
        const current = this.form.get('currency')!.value;
        if (available.length === 0) {
          return;
        }

        if (!available.some((currency) => currency.code === current)) {
          this.form.patchValue({ currency: available[0].code }, { emitEvent: true });
        }
      })
    );

    this.convert();
  }

  ngOnDestroy(): void {
    this.conversionSubscription.unsubscribe();
    for (const ref of this.effectRefs) {
      ref.destroy();
    }
  }

  applySample(sample: SampleNumber): void {
    this.form.patchValue(
      {
        numericInput: sample.value,
        format: sample.format ?? this.form.get('format')!.value,
        locale: sample.locale ?? this.form.get('locale')!.value,
        currency: sample.currency ?? this.form.get('currency')!.value
      },
      { emitEvent: true }
    );
    this.notify(`Sample ${sample.label} applied.`);
  }

  copyToClipboard(): void {
    const text = this.formattedOutput();
    if (!text) {
      this.notify('Nothing to copy yet.');
      return;
    }

    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard
        .writeText(text)
        .then(() => {
          this.isCopySuccess.set(true);
          this.notify('Copied to clipboard.');
        })
        .catch(() => this.copyWithFallback(text));
      return;
    }

    this.copyWithFallback(text);
  }

  clearHistory(): void {
    this.historyEntries.set([]);
    this.notify('History cleared.');
  }

  resetToDefault(): void {
    this.form.patchValue({
      numericInput: '123456.78',
      locale: 'en-US',
      format: 'cardinal',
      currency: 'USD',
      showCurrencySymbol: true,
      includeCents: true,
      caseStyle: 'sentence',
      includeAnd: true,
      handleNegative: true
    }, { emitEvent: true });
    this.notify('Reset to default values.');
  }

  submitForm(): void {
    this.convert();
    this.notify('Conversion refreshed.');
  }

  setFormat(format: NumberFormat): void {
    if (this.form.get('format')!.value === format) {
      return;
    }

    this.form.patchValue({ format }, { emitEvent: true });
  }

  setCaseStyle(style: CaseStyle): void {
    if (this.form.get('caseStyle')!.value === style) {
      return;
    }

    this.form.patchValue({ caseStyle: style }, { emitEvent: true });
  }

  restoreHistory(entry: ConversionHistory): void {
    this.form.patchValue(
      {
        numericInput: entry.input,
        locale: entry.locale,
        format: entry.format,
        currency: entry.currency ?? this.form.get('currency')!.value,
        caseStyle: entry.caseStyle,
        includeAnd: entry.includeAnd,
        handleNegative: entry.handleNegative,
        includeCents: entry.includeCents,
        showCurrencySymbol: entry.showCurrencySymbol
      },
      { emitEvent: true }
    );
    this.notify('History entry restored.');
  }

  private convert(): void {
    const rawValue = this.form.get('numericInput')!.value ?? '';
    const locale = this.form.get('locale')!.value ?? 'en-US';
    const format = this.form.get('format')!.value ?? 'cardinal';
    const currency = this.form.get('currency')!.value ?? 'USD';
    const caseStyle = this.form.get('caseStyle')!.value ?? 'sentence';
    const includeAnd = this.form.get('includeAnd')!.value ?? true;
    const handleNegative = this.form.get('handleNegative')!.value ?? true;
    const includeCents = this.form.get('includeCents')!.value ?? true;
    const showCurrencySymbol = this.form.get('showCurrencySymbol')!.value ?? true;

    this.errorMessage.set(null);
    const parsed = parseInput(rawValue);

    if (parsed instanceof Error) {
      this.errorMessage.set(parsed.message);
      this.result.set(null);
      return;
    }

    const localeDefinition = LOCALES.find((item) => item.id === locale) ?? LOCALES[0];
    const currencyDefinition = CURRENCIES.find((item) => item.code === currency) ?? CURRENCIES[0];

    try {
      const converter = new NumberToWordsConverter({
        locale: localeDefinition,
        currency: currencyDefinition,
        includeAnd,
        includeCents,
        handleNegative,
        showCurrencySymbol,
        caseStyle,
        format
      });
      const output = converter.convert(parsed);

      const result: ConversionResult = {
        text: output,
        input: rawValue,
        locale: locale,
        format,
        timestamp: Date.now(),
        caseStyle,
        includeAnd,
        includeCents,
        handleNegative,
        showCurrencySymbol,
        currency: currencyDefinition.code
      };

      this.result.set(result);
      this.pushHistory(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to process number.';
      this.errorMessage.set(message);
      this.result.set(null);
    }
  }

  private pushHistory(entry: ConversionResult): void {
    this.historyEntries.update((current) => {
      const filtered = current.filter(
        (item) => !(item.input === entry.input && item.locale === entry.locale && item.format === entry.format)
      );
      const next = [{ ...entry }, ...filtered];
      return next.slice(0, this.maxHistoryEntries);
    });
  }

  private notify(message: string): void {
    this.statusMessage.set(message);
    setTimeout(() => this.statusMessage.set(null), 3500);
  }

  private copyWithFallback(text: string): void {
    this.isCopySuccess.set(false);
    this.notify('Clipboard unavailable in this environment.');
  }

  readonly trackLocale = (_: number, locale: LocaleDefinition) => locale.id;
  readonly trackFormat = (_: number, option: FormatOption) => option.id;
  readonly trackCaseStyle = (_: number, option: CaseStyleOption) => option.id;
  readonly trackCurrency = (_: number, currency: CurrencyDefinition) => currency.code;
  readonly trackSample = (_: number, sample: SampleNumber) => sample.label;
  readonly trackHistory = (_: number, history: ConversionHistory) => `${history.input}-${history.locale}-${history.format}-${history.timestamp}`;
}

type LocaleCode = 'en-US' | 'en-UK' | 'en-IN';
type CurrencyCode = 'USD' | 'EUR' | 'GBP' | 'INR';
type NumberFormat = 'cardinal' | 'ordinal' | 'currency';
type CaseStyle = 'sentence' | 'title' | 'upper' | 'lower';

interface FormatOption {
  id: NumberFormat;
  label: string;
  description: string;
  icon: string;
}

interface CaseStyleOption {
  id: CaseStyle;
  label: string;
  description: string;
}

interface LocaleDefinition {
  id: LocaleCode;
  label: string;
  sample: string;
  groupSeparator: string;
  decimalSeparator: string;
  scale: ScaleDefinition;
  ordinalSupport: boolean;
}

interface ScaleDefinition {
  thousands: string[];
  primaryGroupSize: number;
  secondaryGroupSize?: number;
}

interface CurrencyDefinition {
  code: CurrencyCode;
  label: string;
  majorSingular: string;
  majorPlural: string;
  minorSingular: string;
  minorPlural: string;
  symbol: string;
  supportedLocales: LocaleCode[];
}

interface ConversionResult {
  text: string;
  input: string;
  locale: LocaleCode;
  format: NumberFormat;
  timestamp: number;
  caseStyle: CaseStyle;
  includeAnd: boolean;
  includeCents: boolean;
  handleNegative: boolean;
  showCurrencySymbol: boolean;
  currency: CurrencyCode;
}

interface ConversionHistory extends ConversionResult {}

interface SampleNumber {
  label: string;
  value: string;
  format?: NumberFormat;
  locale?: LocaleCode;
  currency?: CurrencyCode;
}

interface ConverterOptions {
  locale: LocaleDefinition;
  currency: CurrencyDefinition;
  includeAnd: boolean;
  includeCents: boolean;
  handleNegative: boolean;
  showCurrencySymbol: boolean;
  caseStyle: CaseStyle;
  format: NumberFormat;
}

const FORMAT_OPTIONS: FormatOption[] = [
  {
    id: 'cardinal',
    label: 'Cardinal',
    description: 'Standard words, e.g. "one hundred twenty-three"',
    icon: 'words'
  },
  {
    id: 'ordinal',
    label: 'Ordinal',
    description: 'Positions, e.g. "one hundred twenty-third"',
    icon: 'list'
  },
  {
    id: 'currency',
    label: 'Currency',
    description: 'Money format, e.g. "one hundred dollars"',
    icon: 'currency'
  }
];

const CASE_STYLES: CaseStyleOption[] = [
  { id: 'sentence', label: 'Sentence case', description: 'Capitalise first word only.' },
  { id: 'title', label: 'Title Case', description: 'Capitalise principal words.' },
  { id: 'upper', label: 'UPPERCASE', description: 'All letters upper case.' },
  { id: 'lower', label: 'lowercase', description: 'All letters lower case.' }
];

const LOCALES: LocaleDefinition[] = [
  {
    id: 'en-US',
    label: 'English (United States)',
    sample: '1,234,567.89',
    groupSeparator: ',',
    decimalSeparator: '.',
    scale: {
      thousands: ['', 'thousand', 'million', 'billion', 'trillion', 'quadrillion'],
      primaryGroupSize: 3,
      secondaryGroupSize: 3
    },
    ordinalSupport: true
  },
  {
    id: 'en-UK',
    label: 'English (United Kingdom)',
    sample: '1 234 567.89',
    groupSeparator: ' ',
    decimalSeparator: '.',
    scale: {
      thousands: ['', 'thousand', 'million', 'billion', 'trillion', 'quadrillion'],
      primaryGroupSize: 3,
      secondaryGroupSize: 3
    },
    ordinalSupport: true
  },
  {
    id: 'en-IN',
    label: 'English (India)',
    sample: '1,23,45,678.90',
    groupSeparator: ',',
    decimalSeparator: '.',
    scale: {
      thousands: ['', 'thousand', 'lakh', 'crore', 'arab', 'kharab'],
      primaryGroupSize: 3,
      secondaryGroupSize: 2
    },
    ordinalSupport: true
  }
];

const CURRENCIES: CurrencyDefinition[] = [
  {
    code: 'USD',
    label: 'US Dollar',
    majorSingular: 'dollar',
    majorPlural: 'dollars',
    minorSingular: 'cent',
    minorPlural: 'cents',
    symbol: '$',
    supportedLocales: ['en-US', 'en-UK']
  },
  {
    code: 'EUR',
    label: 'Euro',
    majorSingular: 'euro',
    majorPlural: 'euros',
    minorSingular: 'cent',
    minorPlural: 'cents',
    symbol: '€',
    supportedLocales: ['en-US', 'en-UK']
  },
  {
    code: 'GBP',
    label: 'Pound Sterling',
    majorSingular: 'pound',
    majorPlural: 'pounds',
    minorSingular: 'penny',
    minorPlural: 'pence',
    symbol: '£',
    supportedLocales: ['en-UK']
  },
  {
    code: 'INR',
    label: 'Indian Rupee',
    majorSingular: 'rupee',
    majorPlural: 'rupees',
    minorSingular: 'paise',
    minorPlural: 'paise',
    symbol: '₹',
    supportedLocales: ['en-IN']
  }
];

const SAMPLE_NUMBERS: SampleNumber[] = [
  { label: 'Invoice total', value: '482356.71', format: 'currency', locale: 'en-US', currency: 'USD' },
  { label: 'Lottery prize', value: '305000000', format: 'cardinal', locale: 'en-US' },
  { label: 'Indian budget', value: '98765432', format: 'currency', locale: 'en-IN', currency: 'INR' },
  { label: 'Rank position', value: '112', format: 'ordinal', locale: 'en-UK' },
  { label: 'Negative balance', value: '-4520.5', format: 'currency', locale: 'en-US', currency: 'USD' },
  { label: 'Scientific', value: '1200000000000', format: 'cardinal', locale: 'en-US' }
];

class NumberToWordsConverter {
  private readonly locale: LocaleDefinition;
  private readonly currency: CurrencyDefinition;
  private readonly includeAnd: boolean;
  private readonly includeCents: boolean;
  private readonly handleNegative: boolean;
  private readonly showCurrencySymbol: boolean;
  private readonly caseStyle: CaseStyle;
  private readonly format: NumberFormat;

  constructor(private readonly options: ConverterOptions) {
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

    const decimalWords = decimalDigitsToWords(decimalPart, this.locale);
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
    const majorWords = integerPart === 0 ? `zero ${majorPlural}` : `${this.toWords(integerPart)} ${majorLabel}`;

    if (!this.includeCents || decimalPart === 0) {
      return this.showCurrencySymbol ? `${symbol} ${majorWords}` : majorWords;
    }

    const centsValue = Math.round(decimalPart * 100);
    const centsLabel = centsValue === 1 ? minorSingular : minorPlural;
    const centsWords = centsValue === 0 ? `zero ${minorPlural}` : `${this.toWords(centsValue)} ${centsLabel}`;

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

interface Chunk {
  value: number;
  scaleIndex: number;
}

function splitNumberIntoChunks(value: number, scale: ScaleDefinition): Chunk[] {
  const chunks: Chunk[] = [];
  let remaining = value;
  let index = 0;

  while (remaining > 0) {
    const groupSize =
      index === 0 ? scale.primaryGroupSize : scale.secondaryGroupSize ?? scale.primaryGroupSize;
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

function convertChunkToWords(value: number): string {
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

function convertCardinalToOrdinal(cardinal: string): string {
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

function decimalDigitsToWords(decimal: number, locale: LocaleDefinition): string {
  const digits = decimal.toString().split('.')[1] ?? '';
  const words = digits.split('').map((digit) => ONES[Number.parseInt(digit, 10)]);
  return words.join(' ');
}

function applyCaseStyle(value: string, style: CaseStyle): string {
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

function parseInput(value: string): number | Error {
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
