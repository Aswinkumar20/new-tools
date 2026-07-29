import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ddToolTestProviders } from '../../shared/dd-tool-test.utils';
import { BorderRadiusPreviewComponent } from './border-radius-preview';

describe('BorderRadiusPreviewComponent', () => {
  let component: BorderRadiusPreviewComponent;
  let fixture: ComponentFixture<BorderRadiusPreviewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BorderRadiusPreviewComponent],
      providers: [...ddToolTestProviders(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(BorderRadiusPreviewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create with default uniform radius', () => {
    expect(component).toBeTruthy();
    expect(component.form.controls.mode.value).toBe('uniform');
    expect(component.form.controls.uniform.value).toBe(8);
    expect(component.borderRadiusCss()).toBe('border-radius: 8px;');
  });

  it('syncs corners when uniform value changes', () => {
    component.form.controls.uniform.setValue(12);
    component.onUniformChange();
    expect(component.form.controls.topLeft.value).toBe(12);
    expect(component.form.controls.bottomRight.value).toBe(12);
  });

  it('applies the Circle preset with percent units', () => {
    const circle = component.presets.find((preset) => preset.label === 'Circle');
    expect(circle).toBeTruthy();
    if (circle) {
      component.applyPreset(circle);
      expect(component.form.controls.unit.value).toBe('%');
      expect(component.form.controls.topLeft.value).toBe(50);
      expect(component.borderRadiusStyle()).toContain('50%');
    }
  });

  it('records history and can restore an entry', () => {
    component.form.patchValue({
      mode: 'individual',
      topLeft: 10,
      topRight: 20,
      bottomRight: 30,
      bottomLeft: 40,
      uniform: 10
    });
    component['refreshDerivedState']();
    expect(component.hasHistory()).toBe(true);

    const entry = component.history().find((item) => item.css.includes('10px 20px')) ?? component.history()[0];
    component.clear();
    component.applyHistory(entry);
    expect(component.form.controls.topLeft.value).toBe(entry.values.topLeft);
    expect(component.form.controls.topRight.value).toBe(entry.values.topRight);
  });

  it('caps history at ten unique CSS snapshots', () => {
    for (let i = 1; i <= 12; i++) {
      component.form.controls.uniform.setValue(i);
      component.onUniformChange();
    }
    expect(component.history().length).toBeLessThanOrEqual(10);
  });
  it('shows a dismissible suggestion after copying CSS', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: jest.fn().mockResolvedValue(undefined) }
    });

    await component.copyToClipboard(component.borderRadiusCss(), 'Border radius CSS');
    expect(component.primarySuggestion()?.id).toBe('brp-shadow');
    const suggestion = component.primarySuggestion();
    if (suggestion) {
      component.dismissSuggestion(suggestion.id);
      expect(component.primarySuggestion()).toBeNull();
    }
  });
});
