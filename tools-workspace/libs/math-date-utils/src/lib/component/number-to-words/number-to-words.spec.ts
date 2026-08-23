import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ToastService } from '@tools-workspace/features-home';
import { mathToolTestProviders } from '../../shared/math-tool-test.utils';
import { NumberToWordsComponent } from './number-to-words';

describe('NumberToWordsComponent', () => {
  let component: NumberToWordsComponent;
  let fixture: ComponentFixture<NumberToWordsComponent>;
  let toast: { info: jest.Mock; error: jest.Mock; success: jest.Mock };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NumberToWordsComponent],
      providers: [...mathToolTestProviders(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(NumberToWordsComponent);
    component = fixture.componentInstance;
    toast = TestBed.inject(ToastService) as unknown as {
      info: jest.Mock;
      error: jest.Mock;
      success: jest.Mock;
    };
    fixture.detectChanges();
  });

  it('should create with a default conversion and related tools', () => {
    expect(component).toBeTruthy();
    expect(component.formattedOutput().length).toBeGreaterThan(0);
    expect(component.historyEntries().length).toBe(1);
    expect(component.relatedTools.length).toBeGreaterThan(0);
    expect(component.primarySuggestion()?.id).toBe('ntw-decimal');
  });

  it('applies samples and recalculates', fakeAsync(() => {
    const sample = component.sampleNumbers.find((item) => item.label === 'Rank position');
    expect(sample).toBeTruthy();
    if (sample) {
      component.applySample(sample);
      tick(150);
      expect(component.form.controls.format.value).toBe('ordinal');
      expect(component.formattedOutput().toLowerCase()).toContain('twelfth');
      expect(component.primarySuggestion()?.id).toBe('ntw-ordinal');
      expect(toast.info).toHaveBeenCalledWith('Sample Rank position applied.');
    }
  }));

  it('switches to currency format', fakeAsync(() => {
    component.setFormat('currency');
    tick(150);
    expect(component.formSnapshot().format).toBe('currency');
    expect(component.isCurrencyFormat()).toBe(true);
    expect(component.formattedOutput()).toContain('$');
    expect(component.primarySuggestion()?.id).toBe('ntw-currency');
  }));

  it('surfaces validation errors for invalid input', fakeAsync(() => {
    component.form.controls.numericInput.setValue('not-a-number');
    tick(150);
    expect(component.errorMessage()).toBeTruthy();
    expect(component.formattedOutput()).toBe('');
    expect(component.primarySuggestion()?.id).toBe('ntw-validation');
  }));

  it('resets to defaults', fakeAsync(() => {
    component.setFormat('ordinal');
    tick(150);
    component.resetToDefault();
    tick(150);
    expect(component.form.controls.numericInput.value).toBe('123456.78');
    expect(component.form.controls.format.value).toBe('cardinal');
    expect(toast.info).toHaveBeenCalledWith('Reset to default values.');
  }));

  it('clears history', () => {
    expect(component.historyEntries().length).toBeGreaterThan(0);
    component.clearHistory();
    expect(component.historyEntries().length).toBe(0);
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

  it('copies output with toast feedback', async () => {
    Object.assign(navigator, {
      clipboard: { writeText: jest.fn().mockResolvedValue(undefined) }
    });
    await component.copyToClipboard();
    expect(toast.info).toHaveBeenCalledWith('Output copied to clipboard');
  });

  it('restores history entries', fakeAsync(() => {
    component.setFormat('ordinal');
    component.form.controls.numericInput.setValue('21');
    tick(150);
    const entry = component.historyEntries()[0];
    component.resetToDefault();
    tick(150);
    component.restoreHistory(entry);
    tick(150);
    expect(component.form.controls.numericInput.value).toBe(entry.input);
    expect(component.form.controls.format.value).toBe(entry.format);
    expect(toast.info).toHaveBeenCalledWith('History entry restored.');
  }));
});
