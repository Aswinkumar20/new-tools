import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AssetService, Navigation, ToastService, TooltipDirective } from '@tools-workspace/features-home';
import { debounceTime } from 'rxjs';
import {
  NUMBER_TO_WORDS_CASE_STYLES,
  NUMBER_TO_WORDS_DEFAULT_FORM,
  NUMBER_TO_WORDS_FORMAT_OPTIONS,
  NUMBER_TO_WORDS_HISTORY_LIMIT,
  NUMBER_TO_WORDS_INPUT_PATTERN,
  NUMBER_TO_WORDS_LOCALES,
  NUMBER_TO_WORDS_RELATED_TOOLS,
  NUMBER_TO_WORDS_SAMPLES
} from '../../constants/number-to-words.constants';
import { mdCopyText } from '../../shared/md-clipboard.util';
import type { MdRelatedToolLink } from '../../shared/md-tool-suggestion.model';
import type {
  CaseStyle,
  CaseStyleOption,
  ConversionHistory,
  ConversionResult,
  CurrencyCode,
  CurrencyDefinition,
  FormatOption,
  LocaleCode,
  LocaleDefinition,
  NumberFormat,
  NumberToWordsFormGroup,
  NumberToWordsFormValues,
  SampleNumber
} from '../../types/number-to-words.types';
import {
  convertNumberToWords,
  currenciesForLocale,
  formatOptionLabel,
  mapConversionError,
  parseNumberInput,
  resolveCurrency,
  resolveLocale,
  resolveNumberToWordsSuggestion
} from '../../utils/number-to-words.utils';

