import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ToastService } from '@tools-workspace/features-home';
import { mathToolTestProviders } from '../../shared/math-tool-test.utils';
import { FractionCalculatorComponent } from './fraction-calculator';

describe('FractionCalculatorComponent', () => {
  let component: FractionCalculatorComponent;
  let fixture: ComponentFixture<FractionCalculatorComponent>;
  let toast: { info: jest.Mock; error: jest.Mock; success: jest.Mock };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FractionCalculatorComponent],
      providers: [...mathToolTestProviders(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(FractionCalculatorComponent);
    component = fixture.componentInstance;
    toast = TestBed.inject(ToastService) as unknown as {
      info: jest.Mock;
      error: jest.Mock;
      success: jest.Mock;
    };
    fixture.detectChanges();
  });

  it('should create with a default computation and related tools', () => {
    expect(component).toBeTruthy();
    expect(component.computation()?.simplified).toEqual({ numerator: 23, denominator: 20 });
    expect(component.relatedTools.length).toBeGreaterThan(0);
    expect(component.primarySuggestion()).toBeTruthy();
  });

  it('swaps fractions and recalculates', fakeAsync(() => {
    component.swapFractions();
    tick(150);
    expect(component.form.controls.fractionA.controls.numerator.value).toBe('2');
    expect(component.form.controls.fractionB.controls.numerator.value).toBe('3');
    expect(toast.info).toHaveBeenCalledWith('Fractions swapped.');
  }));

  it('applies presets', fakeAsync(() => {
    component.applyPreset('division-sample');
    tick(150);
    expect(component.form.controls.operation.value).toBe('divide');
    expect(component.computation()?.operation).toBe('divide');
    expect(component.activePreset()).toBe('Division sample');
    expect(toast.info).toHaveBeenCalledWith('Division sample preset applied.');
  }));

  it('surfaces validation errors for non-integers', fakeAsync(() => {
    component.form.controls.fractionA.controls.numerator.setValue('1.5');
    tick(150);
    expect(component.errors().some((message) => message.includes('integer'))).toBe(true);
    expect(component.computation()).toBeNull();
    expect(component.primarySuggestion()?.id).toBe('fc-validation');
  }));

  it('handles divide-by-zero numerator errors', fakeAsync(() => {
    component.form.patchValue({
      operation: 'divide',
      fractionB: { numerator: '0', denominator: '5' }
    });
    tick(150);
    expect(component.errors()[0]).toContain('zero numerator');
    expect(component.computation()).toBeNull();
  }));

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

  it('resets to defaults', fakeAsync(() => {
    component.applyPreset('negative-values');
    tick(150);
    component.reset();
    tick(150);
    expect(component.form.controls.fractionA.controls.numerator.value).toBe('3');
    expect(component.form.controls.operation.value).toBe('add');
    expect(component.activePreset()).toBeNull();
  }));
});
