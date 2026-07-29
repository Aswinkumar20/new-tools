import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ToastService } from '@tools-workspace/features-home';
import { mathToolTestProviders } from '../../shared/math-tool-test.utils';
import { TipCalculatorComponent } from './tip-calculator';

describe('TipCalculatorComponent', () => {
  let component: TipCalculatorComponent;
  let fixture: ComponentFixture<TipCalculatorComponent>;
  let toast: { info: jest.Mock; error: jest.Mock; success: jest.Mock };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TipCalculatorComponent],
      providers: [...mathToolTestProviders(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(TipCalculatorComponent);
    component = fixture.componentInstance;
    toast = TestBed.inject(ToastService) as unknown as {
      info: jest.Mock;
      error: jest.Mock;
      success: jest.Mock;
    };
    fixture.detectChanges();
  });

  it('should create with a default tip summary', () => {
    expect(component).toBeTruthy();
    expect(component.summary()?.grandTotal).toBeGreaterThan(0);
    expect(component.summary()?.perPerson.length).toBe(2);
    expect(component.history().length).toBe(1);
    expect(component.relatedTools.length).toBeGreaterThan(0);
    expect(component.primarySuggestion()?.id).toBe('tc-tax');
  });

  it('switches to custom split mode', fakeAsync(() => {
    component.setSplitMode('custom');
    tick(120);
    expect(component.splitMode()).toBe('custom');
    expect(component.summary()?.perPersonLabels[0]).toBe('Guest 1');
    expect(component.primarySuggestion()?.id).toBe('tc-custom');
    expect(toast.info).toHaveBeenCalledWith('Custom shares enabled.');
  }));

  it('applies presets', fakeAsync(() => {
    const party = component.presets.find((preset) => preset.label === 'Large party');
    expect(party).toBeTruthy();
    if (party) {
      component.applyPreset(party);
      tick(120);
      expect(component.form.controls.splitCount.value).toBe('8');
      expect(component.summary()?.perPerson.length).toBe(8);
      expect(component.primarySuggestion()?.id).toBe('tc-party');
      expect(toast.info).toHaveBeenCalledWith('Large party preset applied.');
    }
  }));

  it('surfaces negative amount errors', fakeAsync(() => {
    component.form.patchValue({ amount: '-10' });
    tick(120);
    expect(component.errorMessage()).toContain('cannot be negative');
    expect(component.summary()).toBeNull();
    expect(component.primarySuggestion()?.id).toBe('tc-validation');
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
    component.applyPreset(component.presets[0]);
    tick(120);
    const entry = component.history()[0];
    component.applyPreset(component.presets[3]);
    tick(120);
    component.restoreHistory(entry);
    tick(120);
    expect(component.form.controls.amount.value).toBe(entry.amount.toString());
    expect(toast.info).toHaveBeenCalledWith('History entry restored.');
  }));

  it('recalculates on submit', () => {
    component.submit();
    expect(toast.info).toHaveBeenCalledWith('Tip recalculated.');
    expect(component.summary()?.grandTotal).toBeGreaterThan(0);
  });
});
