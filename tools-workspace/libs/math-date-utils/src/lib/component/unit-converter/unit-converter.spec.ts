import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ToastService } from '@tools-workspace/features-home';
import { mathToolTestProviders } from '../../shared/math-tool-test.utils';
import { UnitConverterComponent } from './unit-converter';

describe('UnitConverterComponent', () => {
  let component: UnitConverterComponent;
  let fixture: ComponentFixture<UnitConverterComponent>;
  let toast: { info: jest.Mock; error: jest.Mock; success: jest.Mock };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UnitConverterComponent],
      providers: [...mathToolTestProviders(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(UnitConverterComponent);
    component = fixture.componentInstance;
    toast = TestBed.inject(ToastService) as unknown as {
      info: jest.Mock;
      error: jest.Mock;
      success: jest.Mock;
    };
    fixture.detectChanges();
  });

  it('should create with length category defaults', () => {
    expect(component).toBeTruthy();
    expect(component.selectedCategory()).toBe('length');
    expect(component.relatedTools.length).toBeGreaterThan(0);
    expect(component.totalUnitCount).toBeGreaterThan(50);
    expect(component.primarySuggestion()?.id).toBe('uc-start');
  });

  it('converts on submit', fakeAsync(() => {
    component.conversionForm.patchValue(
      { inputValue: 1, inputUnit: 'meter', outputUnit: 'foot' },
      { emitEvent: false }
    );
    component.convertNow();
    tick(50);
    expect(component.conversionResult()?.outputValue).toBeCloseTo(3.280839895, 5);
    expect(component.historyCount()).toBeGreaterThan(0);
    expect(component.primarySuggestion()?.id).toBe('uc-general');
    expect(toast.info).toHaveBeenCalledWith('Conversion updated.');
  }));

  it('swaps units', fakeAsync(() => {
    component.convertNow();
    tick(50);
    const beforeFrom = component.conversionForm.controls.inputUnit.value;
    const beforeTo = component.conversionForm.controls.outputUnit.value;
    component.swapUnits();
    tick(150);
    expect(component.conversionForm.controls.inputUnit.value).toBe(beforeTo);
    expect(component.conversionForm.controls.outputUnit.value).toBe(beforeFrom);
    expect(toast.info).toHaveBeenCalledWith('Units swapped.');
  }));

  it('switches categories', fakeAsync(() => {
    component.setCategory('temperature');
    tick(150);
    expect(component.selectedCategory()).toBe('temperature');
    expect(component.categoryMeta().units.some((unit) => unit.id === 'celsius')).toBe(true);
    expect(toast.info).toHaveBeenCalledWith('Temperature converter ready.');
  }));

  it('applies presets', fakeAsync(() => {
    const preset = component.presets()[1];
    component.onPresetChipClick(preset);
    tick(150);
    expect(component.selectedCategory()).toBe(preset.category);
    expect(component.conversionForm.controls.inputUnit.value).toBe(preset.inputUnit);
    expect(toast.info).toHaveBeenCalledWith(`Preset "${preset.name}" applied.`);
  }));

  it('filters categories by search', () => {
    component.onCategorySearch('temperature');
    expect(component.filteredCategories().every((category) => category.id === 'temperature' || category.title.toLowerCase().includes('temperature') || category.description.toLowerCase().includes('temperature') || category.featuredUnits.length > 0)).toBe(true);
    expect(component.filteredCategories().some((category) => category.id === 'temperature')).toBe(true);
  });

  it('dismisses contextual suggestions', fakeAsync(() => {
    component.convertNow();
    tick(50);
    const suggestion = component.primarySuggestion();
    expect(suggestion).toBeTruthy();
    if (suggestion) {
      component.dismissSuggestion(suggestion.id);
      expect(component.primarySuggestion()).toBeNull();
    }
  }));

  it('copies results with toast feedback', async () => {
    component.convertNow();
    Object.assign(navigator, {
      clipboard: { writeText: jest.fn().mockResolvedValue(undefined) }
    });
    await component.copyResult();
    expect(toast.info).toHaveBeenCalledWith('Result copied to clipboard');
  });
});
