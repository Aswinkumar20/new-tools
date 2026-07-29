import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ToastService } from '@tools-workspace/features-home';
import { mathToolTestProviders } from '../../shared/math-tool-test.utils';
import { AgeCalculatorComponent } from './age-calculator';

describe('AgeCalculatorComponent', () => {
  let component: AgeCalculatorComponent;
  let fixture: ComponentFixture<AgeCalculatorComponent>;
  let toast: { info: jest.Mock; error: jest.Mock; success: jest.Mock };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AgeCalculatorComponent],
      providers: [...mathToolTestProviders(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(AgeCalculatorComponent);
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
    expect(component.summary()?.years).toBeGreaterThanOrEqual(0);
    expect(component.relatedTools.length).toBeGreaterThan(0);
    expect(component.primarySuggestion()).toBeTruthy();
    expect(component.history().length).toBe(1);
  });

  it('applies presets and updates the age summary', fakeAsync(() => {
    const preset = component.presets[0];
    component.applyPreset(preset);
    tick(100);
    expect(component.form.controls.birthDate.value).toBe(preset.birthDate);
    expect(component.form.controls.comparisonDate.value).toBe(preset.comparisonDate);
    expect(component.summary()?.exactAge).toBeTruthy();
    expect(toast.info).toHaveBeenCalledWith(`${preset.label} preset applied.`);
  }));

  it('switches anchors and clears comparison date for today mode', fakeAsync(() => {
    component.setAnchor('specific');
    tick(100);
    expect(component.activeAnchor()).toBe('specific');
    component.setAnchor('now');
    tick(100);
    expect(component.activeAnchor()).toBe('now');
    expect(component.form.controls.comparisonDate.value).toBe('today');
  }));

  it('surfaces validation when comparison precedes birth', fakeAsync(() => {
    component.form.patchValue({
      birthDate: '2000-01-01',
      comparisonDate: '1990-01-01',
      anchor: 'specific'
    });
    tick(100);
    expect(component.errorMessage()).toContain('earlier than the birth date');
    expect(component.result()).toBeNull();
    expect(component.primarySuggestion()?.id).toBe('ac-date-order');
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

  it('clears history and resets defaults', fakeAsync(() => {
    expect(component.history().length).toBeGreaterThan(0);
    component.clearHistory();
    expect(component.history().length).toBe(0);
    expect(toast.info).toHaveBeenCalledWith('History cleared.');

    component.resetToDefault();
    tick(100);
    expect(component.form.controls.birthDate.value).toBe('1995-05-12');
    expect(toast.info).toHaveBeenCalledWith('Reset to default values.');
  }));

  it('restores a history entry', fakeAsync(() => {
    component.applyPreset(component.presets[1]);
    tick(100);
    const entry = component.history()[0];
    component.form.patchValue({ birthDate: '1980-01-01' });
    tick(100);
    component.restoreHistory(entry);
    tick(100);
    expect(component.form.controls.birthDate.value).toBe(entry.birthDate);
    expect(toast.info).toHaveBeenCalledWith('History entry restored.');
  }));
});
