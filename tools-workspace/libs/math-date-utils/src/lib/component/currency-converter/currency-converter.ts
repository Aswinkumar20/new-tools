import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, Injectable, computed, inject, signal, WritableSignal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
// eslint-disable-next-line deprecation/deprecation
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { Navigation } from '@tools-workspace/features-home';
import { catchError, debounceTime, distinctUntilChanged, map, of, Subject, switchMap, tap, throwError, timer } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

interface RateSnapshot {
  base: string;
  timestamp: number;
  rates: Record<string, number>;
  provider: string;
}

interface ExchangeApiResponse {
  result: string;
  base_code: string;
  time_last_update_unix: number;
  rates: Record<string, number>;
}

interface FallbackApiResponse {
  base: string;
  rates: Record<string, number>;
  date: string;
}

interface CurrencyDescriptor {
  code: string;
  name: string;
  symbol?: string;
}

interface ConversionResult {
  baseCurrency: string;
  quoteCurrency: string;
  rate: number;
  inverseRate: number;
  convertedAmount: number;
  feeAmount: number;
  amountAfterFee: number;
  timestamp: number;
  provider: string;
}

interface WatchlistEntry {
  code: string;
  name: string;
  rate?: number;
  changePercent?: number;
  lastUpdated?: number;
}

interface MoverEntry {
  code: string;
  name: string;
  rate: number;
  changePercent: number;
}

const REFRESH_INTERVAL_MS = 180_000; // 3 minutes
const DEFAULT_BASE = 'USD';
const DEFAULT_QUOTE = 'EUR';
const DEFAULT_WATCHLIST = ['EUR', 'GBP', 'JPY', 'INR', 'AUD', 'CAD'];

const CURRENCY_METADATA: CurrencyDescriptor[] = [
  { code: 'USD', name: 'United States Dollar', symbol: '$' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'GBP', name: 'British Pound Sterling', symbol: '£' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
  { code: 'AUD', name: 'Australian Dollar', symbol: '$' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: '$' },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'Fr' },
  { code: 'NZD', name: 'New Zealand Dollar', symbol: '$' },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥' },
  { code: 'HKD', name: 'Hong Kong Dollar', symbol: '$' },
  { code: 'SGD', name: 'Singapore Dollar', symbol: '$' },
  { code: 'KRW', name: 'South Korean Won', symbol: '₩' },
  { code: 'BRL', name: 'Brazilian Real', symbol: 'R$' },
  { code: 'MXN', name: 'Mexican Peso', symbol: '$' },
  { code: 'ZAR', name: 'South African Rand', symbol: 'R' },
  { code: 'SEK', name: 'Swedish Krona', symbol: 'kr' },
  { code: 'DKK', name: 'Danish Krone', symbol: 'kr' },
  { code: 'NOK', name: 'Norwegian Krone', symbol: 'kr' },
  { code: 'PLN', name: 'Polish Złoty', symbol: 'zł' },
  { code: 'TRY', name: 'Turkish Lira', symbol: '₺' },
  { code: 'THB', name: 'Thai Baht', symbol: '฿' },
  { code: 'IDR', name: 'Indonesian Rupiah', symbol: 'Rp' },
  { code: 'MYR', name: 'Malaysian Ringgit', symbol: 'RM' },
  { code: 'PHP', name: 'Philippine Peso', symbol: '₱' },
  { code: 'AED', name: 'United Arab Emirates Dirham', symbol: 'د.إ' },
  { code: 'SAR', name: 'Saudi Riyal', symbol: '﷼' },
  { code: 'ILS', name: 'Israeli New Shekel', symbol: '₪' },
  { code: 'CLP', name: 'Chilean Peso', symbol: '$' },
  { code: 'COP', name: 'Colombian Peso', symbol: '$' },
  { code: 'VND', name: 'Vietnamese Đồng', symbol: '₫' },
  { code: 'NGN', name: 'Nigerian Naira', symbol: '₦' },
  { code: 'EGP', name: 'Egyptian Pound', symbol: '£' },
  { code: 'KES', name: 'Kenyan Shilling', symbol: 'KSh' },
  { code: 'ARS', name: 'Argentine Peso', symbol: '$' },
  { code: 'BDT', name: 'Bangladeshi Taka', symbol: '৳' },
  { code: 'PKR', name: 'Pakistani Rupee', symbol: '₨' },
  { code: 'UAH', name: 'Ukrainian Hryvnia', symbol: '₴' },
  { code: 'HUF', name: 'Hungarian Forint', symbol: 'Ft' },
  { code: 'CZK', name: 'Czech Koruna', symbol: 'Kč' },
  { code: 'RON', name: 'Romanian Leu', symbol: 'lei' },
  { code: 'HRK', name: 'Croatian Kuna', symbol: 'kn' },
  { code: 'RSD', name: 'Serbian Dinar', symbol: 'дин.' },
  { code: 'BGN', name: 'Bulgarian Lev', symbol: 'лв' },
  { code: 'GHS', name: 'Ghanaian Cedi', symbol: '₵' },
  { code: 'MAD', name: 'Moroccan Dirham', symbol: 'د.م.' },
  { code: 'QAR', name: 'Qatari Riyal', symbol: 'ر.ق' },
  { code: 'LKR', name: 'Sri Lankan Rupee', symbol: 'Rs' },
  { code: 'TWD', name: 'New Taiwan Dollar', symbol: 'NT$' },
  { code: 'HKD', name: 'Hong Kong Dollar', symbol: '$' },
  { code: 'BHD', name: 'Bahraini Dinar', symbol: 'ب.د' }
];

