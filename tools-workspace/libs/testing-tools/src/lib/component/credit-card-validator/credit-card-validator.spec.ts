import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ToastService } from '@tools-workspace/features-home';
import { ttToolTestProviders } from '../../shared/tt-tool-test.utils';
import { CreditCardValidatorComponent } from './credit-card-validator';

function futureExpiry(yearsAhead = 2): string {
  const year = (new Date().getFullYear() + yearsAhead) % 100;
  return `12/${String(year).padStart(2, '0')}`;
}

describe('CreditCardValidatorComponent', () => {
  let component: CreditCardValidatorComponent;
  let fixture: ComponentFixture<CreditCardValidatorComponent>;
  let toast: { info: jest.Mock; error: jest.Mock; success: jest.Mock };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CreditCardValidatorComponent],
      providers: [...ttToolTestProviders(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(CreditCardValidatorComponent);
    component = fixture.componentInstance;
    toast = TestBed.inject(ToastService) as unknown as {
      info: jest.Mock;
      error: jest.Mock;
      success: jest.Mock;
    };
    fixture.detectChanges();
  });

  it('should create with get-started suggestion', () => {
    expect(component).toBeTruthy();
    expect(component.primarySuggestion()?.id).toBe('ccv-get-started');
    expect(component.relatedTools.length).toBeGreaterThan(0);
    expect(component.brandLabel()).toBe('Unknown');
  });

  it('detects Visa and validates a well-formed card', () => {
    component.form.patchValue({
      number: '4111 1111 1111 1111',
      name: 'Test User',
      expiry: futureExpiry(),
      cvv: '123'
    });
    expect(component.brand()).toBe('visa');
    expect(component.brandLabel()).toBe('Visa');
    expect(component.validationResult().luhnValid).toBe(true);
    expect(component.validationResult().valid).toBe(true);
    expect(component.primarySuggestion()?.id).toBe('ccv-valid');
  });

  it('flags Luhn failures', () => {
    component.form.patchValue({
      number: '4111 1111 1111 1112',
      name: 'Test User',
      expiry: futureExpiry(),
      cvv: '123'
    });
    expect(component.validationResult().luhnValid).toBe(false);
    expect(component.primarySuggestion()?.id).toBe('ccv-luhn-fail');
  });

  it('formats number input and supports mask toggle', () => {
    component.form.controls.number.setValue('4111111111111111');
    component.onNumberInput();
    expect(component.form.controls.number.value).toBe('4111 1111 1111 1111');
    expect(component.showNumberMasked()).toBe(true);
    component.toggleMask();
    expect(component.showNumberMasked()).toBe(false);
    expect(component.maskedNumber()).toContain('4111');
  });

  it('clears with toast feedback', () => {
    component.form.patchValue({ number: '4111', name: 'A', expiry: '01/30', cvv: '12' });
    component.clear();
    expect(component.form.controls.number.value).toBe('');
    expect(component.hasInput()).toBe(false);
    expect(toast.info).toHaveBeenCalledWith('Cleared');
  });

  it('copies summary with toast feedback', async () => {
    Object.assign(navigator, {
      clipboard: { writeText: jest.fn().mockResolvedValue(undefined) }
    });
    component.form.patchValue({
      number: '4111111111111111',
      name: 'Test',
      expiry: futureExpiry(),
      cvv: '123'
    });
    await component.copyOutput();
    expect(toast.info).toHaveBeenCalledWith('Validation summary copied to clipboard');
  });

  it('dismisses contextual suggestions', () => {
    const suggestion = component.primarySuggestion();
    expect(suggestion).toBeTruthy();
    if (suggestion) {
      component.dismissSuggestion(suggestion.id);
      expect(component.primarySuggestion()).toBeNull();
    }
  });
});
