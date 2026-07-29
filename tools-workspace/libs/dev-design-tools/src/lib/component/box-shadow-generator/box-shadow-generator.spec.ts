import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ddToolTestProviders } from '../../shared/dd-tool-test.utils';
import { BoxShadowGeneratorComponent } from './box-shadow-generator';

describe('BoxShadowGeneratorComponent', () => {
  let component: BoxShadowGeneratorComponent;
  let fixture: ComponentFixture<BoxShadowGeneratorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BoxShadowGeneratorComponent],
      providers: [...ddToolTestProviders(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(BoxShadowGeneratorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create with default shadow values', () => {
    expect(component).toBeTruthy();
    expect(component.form.controls.offsetY.value).toBe(4);
    expect(component.form.controls.blur.value).toBe(12);
    expect(component.boxShadowCss()).toBe('box-shadow: 0px 4px 12px 0px rgba(0, 0, 0, 0.15);');
    expect(component.primarySuggestion()).toBeNull();
  });

  it('applies the Inset preset', () => {
    const inset = component.presets.find((preset) => preset.label === 'Inset');
    expect(inset).toBeTruthy();
    if (inset) {
      component.applyPreset(inset);
      expect(component.form.controls.inset.value).toBe(true);
      expect(component.boxShadowStyle()).toContain('inset');
      expect(component.primarySuggestion()?.id).toBe('bsg-inset-radius');
    }
  });

  it('records history and can restore an entry', () => {
    component.form.patchValue({
      offsetX: 6,
      offsetY: 8,
      blur: 20,
      spread: 2
    });
    component['refreshDerivedState']();
    expect(component.hasHistory()).toBe(true);

    const entry =
      component.history().find((item) => item.css.includes('6px 8px')) ?? component.history()[0];
    component.clear();
    component.applyHistory(entry);
    expect(component.form.controls.offsetX.value).toBe(entry.values.offsetX);
    expect(component.form.controls.blur.value).toBe(entry.values.blur);
  });

  it('caps history at ten unique CSS snapshots', () => {
    for (let i = 1; i <= 12; i++) {
      component.form.controls.offsetY.setValue(i);
      component['refreshDerivedState']();
    }
    expect(component.history().length).toBeLessThanOrEqual(10);
  });

  it('validates invalid color input', () => {
    component.form.controls.color.setValue('not-a-color');
    component['refreshDerivedState']();
    expect(component.errors().length).toBeGreaterThan(0);
  });

  it('shows a dismissible suggestion after copying CSS', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: jest.fn().mockResolvedValue(undefined) }
    });

    await component.copyToClipboard(component.boxShadowCss(), 'Box shadow CSS');
    expect(component.primarySuggestion()?.id).toBe('bsg-radius');
    const suggestion = component.primarySuggestion();
    if (suggestion) {
      component.dismissSuggestion(suggestion.id);
      expect(component.primarySuggestion()).toBeNull();
    }
  });
});