@Injectable()
class CurrencyRateService {
  private readonly http = inject(HttpClient);
  private readonly cache = new Map<string, RateSnapshot>();

  fetchLatestRates(base: string, forceRefresh = false) {
    const normalizedBase = base.toUpperCase();
    const cached = this.cache.get(normalizedBase);
    const now = Date.now();
    if (cached && !forceRefresh && now - cached.timestamp < 60_000) {
      return of(cached);
    }

    const fallback$ = this.http
      .get<FallbackApiResponse>(`https://api.exchangerate.host/latest?base=${normalizedBase}`)
      .pipe(
        map((response) => mapFallbackResponse(response)),
        catchError(() => throwError(() => new Error('Unable to fetch currency rates at this time.')))
      );

    return this.http
      .get<ExchangeApiResponse>(`https://open.er-api.com/v6/latest/${normalizedBase}`)
      .pipe(
        map((resp) => {
          const base = resp?.base_code;
          const timestamp = resp?.time_last_update_unix;
          const rates = resp?.rates;
          if (resp?.result !== 'success' || !base || !timestamp || !rates) {
            throw new Error('Primary provider error');
          }
          return {
            base,
            timestamp: timestamp * 1000,
            rates,
            provider: 'open.er-api.com'
          } satisfies RateSnapshot;
        }),
        catchError(() => fallback$),
        tap((snapshot) => this.cache.set(snapshot.base, snapshot))
      );
  }
}

const mapFallbackResponse = (response: FallbackApiResponse): RateSnapshot => {
  if (!response?.base || !response?.rates) {
    throw new Error('Unable to fetch currency rates.');
  }
  return {
    base: response.base,
    timestamp: Date.now(),
    rates: response.rates,
    provider: 'exchangerate.host'
  };
};

