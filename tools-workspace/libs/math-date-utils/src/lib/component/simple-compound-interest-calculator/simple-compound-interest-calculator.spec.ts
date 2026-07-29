import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ToastService } from '@tools-workspace/features-home';
import { mathToolTestProviders } from '../../shared/math-tool-test.utils';
import { SimpleCompoundInterestCalculatorComponent } from './simple-compound-interest-calculator';

describe('SimpleCompoundInterestCalculatorComponent', () => {
  let component: SimpleCompoundInterestCalculatorComponent;
  let fixture: ComponentFixture<SimpleCompoundInterestCalculatorComponent>;
  let toast: { info: jest.Mock; error: jest.Mock; success: jest.Mock };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SimpleCompoundInterestCalculatorComponent],
      providers: [...mathToolTestProviders(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(SimpleCompoundInterestCalculatorComponent);
    component = fixture.componentInstance;
    toast = TestBed.inject(ToastService) as unknown as {
      info: jest.Mock;
      error: jest.Mock;
      success: jest.Mock;
    };
    fixture.detectChanges();
  });

  it('should create with a default compound result', () => {
    expect(component).toBeTruthy();
    expect(component.summary()?.futureValue).toBeGreaterThan(10000);
    expect(component.history().length).toBe(1);
    expect(component.relatedTools.length).toBeGreaterThan(0);
    expect(component.primarySuggestion()?.id).toBe('sic-currency');
  });

  it('switches to simple mode', fakeAsync(() => {
    component.setMode('simple');
    tick(120);
    expect(component.formSnapshot().mode).toBe('simple');
    expect(component.summary()?.futureValue).toBeCloseTo(13750);
    expect(component.primarySuggestion()?.id).toBe('sic-simple');
    expect(toast.info).toHaveBeenCalledWith('Simple interest mode selected.');
  }));

  it('applies presets with contributions', fakeAsync(() => {
    const retirement = component.presets.find((preset) => preset.label === 'Retirement (compound)');
    expect(retirement).toBeTruthy();
    if (retirement) {
      component.applyPreset(retirement);
      tick(120);
      expect(component.form.controls.contributions.value).toBe('500');
      expect(component.summary()?.totalContributions).toBeGreaterThan(0);
      expect(component.primarySuggestion()?.id).toBe('sic-contributions');
      expect(toast.info).toHaveBeenCalledWith('Retirement (compound) preset applied.');
    }
  }));

  it('surfaces validation errors for negative values', fakeAsync(() => {
    component.form.patchValue({ principal: '-100' });
    tick(120);
    expect(component.errorMessage()).toContain('non-negative');
    expect(component.summary()).toBeNull();
    expect(component.primarySuggestion()?.id).toBe('sic-validation');
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
    component.setMode('simple');
    tick(120);
    component.restoreHistory(entry);
    tick(120);
    expect(component.form.controls.principal.value).toBe(entry.principal);
    expect(component.form.controls.mode.value).toBe(entry.mode);
    expect(toast.info).toHaveBeenCalledWith('History entry restored.');
  }));

  it('recalculates on submit', () => {
    component.submit();
    expect(toast.info).toHaveBeenCalledWith('Interest recalculated.');
    expect(component.summary()?.futureValue).toBeGreaterThan(0);
  });
});
