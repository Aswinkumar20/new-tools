import { AbstractControl, ValidationErrors } from '@angular/forms';
import { CURRENCY_TOP_MOVERS_LIMIT } from '../constants/currency-converter.constants';
import type { MdToolSuggestion } from '../shared/md-tool-suggestion.model';
import type {
  ConversionResult,
  CurrencyDescriptor,
  CurrencySuggestionContext,
  FallbackApiResponse,
  MoverEntry,
  RateSnapshot,
  WatchlistEntry
} from '../types/currency-converter.types';

export function mapFallbackRateResponse(response: FallbackApiResponse): RateSnapshot {
  if (!response?.base || !response?.rates) {
    throw new Error('Unable to fetch currency rates.');
  }
  return {
    base: response.base,
    timestamp: Date.now(),
    rates: response.rates,
    provider: 'exchangerate.host'
  };
}

export function buildCurrencyMap(
  metadata: ReadonlyArray<CurrencyDescriptor>
): Map<string, CurrencyDescriptor> {
  return new Map(metadata.map((item) => [item.code, item]));
}

export function sortCurrencyCatalog(
  currencyMap: Map<string, CurrencyDescriptor>
): CurrencyDescriptor[] {
  return [...currencyMap.values()].sort((a, b) => a.code.localeCompare(b.code));
}

export function mergeCurrencyCodes(
  currencyMap: Map<string, CurrencyDescriptor>,
  codes: string[]
): boolean {
  let updated = false;
  for (const code of codes) {
    if (!currencyMap.has(code)) {
      currencyMap.set(code, { code, name: code });
      updated = true;
    }
  }
  return updated;
}

export function createWatchlistEntry(
  code: string,
  currencyMap: Map<string, CurrencyDescriptor>
): WatchlistEntry {
  const descriptor = currencyMap.get(code) ?? { code, name: code };
  return { code: descriptor.code, name: descriptor.name };
}

export function buildTopMovers(
  snapshot: RateSnapshot,
  currencyMap: Map<string, CurrencyDescriptor>,
  previous?: RateSnapshot,
  limit: number = CURRENCY_TOP_MOVERS_LIMIT
): MoverEntry[] {
  if (!previous) {
    return Object.entries(snapshot.rates)
      .slice(0, limit)
      .map(([code, rate]) => ({
        code,
        name: currencyMap.get(code)?.name ?? code,
        rate,
        changePercent: 0
      }));
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
      name: currencyMap.get(code)?.name ?? code,
      rate: currentRate,
      changePercent
    });
  }

  changes.sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent));
  return changes.slice(0, limit);
}

export function updateWatchlistEntries(
  current: WatchlistEntry[],
  snapshot: RateSnapshot,
  currencyMap: Map<string, CurrencyDescriptor>,
  previous?: RateSnapshot
): WatchlistEntry[] {
  return current.map((entry) => {
    const rate = entry.code === snapshot.base ? 1 : snapshot.rates[entry.code];
    const prevRate = previous?.rates[entry.code];
    const changePercent = prevRate && rate ? ((rate - prevRate) / prevRate) * 100 : undefined;
    return {
      ...entry,
      rate,
      changePercent,
      lastUpdated: snapshot.timestamp,
      name: currencyMap.get(entry.code)?.name ?? entry.name
    };
  });
}