@Component({
  selector: 'lib-currency-converter',
  standalone: true,
  templateUrl: './currency-converter.html',
  styleUrls: ['./currency-converter.scss'],
  // eslint-disable-next-line deprecation/deprecation
  imports: [CommonModule, ReactiveFormsModule, HttpClientModule, Navigation],
  providers: [CurrencyRateService],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CurrencyConverterComponent {
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly rateService = inject(CurrencyRateService);

  private readonly refreshTrigger = new Subject<{ base: string; force?: boolean }>();
  private readonly latestSnapshots = new Map<string, RateSnapshot>();
  private readonly previousSnapshots = new Map<string, RateSnapshot>();
  private readonly previousPairRates = new Map<string, number>();
  private readonly currencyMap = new Map<string, CurrencyDescriptor>(CURRENCY_METADATA.map((item) => [item.code, item]));

  readonly form = this.fb.group({
    amount: this.fb.control('100', [Validators.required, numberValidator, Validators.min(0)]),
    fromCurrency: this.fb.control(DEFAULT_BASE, Validators.required),
    toCurrency: this.fb.control(DEFAULT_QUOTE, Validators.required),
    includeFees: this.fb.control(false),
    feePercent: this.fb.control({ value: '0.5', disabled: true }, [numberValidator, Validators.min(0)]),
    currencySearch: this.fb.control('')
  });

  readonly loadingRates = signal(false);
  readonly rateError = signal<string | null>(null);
  readonly lastUpdated = signal<number | null>(null);
  readonly conversionResult: WritableSignal<ConversionResult | null> = signal(null);
  readonly insights = signal<string[]>([]);
  readonly topMovers = signal<MoverEntry[]>([]);
  readonly watchlist: WritableSignal<WatchlistEntry[]> = signal(DEFAULT_WATCHLIST.map((code) => this.createWatchlistEntry(code)));
  readonly currentSnapshot = signal<RateSnapshot | null>(null);
  readonly providerName = computed(() => this.currentSnapshot()?.provider ?? '—');
  readonly refreshIntervalMinutes = REFRESH_INTERVAL_MS / 60000;

  readonly currencyCatalog = signal<CurrencyDescriptor[]>(this.buildInitialCatalog());
  readonly filteredCurrencies = computed(() => {
    const term = (this.form.get('currencySearch')?.value ?? '').toString().trim().toLowerCase();
    const catalog = this.currencyCatalog();
    if (!term) {
      return catalog;
    }
    return catalog.filter((item) => item.code.toLowerCase().includes(term) || item.name.toLowerCase().includes(term));
  });

  readonly availableCodes = computed(() => this.currencyCatalog().map((item) => item.code));
  readonly math = Math;

  constructor() {
    this.refreshTrigger
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        tap(() => {
          this.loadingRates.set(true);
          this.rateError.set(null);
        }),
        switchMap(({ base, force }) =>
          this.rateService.fetchLatestRates(base, !!force).pipe(
            catchError((error) => {
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
        this.updateTopMovers(snapshot, this.previousSnapshots.get(snapshot.base));
        this.updateWatchlistRates(snapshot, this.previousSnapshots.get(snapshot.base));
        this.calculateConversion();
      });

    this.form
      .get('fromCurrency')!
      .valueChanges.pipe(distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => {
        this.triggerRefresh(value ?? DEFAULT_BASE, true);
      });

    this.form
      .get('includeFees')!
      .valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((include) => {
        const feeControl = this.form.get('feePercent');
        if (!feeControl) {
          return;
        }
        if (include) {
          feeControl.enable({ emitEvent: false });
        } else {
          feeControl.disable({ emitEvent: false });
        }
        this.calculateConversion();
      });

    this.form
      .valueChanges.pipe(debounceTime(120), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.calculateConversion());

    this.form
      .get('currencySearch')!
      .valueChanges.pipe(debounceTime(120), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        /* re-computed via signal */
      });

    timer(0, REFRESH_INTERVAL_MS)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.triggerRefresh(this.form.get('fromCurrency')?.value ?? DEFAULT_BASE);
      });
  }

  refreshRates(force = false): void {
    this.triggerRefresh(this.form.get('fromCurrency')?.value ?? DEFAULT_BASE, force);
  }

  swapCurrencies(): void {
    const from = this.form.get('fromCurrency')?.value ?? DEFAULT_BASE;
    const to = this.form.get('toCurrency')?.value ?? DEFAULT_QUOTE;
    this.form.patchValue({ fromCurrency: to, toCurrency: from });
  }

  convertNow(): void {
    this.calculateConversion();
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
    this.watchlist.update((current) => [...current, this.createWatchlistEntry(normalized)]);
    const snapshot = this.latestSnapshots.get(this.form.get('fromCurrency')?.value ?? DEFAULT_BASE);
    if (snapshot) {
      this.updateWatchlistRates(snapshot, this.previousSnapshots.get(snapshot.base));
    }
  }

  removeFromWatchlist(code: string): void {
    const normalized = code.toUpperCase();
    this.watchlist.update((current) => current.filter((entry) => entry.code !== normalized));
  }

  isWatchlisted(code: string): boolean {
    return this.watchlist().some((entry) => entry.code === code.toUpperCase());
  }

  formatTimestamp(timestamp: number | null | undefined): string {
    if (!timestamp) {
      return '—';
    }
    return new Date(timestamp).toLocaleTimeString();
  }

  private triggerRefresh(base: string, force = false): void {
    this.refreshTrigger.next({ base: base.toUpperCase(), force });
  }

  private calculateConversion(): void {
    const snapshot = this.latestSnapshots.get((this.form.get('fromCurrency')?.value ?? DEFAULT_BASE).toUpperCase());
    if (!snapshot) {
      this.conversionResult.set(null);
      return;
    }

    const amount = toNumber(this.form.get('amount')?.value);
    const fromCurrency = (this.form.get('fromCurrency')?.value ?? DEFAULT_BASE).toUpperCase();
    const toCurrency = (this.form.get('toCurrency')?.value ?? DEFAULT_QUOTE).toUpperCase();
    const includeFees = !!this.form.get('includeFees')?.value;
    const feePercent = includeFees ? toNumber(this.form.get('feePercent')?.value) / 100 : 0;

    let rate = snapshot.rates[toCurrency];
    if (toCurrency === fromCurrency) {
      rate = 1;
    }
    if (!rate) {
      this.rateError.set(`No exchange rate available for ${fromCurrency} → ${toCurrency}.`);
      this.conversionResult.set(null);
      return;
    }

    const feeAmount = includeFees ? amount * feePercent : 0;
    const amountAfterFee = Math.max(amount - feeAmount, 0);
    const convertedAmount = amountAfterFee * rate;
    const inverseRate = rate > 0 ? 1 / rate : 0;

    const result: ConversionResult = {
      baseCurrency: fromCurrency,
      quoteCurrency: toCurrency,
      rate,
      inverseRate,
      convertedAmount,
      feeAmount,
      amountAfterFee,
      timestamp: snapshot.timestamp,
      provider: snapshot.provider
    };

    const pairKey = `${fromCurrency}_${toCurrency}`;
    const previousRate = this.previousPairRates.get(pairKey);
    this.previousPairRates.set(pairKey, rate);

    this.conversionResult.set(result);
    this.rateError.set(null);
    this.insights.set(buildConversionInsights(result, previousRate));
  }

  private buildInitialCatalog(): CurrencyDescriptor[] {
    return [...this.currencyMap.values()].sort((a, b) => a.code.localeCompare(b.code));
  }

  private mergeCurrencies(codes: string[]): void {
    let updated = false;
    for (const code of codes) {
      if (!this.currencyMap.has(code)) {
        this.currencyMap.set(code, { code, name: code });
        updated = true;
      }
    }
    if (updated) {
      this.currencyCatalog.set([...this.currencyMap.values()].sort((a, b) => a.code.localeCompare(b.code)));
    }
  }

  private updateTopMovers(snapshot: RateSnapshot, previous?: RateSnapshot): void {
    if (!previous) {
      const movers = Object.entries(snapshot.rates)
        .slice(0, 6)
        .map(([code, rate]) => ({
          code,
          name: this.currencyMap.get(code)?.name ?? code,
          rate,
          changePercent: 0
        }));
      this.topMovers.set(movers);
      return;
    }

    const changes: MoverEntry[] = [];
    for (const [code, currentRate] of Object.entries(snapshot.rates)) {
      const prevRate = previous.rates[code];
      if (!prevRate) {
        continue;
      }
      const changePercent = prevRate === 0 ? 0 : ((currentRate - prevRate) / prevRate) * 100;
      changes.push({
        code,
        name: this.currencyMap.get(code)?.name ?? code,
        rate: currentRate,
        changePercent
      });
    }

    changes.sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent));
    this.topMovers.set(changes.slice(0, 6));
  }

  private updateWatchlistRates(snapshot: RateSnapshot, previous?: RateSnapshot): void {
    this.watchlist.update((current) =>
      current.map((entry) => {
        const rate = entry.code === snapshot.base ? 1 : snapshot.rates[entry.code];
        const prevRate = previous?.rates[entry.code];
        const changePercent = prevRate && rate ? ((rate - prevRate) / prevRate) * 100 : undefined;
        return {
          ...entry,
          rate,
          changePercent,
          lastUpdated: snapshot.timestamp,
          name: this.currencyMap.get(entry.code)?.name ?? entry.name
        };
      })
    );
  }

  private createWatchlistEntry(code: string): WatchlistEntry {
    const descriptor = this.currencyMap.get(code) ?? { code, name: code };
    return { code: descriptor.code, name: descriptor.name };
  }
}

