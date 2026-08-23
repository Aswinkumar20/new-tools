import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ToastService } from '@tools-workspace/features-home';
import { COLOR_PICKER_DEBOUNCE_MS } from '../../constants/color-picker.constants';
import { ictToolTestProviders } from '../../shared/ict-tool-test.utils';
import { ColorPickerComponent } from './color-picker';

function mockCanvasContext(): void {
  const ctx = {
    createLinearGradient: () => ({ addColorStop: jest.fn() }),
    fillRect: jest.fn(),
    getImageData: () => ({ data: [0, 123, 255, 255] })
  };
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    value: jest.fn(() => ctx)
  });
}

describe('ColorPickerComponent', () => {
  let component: ColorPickerComponent;
  let fixture: ComponentFixture<ColorPickerComponent>;
  let toast: { info: jest.Mock; error: jest.Mock; success: jest.Mock };

  beforeEach(async () => {
    mockCanvasContext();

    await TestBed.configureTestingModule({
      imports: [ColorPickerComponent],
      providers: [...ictToolTestProviders(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(ColorPickerComponent);
    component = fixture.componentInstance;
    toast = TestBed.inject(ToastService) as unknown as {
      info: jest.Mock;
      error: jest.Mock;
      success: jest.Mock;
    };
    fixture.detectChanges();
  });

  it('should create with default conversion and related tools', fakeAsync(() => {
    tick(0);
    if (!component.result()) {
      component.convertFromHex();
    }
    expect(component).toBeTruthy();
    expect(component.result()?.hex).toBe('#007BFF');
    expect(component.relatedTools.length).toBeGreaterThan(0);
    expect(component.primarySuggestion()).toBeTruthy();
  }));

  it('applies presets and records unique history', fakeAsync(() => {
    tick(0);
    component.applyPreset({ label: 'Red', hex: '#dc3545' });
    expect(component.result()?.hex).toBe('#DC3545');
    expect(component.history().some((entry) => entry.hex === '#DC3545')).toBe(true);
    const count = component.history().length;
    component.applyPreset({ label: 'Red', hex: '#dc3545' });
    expect(component.history().length).toBe(count);
  }));

  it('surfaces invalid hex errors', fakeAsync(() => {
    tick(0);
    component.form.patchValue({ hex: '#xyz' });
    component.convertFromHex();
    expect(component.errors()[0]).toContain('Invalid HEX');
    expect(component.result()).toBeNull();
  }));

  it('resets to defaults', fakeAsync(() => {
    tick(0);
    component.applyPreset({ label: 'Green', hex: '#28a745' });
    component.clear();
    tick(COLOR_PICKER_DEBOUNCE_MS);
    expect(component.result()?.hex).toBe('#007BFF');
    expect(component.form.controls.hex.value.toLowerCase()).toBe('#007bff');
  }));

  it('dismisses contextual suggestions', fakeAsync(() => {
    tick(0);
    const suggestion = component.primarySuggestion();
    expect(suggestion).toBeTruthy();
    if (suggestion) {
      component.dismissSuggestion(suggestion.id);
      expect(component.primarySuggestion()).toBeNull();
    }
  }));

  it('copies values with toast feedback', fakeAsync(async () => {
    tick(0);
    Object.assign(navigator, {
      clipboard: { writeText: jest.fn().mockResolvedValue(undefined) }
    });
    await component.copyToClipboard('#007BFF', 'HEX');
    expect(toast.info).toHaveBeenCalledWith('HEX copied to clipboard');
  }));
});