export function calculateCurrencyConversion(options: {
  snapshot: RateSnapshot;
  amount: number;
  fromCurrency: string;
  toCurrency: string;
  includeFees: boolean;
  feePercent: number;
}): ConversionResult | { error: string } {
  const { snapshot, amount, fromCurrency, toCurrency, includeFees, feePercent } = options;

  let rate = snapshot.rates[toCurrency];
  if (toCurrency === fromCurrency) {
    rate = 1;
  }
  if (!rate) {
    return { error: `No exchange rate available for ${fromCurrency} → ${toCurrency}.` };
  }

  const feeAmount = includeFees ? amount * feePercent : 0;
  const amountAfterFee = Math.max(amount - feeAmount, 0);
  const convertedAmount = amountAfterFee * rate;
  const inverseRate = rate > 0 ? 1 / rate : 0;

  return {
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
}

export function buildConversionInsights(
  result: ConversionResult,
  previousRate?: number
): string[] {
  const items: string[] = [
    `1 ${result.baseCurrency} ≈ ${result.rate.toFixed(6)} ${result.quoteCurrency}.`,
    `Inverse rate: 1 ${result.quoteCurrency} ≈ ${result.inverseRate.toFixed(6)} ${result.baseCurrency}.`
  ];

  if (result.feeAmount > 0) {
    items.push(
      `Applied fees remove ${result.feeAmount.toFixed(2)} ${result.baseCurrency}, converting ${result.amountAfterFee.toFixed(2)} ${result.baseCurrency}.`
    );
  }

  items.push(`Converted total: ${result.convertedAmount.toFixed(2)} ${result.quoteCurrency}.`);

  if (previousRate) {
    const changePercent =
      previousRate === 0 ? 0 : ((result.rate - previousRate) / previousRate) * 100;
    items.push(
      `Rate changed by ${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(4)}% since last calculation.`
    );
  }

  return items;
}

export function formatConversionResultText(
  result: ConversionResult,
  amount: string | number
): string {
  return [
    `${amount} ${result.baseCurrency} = ${result.convertedAmount.toFixed(2)} ${result.quoteCurrency}`,
    `Rate: 1 ${result.baseCurrency} = ${result.rate.toFixed(6)} ${result.quoteCurrency}`,
    result.feeAmount > 0 ? `Fee: ${result.feeAmount.toFixed(2)} ${result.baseCurrency}` : ''
  ]
    .filter(Boolean)
    .join('\n');
}

export function formatRateTimestamp(timestamp: number | null | undefined): string {
  if (!timestamp) {
    return '—';
  }
  return new Date(timestamp).toLocaleTimeString();
}

export function numberValidator(control: AbstractControl): ValidationErrors | null {
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

export function toNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined) {
    return 0;
  }
  if (typeof value === 'number') {
    return value;
  }
  const normalized = value.split(',').join('').trim();
  return normalized ? Number.parseFloat(normalized) : 0;
}

export function resolveCurrencySuggestion(
  context: CurrencySuggestionContext
): MdToolSuggestion | null {
  const {
    hasResult,
    hasError,
    fromCurrency,
    toCurrency,
    includeFees,
    amount,
    convertedAmount
  } = context;

  if (hasError) {
    return {
      id: 'cc-rate-error',
      title: 'Rates unavailable for this pair',
      reason:
        'The live providers could not return a usable rate. Refresh, or try a major pair. Percentage Calculator helps estimate fees while you wait.',
      actionLabel: 'Open Percentage Calculator',
      path: '/math-date-utils/percentage-calculator'
    };
  }

  if (fromCurrency && toCurrency && fromCurrency === toCurrency) {
    return {
      id: 'cc-same-currency',
      title: 'Source and target match',
      reason:
        'Both currencies are the same, so the rate stays at 1. Swap to a different quote, or use Unit Converter for non-currency units.',
      actionLabel: 'Open Unit Converter',
      path: '/math-date-utils/unit-converter'
    };
  }

  if (hasResult && includeFees) {
    return {
      id: 'cc-fees',
      title: 'Modeling transfer fees?',
      reason:
        'Percentage Calculator is useful for double-checking fee percentages against the converted total.',
      actionLabel: 'Open Percentage Calculator',
      path: '/math-date-utils/percentage-calculator'
    };
  }

  if (hasResult && convertedAmount >= 1000) {
    return {
      id: 'cc-large-amount',
      title: 'Large conversion detected',
      reason:
        'Number to Words can spell out the converted amount for invoices, cheques, or payment notes.',
      actionLabel: 'Open Number to Words',
      path: '/math-date-utils/number-to-words'
    };
  }

  if (hasResult && amount > 0) {
    return {
      id: 'cc-timezone',
      title: 'Timing an international transfer?',
      reason:
        'Timezone Converter helps align market hours and cut-off times across regions before you send funds.',
      actionLabel: 'Open Timezone Converter',
      path: '/fun-tools/timezone-converter'
    };
  }

  return {
    id: 'cc-start',
    title: 'Convert with live rates',
    reason:
      'Pick an amount and currency pair. Rates refresh automatically — Percentage Calculator helps with fee math.',
    actionLabel: 'Open Percentage Calculator',
    path: '/math-date-utils/percentage-calculator'
  };
}