@Component({
  selector: 'lib-number-to-words',
  standalone: true,
  templateUrl: './number-to-words.html',
  styleUrls: ['./number-to-words.scss'],
  imports: [CommonModule, ReactiveFormsModule, RouterLink, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NumberToWordsComponent {
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  readonly assetService = inject(AssetService);

  readonly locales = NUMBER_TO_WORDS_LOCALES;
  readonly formats = NUMBER_TO_WORDS_FORMAT_OPTIONS;
  readonly caseStyles = NUMBER_TO_WORDS_CASE_STYLES;
  readonly sampleNumbers = NUMBER_TO_WORDS_SAMPLES;
  readonly relatedTools: ReadonlyArray<MdRelatedToolLink> = NUMBER_TO_WORDS_RELATED_TOOLS;

  readonly form: NumberToWordsFormGroup = this.fb.group({
    numericInput: this.fb.control(NUMBER_TO_WORDS_DEFAULT_FORM.numericInput, [
      Validators.required,
      Validators.pattern(NUMBER_TO_WORDS_INPUT_PATTERN)
    ]),
    locale: this.fb.control<LocaleCode>(NUMBER_TO_WORDS_DEFAULT_FORM.locale, {
      nonNullable: true
    }),
    format: this.fb.control<NumberFormat>(NUMBER_TO_WORDS_DEFAULT_FORM.format, {
      nonNullable: true
    }),
    currency: this.fb.control<CurrencyCode>(NUMBER_TO_WORDS_DEFAULT_FORM.currency, {
      nonNullable: true
    }),
    showCurrencySymbol: this.fb.control(NUMBER_TO_WORDS_DEFAULT_FORM.showCurrencySymbol, {
      nonNullable: true
    }),
    includeCents: this.fb.control(NUMBER_TO_WORDS_DEFAULT_FORM.includeCents, {
      nonNullable: true
    }),
    caseStyle: this.fb.control<CaseStyle>(NUMBER_TO_WORDS_DEFAULT_FORM.caseStyle, {
      nonNullable: true
    }),
    includeAnd: this.fb.control(NUMBER_TO_WORDS_DEFAULT_FORM.includeAnd, { nonNullable: true }),
    handleNegative: this.fb.control(NUMBER_TO_WORDS_DEFAULT_FORM.handleNegative, {
      nonNullable: true
    })
  });

  readonly result = signal<ConversionResult | null>(null);
  readonly errorMessage = signal<string | null>(null);
  readonly historyEntries = signal<ConversionHistory[]>([]);
  readonly formSnapshot = signal<NumberToWordsFormValues>(this.readFormValues());
  private readonly dismissedSuggestionId = signal<string | null>(null);

  readonly selectedLocale = computed(() => resolveLocale(this.formSnapshot().locale));

  readonly availableCurrencies = computed(() =>
    currenciesForLocale(this.formSnapshot().locale)
  );

  readonly formattedOutput = computed(() => this.result()?.text ?? '');

  readonly formatLabel = computed(() => formatOptionLabel(this.formSnapshot().format));

  readonly badgeMeta = computed(() => ({
    locale: this.selectedLocale().label,
    format: this.formatLabel(),
    historyCount: this.historyEntries().length
  }));

  readonly isCurrencyFormat = computed(() => this.formSnapshot().format === 'currency');

  readonly primarySuggestion = computed(() => {
    const current = this.result();
    const snapshot = this.formSnapshot();
    const parsed = parseNumberInput(snapshot.numericInput);
    const numericValue = typeof parsed === 'number' ? parsed : 0;

    const suggestion = resolveNumberToWordsSuggestion({
      hasResult: current !== null,
      hasError: this.errorMessage() !== null,
      format: snapshot.format,
      locale: snapshot.locale,
      numericInput: snapshot.numericInput,
      isNegative: numericValue < 0,
      hasDecimal: snapshot.numericInput.includes('.'),
      absoluteValue: Math.abs(numericValue)
    });

    if (!suggestion || this.dismissedSuggestionId() === suggestion.id) {
      return null;
    }
    return suggestion;
  });

  constructor() {
    this.form.valueChanges.pipe(debounceTime(120), takeUntilDestroyed()).subscribe(() => {
      this.formSnapshot.set(this.readFormValues());
      this.convert();
    });

    this.convert();
  }

  applySample(sample: SampleNumber): void {
    this.form.patchValue(
      {
        numericInput: sample.value,
        format: sample.format ?? this.form.controls.format.value,
        locale: sample.locale ?? this.form.controls.locale.value,
        currency: sample.currency ?? this.form.controls.currency.value
      },
      { emitEvent: true }
    );
    this.toast.info(`Sample ${sample.label} applied.`);
  }

  async copyToClipboard(): Promise<void> {
    const text = this.formattedOutput();
    if (!text) {
      this.toast.info('Nothing to copy yet.');
      return;
    }
    await mdCopyText(this.toast, text, 'Output');
  }

  clearHistory(): void {
    this.historyEntries.set([]);
    this.toast.info('History cleared.');
  }

  resetToDefault(): void {
    this.form.patchValue({ ...NUMBER_TO_WORDS_DEFAULT_FORM }, { emitEvent: true });
    this.toast.info('Reset to default values.');
  }

  submitForm(): void {
    this.convert();
    this.toast.info('Conversion refreshed.');
  }

  setFormat(format: NumberFormat): void {
    if (this.form.controls.format.value === format) {
      return;
    }
    this.form.patchValue({ format }, { emitEvent: true });
  }

  setCaseStyle(style: CaseStyle): void {
    if (this.form.controls.caseStyle.value === style) {
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
        currency: entry.currency ?? this.form.controls.currency.value,
        caseStyle: entry.caseStyle,
        includeAnd: entry.includeAnd,
        handleNegative: entry.handleNegative,
        includeCents: entry.includeCents,
        showCurrencySymbol: entry.showCurrencySymbol
      },
      { emitEvent: true }
    );
    this.toast.info('History entry restored.');
  }

  dismissSuggestion(suggestionId: string): void {
    this.dismissedSuggestionId.set(suggestionId);
  }

  readonly trackLocale = (_: number, locale: LocaleDefinition): LocaleCode => locale.id;
  readonly trackFormat = (_: number, option: FormatOption): NumberFormat => option.id;
  readonly trackCaseStyle = (_: number, option: CaseStyleOption): CaseStyle => option.id;
  readonly trackCurrency = (_: number, currency: CurrencyDefinition): CurrencyCode => currency.code;
  readonly trackSample = (_: number, sample: SampleNumber): string => sample.label;
  readonly trackHistory = (_: number, history: ConversionHistory): string =>
    `${history.input}-${history.locale}-${history.format}-${history.timestamp}`;

  private convert(): void {
    const snapshot = this.readFormValues();
    this.errorMessage.set(null);

    const parsed = parseNumberInput(snapshot.numericInput);
    if (parsed instanceof Error) {
      this.errorMessage.set(parsed.message);
      this.result.set(null);
      return;
    }

    const localeDefinition = resolveLocale(snapshot.locale);
    const currencyDefinition = resolveCurrency(snapshot.currency);

    try {
      const output = convertNumberToWords(parsed, {
        locale: localeDefinition,
        currency: currencyDefinition,
        includeAnd: snapshot.includeAnd,
        includeCents: snapshot.includeCents,
        handleNegative: snapshot.handleNegative,
        showCurrencySymbol: snapshot.showCurrencySymbol,
        caseStyle: snapshot.caseStyle,
        format: snapshot.format
      });

      const conversionResult: ConversionResult = {
        text: output,
        input: snapshot.numericInput,
        locale: snapshot.locale,
        format: snapshot.format,
        timestamp: Date.now(),
        caseStyle: snapshot.caseStyle,
        includeAnd: snapshot.includeAnd,
        includeCents: snapshot.includeCents,
        handleNegative: snapshot.handleNegative,
        showCurrencySymbol: snapshot.showCurrencySymbol,
        currency: currencyDefinition.code
      };

      this.result.set(conversionResult);
      this.pushHistory(conversionResult);
    } catch (error) {
      this.errorMessage.set(mapConversionError(error));
      this.result.set(null);
    }
  }

  private pushHistory(entry: ConversionResult): void {
    this.historyEntries.update((current) => {
      const filtered = current.filter(
        (item) =>
          !(item.input === entry.input && item.locale === entry.locale && item.format === entry.format)
      );
      return [{ ...entry }, ...filtered].slice(0, NUMBER_TO_WORDS_HISTORY_LIMIT);
    });
  }

  private readFormValues(): NumberToWordsFormValues {
    return {
      numericInput: this.form.controls.numericInput.value ?? '',
      locale: this.form.controls.locale.value,
      format: this.form.controls.format.value,
      currency: this.form.controls.currency.value,
      showCurrencySymbol: this.form.controls.showCurrencySymbol.value,
      includeCents: this.form.controls.includeCents.value,
      caseStyle: this.form.controls.caseStyle.value,
      includeAnd: this.form.controls.includeAnd.value,
      handleNegative: this.form.controls.handleNegative.value
    };
  }
}
