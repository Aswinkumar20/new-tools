import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ddToolTestProviders } from '../../shared/dd-tool-test.utils';
import { CssGradientGeneratorComponent } from './css-gradient-generator';

describe('CssGradientGeneratorComponent', () => {
  let component: CssGradientGeneratorComponent;
  let fixture: ComponentFixture<CssGradientGeneratorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CssGradientGeneratorComponent],
      providers: [...ddToolTestProviders(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(CssGradientGeneratorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create with a default linear gradient', () => {
    expect(component).toBeTruthy();
    expect(component.form.controls.type.value).toBe('linear');
    expect(component.hasResult()).toBe(true);
    expect(component.gradientCss()).toContain('linear-gradient(135deg');
    expect(component.primarySuggestion()).toBeNull();
  });

  it('applies the Radial blue preset', () => {
    const radial = component.presets.find((preset) => preset.label === 'Radial blue');
    expect(radial).toBeTruthy();
    if (radial) {
      component.applyPreset(radial);
      expect(component.form.controls.type.value).toBe('radial');
      expect(component.gradientCss()).toContain('radial-gradient');
      expect(component.primarySuggestion()?.id).toBe('cgg-radius');
    }
  });

  it('keeps previous result when a color stop becomes invalid', () => {
    const previous = component.gradientCss();
    component.colorStops.at(0)?.controls.color.setValue('not-hex');
    component.generateGradient();
    expect(component.errors().length).toBeGreaterThan(0);
    expect(component.gradientCss()).toBe(previous);
  });

  it('adds color stops and caps history uniqueness', () => {
    const before = component.colorStops.length;
    component.addColorStop();
    expect(component.colorStops.length).toBe(before + 1);

    for (let angle = 10; angle <= 120; angle += 10) {
      component.form.controls.angle.setValue(angle);
      component.generateGradient();
    }
    expect(component.history().length).toBeLessThanOrEqual(10);
  });

  it('shows a dismissible suggestion after copying CSS', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: jest.fn().mockResolvedValue(undefined) }
    });

    await component.copyToClipboard(component.gradientCss(), 'Gradient CSS');
    expect(component.primarySuggestion()?.id).toBe('cgg-copied-shadow');
    const suggestion = component.primarySuggestion();
    if (suggestion) {
      component.dismissSuggestion(suggestion.id);
      expect(component.primarySuggestion()).toBeNull();
    }
  });

  it('resets to defaults on clear', () => {
    component.form.patchValue({ type: 'conic', angle: 90 });
    component.clear();
    expect(component.form.controls.type.value).toBe('linear');
    expect(component.form.controls.angle.value).toBe(135);
    expect(component.colorStops.length).toBe(2);
  });
});
