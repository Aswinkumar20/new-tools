import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ToastService } from '@tools-workspace/features-home';
import { mathToolTestProviders } from '../../shared/math-tool-test.utils';
import { PercentageCalculatorComponent } from './percentage-calculator';

describe('PercentageCalculatorComponent', () => {
  let component: PercentageCalculatorComponent;
  let fixture: ComponentFixture<PercentageCalculatorComponent>;
  let toast: { info: jest.Mock; error: jest.Mock; success: jest.Mock };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PercentageCalculatorComponent],
      providers: [...mathToolTestProviders(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(PercentageCalculatorComponent);
    component = fixture.componentInstance;
    toast = TestBed.inject(ToastService) as unknown as {
      info: jest.Mock;
      error: jest.Mock;
      success: jest.Mock;
    };
    fixture.detectChanges();
  });

  it('should create with a default percentage-of result', () => {
    expect(component).toBeTruthy();
    expect(component.result()?.value).toBe(24);
    expect(component.formattedResult()).toBe('24.00');
    expect(component.history().length).toBe(1);
    expect(component.relatedTools.length).toBeGreaterThan(0);
    expect(component.primarySuggestion()?.id).toBe('pc-tip');
  });

  it('switches modes and updates required fields', fakeAsync(() => {
    component.setMode('isWhatPercent');
    tick(120);
    expect(component.formSnapshot().mode).toBe('isWhatPercent');
    expect(component.requiresResultValue()).toBe(true);
    expect(component.requiresPercentageValue()).toBe(false);
    expect(component.primarySuggestion()?.id).toBe('pc-progress');
    expect(toast.info).toHaveBeenCalledWith('Mode switched to What percent of.');
  }));

  it('applies presets', fakeAsync(() => {
    const discount = component.presets.find((preset) => preset.label === 'Discount (25%)');
    expect(discount).toBeTruthy();
    if (discount) {
      component.applyPreset(discount);
      tick(120);
      expect(component.form.controls.mode.value).toBe('percentageDecrease');
      expect(component.result()?.value).toBe(90);
      expect(component.primarySuggestion()?.id).toBe('pc-discount');
      expect(toast.info).toHaveBeenCalledWith('Discount (25%) preset applied.');
    }
  }));

  it('surfaces zero-base errors', fakeAsync(() => {
    component.setMode('percentageChange');
    component.form.patchValue({ baseValue: '0', resultValue: '10' });
    tick(120);
    expect(component.errorMessage()).toContain('cannot be zero');
    expect(component.result()).toBeNull();
    expect(component.primarySuggestion()?.id).toBe('pc-validation');
  }));

  it('resets to defaults', fakeAsync(() => {
    component.setMode('percentageIncrease');
    tick(120);
    component.resetToDefault();
    tick(120);
    expect(component.form.controls.mode.value).toBe('percentageOf');
    expect(component.form.controls.baseValue.value).toBe('120');
    expect(component.result()?.value).toBe(24);
    expect(toast.info).toHaveBeenCalledWith('Reset to default values.');
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

  it('restores history entries', fakeAsync(() => {
    component.applyPreset(component.presets[1]);
    tick(120);
    const entry = component.history()[0];
    component.resetToDefault();
    tick(120);
    component.restoreHistory(entry);
    tick(120);
    expect(component.form.controls.mode.value).toBe(entry.mode);
    expect(toast.info).toHaveBeenCalledWith('History entry restored.');
  }));
});
