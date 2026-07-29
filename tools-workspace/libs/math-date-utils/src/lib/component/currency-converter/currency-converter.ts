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
import { Subject, catchError, debounceTime, distinctUntilChanged, of, switchMap, tap, timer } from 'rxjs';
import {
  CURRENCY_DEFAULT_AMOUNT,
  CURRENCY_DEFAULT_BASE,
  CURRENCY_DEFAULT_FEE_PERCENT,
  CURRENCY_DEFAULT_QUOTE,
  CURRENCY_DEFAULT_WATCHLIST,
  CURRENCY_METADATA,
  CURRENCY_REFRESH_INTERVAL_MS,
  CURRENCY_RELATED_TOOLS
} from '../../constants/currency-converter.constants';
import { CurrencyRateService } from '../../services/currency-rate.service';
import { mdCopyText } from '../../shared/md-clipboard.util';
import type { MdRelatedToolLink } from '../../shared/md-tool-suggestion.model';
import type {
  ConversionResult,
  CurrencyConverterFormGroup,
  CurrencyConverterFormValues,
  CurrencyDescriptor,
  MoverEntry,
  RateSnapshot,
  WatchlistEntry
} from '../../types/currency-converter.types';
import {
  buildConversionInsights,
  buildCurrencyMap,
  buildTopMovers,
  calculateCurrencyConversion,
  createWatchlistEntry,
  formatConversionResultText,
  formatRateTimestamp,
  mergeCurrencyCodes,
  numberValidator,
  resolveCurrencySuggestion,
  sortCurrencyCatalog,
  toNumber,
  updateWatchlistEntries
} from '../../utils/currency-converter.utils';

