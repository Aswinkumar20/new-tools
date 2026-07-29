import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of, tap, throwError } from 'rxjs';
import {
  CURRENCY_FALLBACK_RATES_URL,
  CURRENCY_PRIMARY_RATES_URL,
  CURRENCY_RATE_CACHE_TTL_MS
} from '../constants/currency-converter.constants';
import type {
  ExchangeApiResponse,
  FallbackApiResponse,
  RateSnapshot
} from '../types/currency-converter.types';
import { mapFallbackRateResponse } from '../utils/currency-converter.utils';

@Injectable()
export class CurrencyRateService {
  private readonly http = inject(HttpClient);
  private readonly cache = new Map<string, RateSnapshot>();

  fetchLatestRates(base: string, forceRefresh = false): Observable<RateSnapshot> {
    const normalizedBase = base.toUpperCase();
    const cached = this.cache.get(normalizedBase);
    const now = Date.now();
    if (cached && !forceRefresh && now - cached.timestamp < CURRENCY_RATE_CACHE_TTL_MS) {
      return of(cached);
    }

    const fallback$ = this.http
      .get<FallbackApiResponse>(`${CURRENCY_FALLBACK_RATES_URL}?base=${normalizedBase}`)
      .pipe(
        map((response) => mapFallbackRateResponse(response)),
        catchError(() =>
          throwError(() => new Error('Unable to fetch currency rates at this time.'))
        )
      );

    return this.http
      .get<ExchangeApiResponse>(`${CURRENCY_PRIMARY_RATES_URL}/${normalizedBase}`)
      .pipe(
        map((resp) => {
          const baseCode = resp?.base_code;
          const timestamp = resp?.time_last_update_unix;
          const rates = resp?.rates;
          if (resp?.result !== 'success' || !baseCode || !timestamp || !rates) {
            throw new Error('Primary provider error');
          }
          return {
            base: baseCode,
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