function buildConversionInsights(result: ConversionResult, previousRate?: number): string[] {
  const items: string[] = [
    `1 ${result.baseCurrency} ≈ ${result.rate.toFixed(6)} ${result.quoteCurrency}.`,
    `Inverse rate: 1 ${result.quoteCurrency} ≈ ${result.inverseRate.toFixed(6)} ${result.baseCurrency}.`
  ];

  if (result.feeAmount > 0) {
    items.push(`Applied fees remove ${result.feeAmount.toFixed(2)} ${result.baseCurrency}, converting ${result.amountAfterFee.toFixed(2)} ${result.baseCurrency}.`);
  }

  items.push(`Converted total: ${result.convertedAmount.toFixed(2)} ${result.quoteCurrency}.`);

  if (previousRate) {
    const changePercent = previousRate === 0 ? 0 : ((result.rate - previousRate) / previousRate) * 100;
    items.push(`Rate changed by ${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(4)}% since last calculation.`);
  }

  return items;
}

function numberValidator(control: import('@angular/forms').AbstractControl) {
  const raw = control.value;
  if (raw === null || raw === undefined || raw === '') {
    return null;
  }
  const value = toNumber(raw);
  if (!Number.isFinite(value)) {
    return { number: true };
  }
  return null;
}

function toNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined) {
    return 0;
  }
  if (typeof value === 'number') {
    return value;
  }
  const normalized = value.split(',').join('').trim();
  return normalized ? Number.parseFloat(normalized) : 0;
}