@Component({
  selector: 'lib-currency-converter',
  standalone: true,
  templateUrl: './currency-converter.html',
  styleUrls: ['./currency-converter.scss'],
  imports: [CommonModule, ReactiveFormsModule, RouterLink, Navigation, TooltipDirective],
  providers: [CurrencyRateService],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CurrencyConverterComponent {
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  private readonly rateService = inject(CurrencyRateService);
  readonly assetService = inject(AssetService);

  private readonly refreshTrigger = new Subject<{ base: string; force?: boolean }>();
  private readonly latestSnapshots = new Map<string, RateSnapshot>();
  private readonly previousSnapshots = new Map<string, RateSnapshot>();
  private readonly previousPairRates = new Map<string, number>();
  private readonly currencyMap = buildCurrencyMap(CURRENCY_METADATA);

  readonly relatedTools: ReadonlyArray<MdRelatedToolLink> = CURRENCY_RELATED_TOOLS;
  readonly refreshIntervalMinutes = CURRENCY_REFRESH_INTERVAL_MS / 60000;

  readonly form: CurrencyConverterFormGroup = this.fb.group({
    amount: this.fb.control(CURRENCY_DEFAULT_AMOUNT, [
      Validators.required,
      numberValidator,
      Validators.min(0)
    ]),
    fromCurrency: this.fb.control(CURRENCY_DEFAULT_BASE, Validators.required),
    toCurrency: this.fb.control(CURRENCY_DEFAULT_QUOTE, Validators.required),
    includeFees: this.fb.control(false),
    feePercent: this.fb.control({ value: CURRENCY_DEFAULT_FEE_PERCENT, disabled: true }, [
      numberValidator,
      Validators.min(0)
    ]),
    currencySearch: this.fb.control('')
  });

  readonly loadingRates = signal(false);
  readonly rateError = signal<string | null>(null);
  readonly lastUpdated = signal<number | null>(null);
  readonly conversionResult = signal<ConversionResult | null>(null);
  readonly insights = signal<string[]>([]);
  readonly topMovers = signal<MoverEntry[]>([]);
  readonly watchlist = signal<WatchlistEntry[]>(
    CURRENCY_DEFAULT_WATCHLIST.map((code) => createWatchlistEntry(code, this.currencyMap))
  );
  readonly currentSnapshot = signal<RateSnapshot | null>(null);
  readonly currencyCatalog = signal<CurrencyDescriptor[]>(sortCurrencyCatalog(this.currencyMap));
  readonly formSnapshot = signal<CurrencyConverterFormValues>(this.readFormValues());
  private readonly dismissedSuggestionId = signal<string | null>(null);

  readonly providerName = computed(() => this.currentSnapshot()?.provider ?? '—');

  readonly primarySuggestion = computed(() => {
    const result = this.conversionResult();
    const snapshot = this.formSnapshot();
    const suggestion = resolveCurrencySuggestion({
      hasResult: result !== null,
      hasError: this.rateError() !== null,
      fromCurrency: snapshot.fromCurrency,
      toCurrency: snapshot.toCurrency,
      includeFees: snapshot.includeFees,
      amount: toNumber(snapshot.amount),
      convertedAmount: result?.convertedAmount ?? 0
    });

    if (!suggestion || this.dismissedSuggestionId() === suggestion.id) {
      return null;
    }
    return suggestion;
  });

  constructor() {
    this.refreshTrigger
      .pipe(
        takeUntilDestroyed(),
        tap(() => {
          this.loadingRates.set(true);
          this.rateError.set(null);
        }),
        switchMap(({ base, force }) =>
          this.rateService.fetchLatestRates(base, !!force).pipe(
            catchError((error: { message?: string }) => {
              this.rateError.set(error?.message ?? 'Unable to refresh rates.');
              this.loadingRates.set(false);
              return of<RateSnapshot | null>(null);
            })
          )
        )
      )
      .subscribe((snapshot) => {
        if (!snapshot) {
          return;
        }
        const previous = this.latestSnapshots.get(snapshot.base);
        if (previous) {
          this.previousSnapshots.set(snapshot.base, previous);
        }
        this.latestSnapshots.set(snapshot.base, snapshot);
        this.currentSnapshot.set(snapshot);
        this.lastUpdated.set(snapshot.timestamp);
        this.loadingRates.set(false);
        this.mergeCurrencies(Object.keys(snapshot.rates).concat(snapshot.base));
        this.topMovers.set(
          buildTopMovers(snapshot, this.currencyMap, this.previousSnapshots.get(snapshot.base))
        );
        this.watchlist.update((current) =>
          updateWatchlistEntries(
            current,
            snapshot,
            this.currencyMap,
            this.previousSnapshots.get(snapshot.base)
          )
        );
        this.recalculateConversion();
      });

    this.form.controls.fromCurrency.valueChanges
      .pipe(distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((value) => {
        this.triggerRefresh(value ?? CURRENCY_DEFAULT_BASE, true);
      });

    this.form.controls.includeFees.valueChanges.pipe(takeUntilDestroyed()).subscribe((include) => {
      const feeControl = this.form.controls.feePercent;
      if (include) {
        feeControl.enable({ emitEvent: false });
      } else {
        feeControl.disable({ emitEvent: false });
      }
      this.formSnapshot.set(this.readFormValues());
      this.recalculateConversion();
    });

    this.form.valueChanges.pipe(debounceTime(120), takeUntilDestroyed()).subscribe(() => {
      this.formSnapshot.set(this.readFormValues());
      this.recalculateConversion();
    });

    timer(0, CURRENCY_REFRESH_INTERVAL_MS)
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        this.triggerRefresh(this.form.controls.fromCurrency.value ?? CURRENCY_DEFAULT_BASE);
      });
  }

  refreshRates(force = false): void {
    this.triggerRefresh(this.form.controls.fromCurrency.value ?? CURRENCY_DEFAULT_BASE, force);
    if (force) {
      this.toast.info('Refreshing exchange rates…');
    }
  }

  swapCurrencies(): void {
    const from = this.form.controls.fromCurrency.value ?? CURRENCY_DEFAULT_BASE;
    const to = this.form.controls.toCurrency.value ?? CURRENCY_DEFAULT_QUOTE;
    this.form.patchValue({ fromCurrency: to, toCurrency: from });
    this.toast.info(`Swapped to ${to} → ${from}.`);
  }

  convertNow(): void {
    this.recalculateConversion();
    this.toast.info('Conversion updated.');
  }

  async copyResult(): Promise<void> {
    const result = this.conversionResult();
    if (!result) {
      return;
    }
    const amount = this.form.controls.amount.value ?? 0;
    await mdCopyText(this.toast, formatConversionResultText(result, amount), 'Result');
  }

  setToCurrency(code: string): void {
    this.form.patchValue({ toCurrency: code });
  }

  setFromCurrency(code: string): void {
    this.form.patchValue({ fromCurrency: code });
  }

  addToWatchlist(code: string): void {
    const normalized = code.toUpperCase();
    if (this.watchlist().some((item) => item.code === normalized)) {
      return;
    }
    this.watchlist.update((current) => [
      ...current,
      createWatchlistEntry(normalized, this.currencyMap)
    ]);
    const snapshot = this.latestSnapshots.get(
      this.form.controls.fromCurrency.value ?? CURRENCY_DEFAULT_BASE
    );
    if (snapshot) {
      this.watchlist.update((current) =>
        updateWatchlistEntries(
          current,
          snapshot,
          this.currencyMap,
          this.previousSnapshots.get(snapshot.base)
        )
      );
    }
    this.toast.info(`${normalized} added to watchlist.`);
  }

  removeFromWatchlist(code: string): void {
    const normalized = code.toUpperCase();
    this.watchlist.update((current) => current.filter((entry) => entry.code !== normalized));
    this.toast.info(`${normalized} removed from watchlist.`);
  }

  isWatchlisted(code: string): boolean {
    return this.watchlist().some((entry) => entry.code === code.toUpperCase());
  }

  formatTimestamp(timestamp: number | null | undefined): string {
    return formatRateTimestamp(timestamp);
  }

  dismissSuggestion(suggestionId: string): void {
    this.dismissedSuggestionId.set(suggestionId);
  }

  private triggerRefresh(base: string, force = false): void {
    this.refreshTrigger.next({ base: base.toUpperCase(), force });
  }

  private recalculateConversion(): void {
    const fromCurrency = (
      this.form.controls.fromCurrency.value ?? CURRENCY_DEFAULT_BASE
    ).toUpperCase();
    const snapshot = this.latestSnapshots.get(fromCurrency);
    if (!snapshot) {
      this.conversionResult.set(null);
      return;
    }

    const amount = toNumber(this.form.controls.amount.value);
    const toCurrency = (this.form.controls.toCurrency.value ?? CURRENCY_DEFAULT_QUOTE).toUpperCase();
    const includeFees = !!this.form.controls.includeFees.value;
    const feePercent = includeFees ? toNumber(this.form.controls.feePercent.value) / 100 : 0;

    const conversion = calculateCurrencyConversion({
      snapshot,
      amount,
      fromCurrency,
      toCurrency,
      includeFees,
      feePercent
    });

    if ('error' in conversion) {
      this.rateError.set(conversion.error);
      this.conversionResult.set(null);
      return;
    }

    const pairKey = `${fromCurrency}_${toCurrency}`;
    const previousRate = this.previousPairRates.get(pairKey);
    this.previousPairRates.set(pairKey, conversion.rate);

    this.conversionResult.set(conversion);
    this.rateError.set(null);
    this.insights.set(buildConversionInsights(conversion, previousRate));
  }

  private mergeCurrencies(codes: string[]): void {
    if (mergeCurrencyCodes(this.currencyMap, codes)) {
      this.currencyCatalog.set(sortCurrencyCatalog(this.currencyMap));
    }
  }

  private readFormValues(): CurrencyConverterFormValues {
    const raw = this.form.getRawValue();
    return {
      amount: raw.amount ?? CURRENCY_DEFAULT_AMOUNT,
      fromCurrency: (raw.fromCurrency ?? CURRENCY_DEFAULT_BASE).toUpperCase(),
      toCurrency: (raw.toCurrency ?? CURRENCY_DEFAULT_QUOTE).toUpperCase(),
      includeFees: !!raw.includeFees,
      feePercent: raw.feePercent ?? CURRENCY_DEFAULT_FEE_PERCENT,
      currencySearch: raw.currencySearch ?? ''
    };
  }
}
