import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ToastService } from '@tools-workspace/features-home';
import { of, throwError } from 'rxjs';
import { CurrencyRateService } from '../../services/currency-rate.service';
import { mathToolTestProviders } from '../../shared/math-tool-test.utils';
import type { RateSnapshot } from '../../types/currency-converter.types';
import { CurrencyConverterComponent } from './currency-converter';

const MOCK_SNAPSHOT: RateSnapshot = {
  base: 'USD',
  timestamp: Date.now(),
  provider: 'test-provider',
  rates: {
    EUR: 0.9,
    GBP: 0.8,
    JPY: 150,
    INR: 83,
    AUD: 1.5,
    CAD: 1.35,
    USD: 1
  }
};

describe('CurrencyConverterComponent', () => {
  let component: CurrencyConverterComponent;
  let fixture: ComponentFixture<CurrencyConverterComponent>;
  let toast: { info: jest.Mock; error: jest.Mock; success: jest.Mock };
  let rateService: { fetchLatestRates: jest.Mock };

  beforeEach(async () => {
    rateService = {
      fetchLatestRates: jest.fn().mockReturnValue(of(MOCK_SNAPSHOT))
    };

    await TestBed.configureTestingModule({
      imports: [CurrencyConverterComponent],
      providers: [...mathToolTestProviders(), provideRouter([])]
    })
      .overrideComponent(CurrencyConverterComponent, {
        set: { providers: [{ provide: CurrencyRateService, useValue: rateService }] }
      })
      .compileComponents();

    fixture = TestBed.createComponent(CurrencyConverterComponent);
    component = fixture.componentInstance;
    toast = TestBed.inject(ToastService) as unknown as {
      info: jest.Mock;
      error: jest.Mock;
      success: jest.Mock;
    };
    fixture.detectChanges();
  });

  function loadRates(): void {
    component.refreshRates(true);
    tick();
  }

  it('should create with catalog, watchlist, and related tools', fakeAsync(() => {
    loadRates();
    expect(component).toBeTruthy();
    expect(component.currencyCatalog().length).toBeGreaterThan(0);
    expect(component.watchlist().length).toBeGreaterThan(0);
    expect(component.relatedTools.length).toBeGreaterThan(0);
    expect(component.conversionResult()?.quoteCurrency).toBe('EUR');
    expect(component.primarySuggestion()).toBeTruthy();
  }));

  it('swaps currencies and recalculates', fakeAsync(() => {
    loadRates();
    rateService.fetchLatestRates.mockReturnValue(
      of({
        ...MOCK_SNAPSHOT,
        base: 'EUR',
        rates: { ...MOCK_SNAPSHOT.rates, USD: 1.11, EUR: 1 }
      })
    );
    component.swapCurrencies();
    tick(150);
    expect(component.form.controls.fromCurrency.value).toBe('EUR');
    expect(component.form.controls.toCurrency.value).toBe('USD');
    expect(toast.info).toHaveBeenCalled();
  }));

  it('sets quote currency from watchlist', fakeAsync(() => {
    loadRates();
    component.setToCurrency('GBP');
    tick(150);
    expect(component.form.controls.toCurrency.value).toBe('GBP');
    expect(component.conversionResult()?.quoteCurrency).toBe('GBP');
  }));

  it('copies conversion with toast feedback', fakeAsync(() => {
    loadRates();
    Object.assign(navigator, {
      clipboard: { writeText: jest.fn().mockResolvedValue(undefined) }
    });
    let copied = false;
    component.copyResult().then(() => {
      copied = true;
    });
    tick();
    expect(copied).toBe(true);
    expect(toast.info).toHaveBeenCalledWith('Result copied to clipboard');
  }));

  it('dismisses contextual suggestions', fakeAsync(() => {
    loadRates();
    const suggestion = component.primarySuggestion();
    expect(suggestion).toBeTruthy();
    if (suggestion) {
      component.dismissSuggestion(suggestion.id);
      expect(component.primarySuggestion()).toBeNull();
    }
  }));

  it('surfaces rate fetch errors', fakeAsync(() => {
    rateService.fetchLatestRates.mockReturnValue(
      throwError(() => new Error('Unable to fetch currency rates at this time.'))
    );
    component.refreshRates(true);
    tick();
    expect(component.rateError()).toContain('Unable to fetch');
  }));

  it('applies fees when enabled', fakeAsync(() => {
    loadRates();
    component.form.patchValue({ includeFees: true, feePercent: '10', amount: '100' });
    tick(150);
    const result = component.conversionResult();
    expect(result?.feeAmount).toBe(10);
    expect(result?.amountAfterFee).toBe(90);
    expect(result?.convertedAmount).toBeCloseTo(81, 5);
  }));
});
