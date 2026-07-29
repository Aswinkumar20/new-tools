import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ToastService } from '@tools-workspace/features-home';
import { GRADIENT_DEBOUNCE_MS } from '../../constants/gradient-generator.constants';
import { ictToolTestProviders } from '../../shared/ict-tool-test.utils';
import { GradientGeneratorComponent } from './gradient-generator';

describe('GradientGeneratorComponent', () => {
  let component: GradientGeneratorComponent;
  let fixture: ComponentFixture<GradientGeneratorComponent>;
  let toast: { info: jest.Mock; error: jest.Mock; success: jest.Mock };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GradientGeneratorComponent],
      providers: [...ictToolTestProviders(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(GradientGeneratorComponent);
    component = fixture.componentInstance;
    toast = TestBed.inject(ToastService) as unknown as {
      info: jest.Mock;
      error: jest.Mock;
      success: jest.Mock;
    };
    fixture.detectChanges();
  });

  it('should create with a default linear gradient', () => {
    expect(component).toBeTruthy();
    expect(component.hasResult()).toBe(true);
    expect(component.gradientCss()).toContain('linear-gradient(90deg');
    expect(component.relatedTools.length).toBeGreaterThan(0);
    expect(component.primarySuggestion()).toBeTruthy();
  });

  it('applies presets and keeps unique history', () => {
    const preset = component.presets[0];
    component.applyPreset(preset);
    expect(component.result()?.type).toBe(preset.type);
    expect(component.history().some((entry) => entry.css === component.gradientCss())).toBe(true);
    const count = component.history().length;
    component.generateGradient();
    expect(component.history().length).toBe(count);
  });

  it('requires at least two color stops', () => {
    component.removeColorStop(0);
    expect(component.errors()[0]).toContain('at least two color stops');
  });

  it('adds color stops and regenerates', fakeAsync(() => {
    const before = component.colorStops.length;
    component.addColorStop();
    tick(GRADIENT_DEBOUNCE_MS);
    expect(component.colorStops.length).toBe(before + 1);
    expect(component.hasResult()).toBe(true);
  }));

  it('dismisses contextual suggestions', () => {
    const suggestion = component.primarySuggestion();
    expect(suggestion).toBeTruthy();
    if (suggestion) {
      component.dismissSuggestion(suggestion.id);
      expect(component.primarySuggestion()).toBeNull();
    }
  });

  it('copies CSS with toast feedback', async () => {
    Object.assign(navigator, {
      clipboard: { writeText: jest.fn().mockResolvedValue(undefined) }
    });
    await component.copyToClipboard(component.gradientCss(), 'Gradient CSS');
    expect(toast.info).toHaveBeenCalledWith('Gradient CSS copied to clipboard');
  });
});
