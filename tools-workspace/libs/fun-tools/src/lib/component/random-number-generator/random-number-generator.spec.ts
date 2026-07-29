import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ToastService } from '@tools-workspace/features-home';
import { ftToolTestProviders } from '../../shared/ft-tool-test.utils';
import { RandomNumberGeneratorComponent } from './random-number-generator';

describe('RandomNumberGeneratorComponent', () => {
  let component: RandomNumberGeneratorComponent;
  let fixture: ComponentFixture<RandomNumberGeneratorComponent>;
  let toast: { info: jest.Mock; error: jest.Mock; success: jest.Mock };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RandomNumberGeneratorComponent],
      providers: [...ftToolTestProviders(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(RandomNumberGeneratorComponent);
    component = fixture.componentInstance;
    toast = TestBed.inject(ToastService) as unknown as {
      info: jest.Mock;
      error: jest.Mock;
      success: jest.Mock;
    };
    fixture.detectChanges();
  });

  it('should create with intro suggestion and related tools', () => {
    expect(component).toBeTruthy();
    expect(component.primarySuggestion()?.id).toBe('rng-intro');
    expect(component.relatedTools.length).toBeGreaterThan(0);
  });

  it('validates min/max and generates integers', () => {
    component.form.setValue({ min: 5, max: 5, count: 1, integerOnly: true, decimals: 0 });
    component.generate();
    expect(component.errors()).toEqual(['Minimum value must be less than maximum value.']);

    component.form.setValue({ min: 9, max: 10, count: 2, integerOnly: true, decimals: 0 });
    component.generate();
    expect(component.errors()).toEqual([]);
    expect(component.generatedNumbers().length).toBe(2);
    expect(component.generatedNumbers().every((n) => n.value === 9 || n.value === 10)).toBe(true);
  });

  it('resets decimals when switching to integer only', () => {
    component.form.controls.integerOnly.setValue(false);
    component.form.controls.decimals.setValue(4);
    component.form.controls.integerOnly.setValue(true);
    expect(component.form.controls.decimals.value).toBe(0);
  });

  it('clears results', () => {
    component.generate();
    expect(component.hasResults()).toBe(true);
    component.clearResults();
    expect(component.hasResults()).toBe(false);
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
    component.form.setValue({ min: 9, max: 10, count: 1, integerOnly: true, decimals: 0 });
    component.generate();
    await component.copyResults();
    expect(toast.info).toHaveBeenCalledWith('Results copied to clipboard');
  });
});
