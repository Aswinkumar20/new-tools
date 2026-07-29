import { of, type Observable } from 'rxjs';
import { shareReplay, tap } from 'rxjs';
import type { ExternalRateProvider } from '../types/unit-converter.types';

export class CurrencyRateService {
  private readonly cache = new Map<string, { expires: number; rates: Record<string, number> }>();

  constructor(private readonly providers: ExternalRateProvider[]) {}

  getRates(providerId: string): Observable<Record<string, number>> {
    const provider = this.providers.find((item) => item.id === providerId);
    if (!provider) {
      return of({});
    }

    const cached = this.cache.get(provider.id);
    if (cached && cached.expires > Date.now()) {
      return of(cached.rates);
    }

    return provider.fetchRates().pipe(
      tap((rates) =>
        this.cache.set(provider.id, { rates, expires: Date.now() + provider.ttl })
      ),
      shareReplay(1)
    );
  }
}

export function createMockCurrencyRateService(): CurrencyRateService {
  return new CurrencyRateService([
    {
      id: 'mockRates',
      label: 'Mock FX Provider',
      ttl: 1000 * 60 * 15,
      fetchRates: () =>
        of({
          usd: 1,
          eur: 0.92,
          gbp: 0.79,
          jpy: 150.35,
          inr: 83.14,
          aud: 1.54
        })
    }
  ]);
}
