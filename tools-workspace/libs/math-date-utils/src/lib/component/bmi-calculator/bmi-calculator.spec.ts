import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ToastService } from '@tools-workspace/features-home';
import { mathToolTestProviders } from '../../shared/math-tool-test.utils';
import { BmiCalculatorComponent } from './bmi-calculator';

describe('BmiCalculatorComponent', () => {
  let component: BmiCalculatorComponent;
  let fixture: ComponentFixture<BmiCalculatorComponent>;
  let toast: { info: jest.Mock; error: jest.Mock; success: jest.Mock };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BmiCalculatorComponent],
      providers: [...mathToolTestProviders(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(BmiCalculatorComponent);
    component = fixture.componentInstance;
    toast = TestBed.inject(ToastService) as unknown as {
      info: jest.Mock;
      error: jest.Mock;
      success: jest.Mock;
    };
    fixture.detectChanges();
  });

  it('should create with defaults, result, and related tools', () => {
    expect(component).toBeTruthy();
    expect(component.summary()?.bmi).toBeGreaterThan(0);
    expect(component.summary()?.classification.label).toBeTruthy();
    expect(component.relatedTools.length).toBeGreaterThan(0);
    expect(component.primarySuggestion()).toBeTruthy();
    expect(component.history().length).toBe(1);
  });

  it('switches units and converts measurements', fakeAsync(() => {
    component.setUnit('imperial');
    tick(100);
    expect(component.formSnapshot().unit).toBe('imperial');
    expect(toFinite(component.form.controls.weight.value)).toBeGreaterThan(0);
    expect(toast.info).toHaveBeenCalledWith('Switched to imperial units.');
    component.setUnit('metric');
    tick(100);
    expect(component.formSnapshot().unit).toBe('metric');
  }));

  it('applies presets and updates BMI', fakeAsync(() => {
    const preset = component.presets[0];
    component.applyPreset(preset);
    tick(100);
    expect(component.form.controls.weight.value).toBe(preset.weight);
    expect(component.summary()?.bmi).toBeGreaterThan(0);
    expect(toast.info).toHaveBeenCalledWith(`${preset.label} preset applied.`);
  }));

  it('surfaces validation for non-positive measurements', fakeAsync(() => {
    component.form.patchValue({ weight: '0', height: '175' });
    tick(100);
    expect(component.errorMessage()).toContain('positive');
    expect(component.result()).toBeNull();
    expect(component.primarySuggestion()?.id).toBe('bmi-positive-values');
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

  it('clears history and restores entries', fakeAsync(() => {
    expect(component.history().length).toBeGreaterThan(0);
    const entry = component.history()[0];
    component.clearHistory();
    expect(component.history().length).toBe(0);
    expect(toast.info).toHaveBeenCalledWith('History cleared.');

    component.restoreHistory(entry);
    tick(100);
    expect(component.form.controls.weight.value).toBe(entry.weight.toString());
    expect(toast.info).toHaveBeenCalledWith('History entry restored.');
  }));
});

function toFinite(value: string | null): number {
  return Number.parseFloat(value ?? '0');
}
