import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ToastService } from '@tools-workspace/features-home';
import { mathToolTestProviders } from '../../shared/math-tool-test.utils';
import { LoanEmiCalculatorComponent } from './loan-emi-calculator';

describe('LoanEmiCalculatorComponent', () => {
  let component: LoanEmiCalculatorComponent;
  let fixture: ComponentFixture<LoanEmiCalculatorComponent>;
  let toast: { info: jest.Mock; error: jest.Mock; success: jest.Mock };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoanEmiCalculatorComponent],
      providers: [...mathToolTestProviders(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(LoanEmiCalculatorComponent);
    component = fixture.componentInstance;
    toast = TestBed.inject(ToastService) as unknown as {
      info: jest.Mock;
      error: jest.Mock;
      success: jest.Mock;
    };
    fixture.detectChanges();
  });

  it('should create with a default EMI and related tools', () => {
    expect(component).toBeTruthy();
    expect(component.summary()?.emi).toBeGreaterThan(0);
    expect(component.history().length).toBe(1);
    expect(component.relatedTools.length).toBeGreaterThan(0);
    expect(component.primarySuggestion()).toBeTruthy();
  });

  it('applies presets and recalculates', fakeAsync(() => {
    const car = component.presets.find((preset) => preset.label === 'Car loan');
    expect(car).toBeTruthy();
    if (car) {
      component.applyPreset(car);
      tick(150);
      expect(component.form.controls.amount.value).toBe('35000');
      expect(component.summary()?.emi).toBeGreaterThan(0);
      expect(toast.info).toHaveBeenCalledWith('Car loan preset applied.');
    }
  }));

  it('switches loan type with toast feedback', fakeAsync(() => {
    component.setLoanType('flat');
    tick(150);
    expect(component.formSnapshot().loanType).toBe('flat');
    expect(component.primarySuggestion()?.id).toBe('lec-flat');
    expect(toast.info).toHaveBeenCalledWith('Flat rate loan selected.');
  }));

  it('surfaces tenure validation errors', fakeAsync(() => {
    component.form.patchValue({ termYears: '0', termMonths: '0' });
    tick(150);
    expect(component.errorMessage()).toContain('greater than zero');
    expect(component.summary()).toBeNull();
    expect(component.primarySuggestion()?.id).toBe('lec-validation');
  }));

  it('stores and restores history', fakeAsync(() => {
    component.applyPreset(component.presets[1]);
    tick(150);
    const first = component.history()[0];
    expect(first).toBeTruthy();

    component.form.patchValue({ amount: '99999' });
    tick(150);

    component.restoreHistory(first);
    tick(150);
    expect(component.form.controls.amount.value).toBe(first.amount.toString());
    expect(toast.info).toHaveBeenCalledWith('History entry restored.');
  }));

  it('clears history', () => {
    expect(component.history().length).toBeGreaterThan(0);
    component.clearHistory();
    expect(component.history().length).toBe(0);
    expect(toast.info).toHaveBeenCalledWith('History cleared.');
  });

  it('dismisses contextual suggestions', () => {
    const suggestion = component.primarySuggestion();
    expect(suggestion).toBeTruthy();
    if (suggestion) {
      component.dismissSuggestion(suggestion.id);
      expect(component.primarySuggestion()).toBeNull();
    }
  });

  it('copies results with toast feedback', async () => {
    Object.assign(navigator, {
      clipboard: { writeText: jest.fn().mockResolvedValue(undefined) }
    });
    await component.copyResult();
    expect(toast.info).toHaveBeenCalledWith('Result copied to clipboard');
  });

  it('recalculates on submit', () => {
    component.submit();
    expect(toast.info).toHaveBeenCalledWith('Loan recalculated.');
    expect(component.summary()?.emi).toBeGreaterThan(0);
  });
});
