import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ToastService } from '@tools-workspace/features-home';
import { mathToolTestProviders } from '../../shared/math-tool-test.utils';
import { DateDifferenceCalculatorComponent } from './date-difference-calculator';

describe('DateDifferenceCalculatorComponent', () => {
  let component: DateDifferenceCalculatorComponent;
  let fixture: ComponentFixture<DateDifferenceCalculatorComponent>;
  let toast: { info: jest.Mock; error: jest.Mock; success: jest.Mock };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DateDifferenceCalculatorComponent],
      providers: [...mathToolTestProviders(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(DateDifferenceCalculatorComponent);
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
    expect(component.summary()?.totalDays).toBeGreaterThanOrEqual(0);
    expect(component.relatedTools.length).toBeGreaterThan(0);
    expect(component.primarySuggestion()).toBeTruthy();
    expect(component.history().length).toBe(1);
    expect(component.form.controls.startTime.value).toBe('00:00');
    expect(component.form.controls.endTime.value).toBe('00:00');
  });

  it('applies presets and updates the summary', fakeAsync(() => {
    const preset = component.presets[0];
    component.applyPreset(preset);
    tick(120);
    expect(component.form.controls.startDate.value).toBe(preset.startDate);
    expect(component.form.controls.endDate.value).toBe(preset.endDate);
    expect(component.summary()?.exactSpan).toBeTruthy();
    expect(toast.info).toHaveBeenCalledWith(`${preset.label} preset applied.`);
  }));

  it('surfaces validation for invalid dates', fakeAsync(() => {
    component.form.patchValue({ startDate: 'not-a-date', endDate: '2024-01-01' });
    tick(120);
    expect(component.errorMessage()).toContain('not a valid date');
    expect(component.result()).toBeNull();
    expect(component.primarySuggestion()?.id).toBe('ddc-invalid-date');
  }));

  it('orders reversed dates chronologically', fakeAsync(() => {
    component.form.patchValue({
      startDate: '2024-06-01',
      endDate: '2024-01-01',
      includeTime: false
    });
    tick(120);
    expect(component.summary()?.isForward).toBe(false);
    expect(component.summary()?.totalDays).toBeGreaterThan(0);
    expect(component.primarySuggestion()?.id).toBe('ddc-reversed');
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
    const entry = component.history()[0];
    component.clearHistory();
    expect(component.history().length).toBe(0);
    expect(toast.info).toHaveBeenCalledWith('History cleared.');

    component.restoreHistory(entry);
    tick(120);
    expect(component.form.controls.startDate.value).toBe(entry.startDate);
    expect(toast.info).toHaveBeenCalledWith('History entry restored.');
  }));
});
