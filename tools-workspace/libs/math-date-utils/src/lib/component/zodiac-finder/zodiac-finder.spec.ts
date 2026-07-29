import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ToastService } from '@tools-workspace/features-home';
import { mathToolTestProviders } from '../../shared/math-tool-test.utils';
import { ZodiacFinderComponent } from './zodiac-finder';

describe('ZodiacFinderComponent', () => {
  let component: ZodiacFinderComponent;
  let fixture: ComponentFixture<ZodiacFinderComponent>;
  let toast: { info: jest.Mock; error: jest.Mock; success: jest.Mock };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ZodiacFinderComponent],
      providers: [...mathToolTestProviders(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(ZodiacFinderComponent);
    component = fixture.componentInstance;
    toast = TestBed.inject(ToastService) as unknown as {
      info: jest.Mock;
      error: jest.Mock;
      success: jest.Mock;
    };
    fixture.detectChanges();
  });

  it('should create with result, history, and related tools', () => {
    expect(component).toBeTruthy();
    expect(component.result()?.sunSign.name).toBeTruthy();
    expect(component.relatedTools.length).toBeGreaterThan(0);
    expect(component.primarySuggestion()).toBeTruthy();
    expect(component.hasHistory()).toBe(true);
    expect(component.summaryCards().length).toBe(4);
    expect(component.compatibilityCards().length).toBe(3);
  });

  it('applies today, yesterday, and new year presets', fakeAsync(() => {
    component.preset('today');
    tick(150);
    expect(toast.info).toHaveBeenCalledWith('Jumped to today.');
    expect(component.result()).toBeTruthy();

    component.preset('yesterday');
    tick(150);
    expect(toast.info).toHaveBeenCalledWith('Jumped to yesterday.');

    component.preset('newYear');
    tick(150);
    expect(component.form.controls.birthDate.value.endsWith('-01-01')).toBe(true);
    expect(toast.info).toHaveBeenCalledWith('Jumped to New Year’s Day.');
  }));

  it('randomizes a birth date', fakeAsync(() => {
    component.randomize();
    tick(150);
    expect(component.form.controls.birthDate.value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(component.result()).toBeTruthy();
    expect(toast.info).toHaveBeenCalledWith('Surprise birth date applied.');
  }));

  it('clears history and restores entries', fakeAsync(() => {
    const entry = component.history()[0];
    component.clearHistory();
    expect(component.hasHistory()).toBe(false);
    expect(toast.info).toHaveBeenCalledWith('History cleared.');

    component.applyHistory(entry);
    tick(150);
    expect(component.form.controls.birthDate.value).toBe(entry.birthDate);
    expect(toast.info).toHaveBeenCalledWith('History entry restored.');
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

  it('clears result when birth date becomes invalid', fakeAsync(() => {
    component.form.controls.birthDate.setValue('not-a-date');
    component.form.controls.birthDate.markAsTouched();
    tick(150);
    expect(component.result()).toBeNull();
  }));
});
