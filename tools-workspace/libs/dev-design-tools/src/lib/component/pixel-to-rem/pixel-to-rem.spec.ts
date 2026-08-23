import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ddToolTestProviders } from '../../shared/dd-tool-test.utils';
import { PixelToRemComponent } from './pixel-to-rem';

describe('PixelToRemComponent', () => {
  let component: PixelToRemComponent;
  let fixture: ComponentFixture<PixelToRemComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PixelToRemComponent],
      providers: [...ddToolTestProviders(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(PixelToRemComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create with default 16px → 1rem', () => {
    expect(component).toBeTruthy();
    expect(component.conversionResult()?.output).toBe(1);
    expect(component.primarySuggestion()).toBeNull();
  });

  it('swaps direction using the current output', () => {
    component.form.controls.inputValue.setValue(32);
    component['refreshDerivedState']();
    component.swapDirection();
    expect(component.form.controls.direction.value).toBe('rem-to-px');
    expect(component.form.controls.inputValue.value).toBe(2);
  });

  it('applies common sizes for the active direction', () => {
    component.applyCommonSize({ px: 24, rem: 1.5 });
    expect(component.form.controls.inputValue.value).toBe(24);
    component.swapDirection();
    component.applyCommonSize({ px: 24, rem: 1.5 });
    expect(component.form.controls.inputValue.value).toBe(1.5);
  });

  it('records unique history entries', () => {
    component.form.controls.inputValue.setValue(20);
    component['refreshDerivedState']();
    component['refreshDerivedState']();
    expect(component.history().filter((e) => e.input === 20).length).toBe(1);
  });

  it('shows a dismissible suggestion after copying', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: jest.fn().mockResolvedValue(undefined) }
    });

    await component.copyToClipboard('1rem', 'Result');
    expect(component.primarySuggestion()?.id).toBe('ptr-shadow');
    const suggestion = component.primarySuggestion();
    if (suggestion) {
      component.dismissSuggestion(suggestion.id);
      expect(component.primarySuggestion()).toBeNull();
    }
  });

  it('resets input and base on clear', () => {
    component.form.patchValue({ inputValue: 40, baseSize: 18 });
    component.clear();
    expect(component.form.controls.inputValue.value).toBe(16);
    expect(component.form.controls.baseSize.value).toBe(16);
  });
});
