import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ToastService } from '@tools-workspace/features-home';
import { ictToolTestProviders } from '../../shared/ict-tool-test.utils';
import { HexToRgbComponent } from './hex-to-rgb';

describe('HexToRgbComponent', () => {
  let component: HexToRgbComponent;
  let fixture: ComponentFixture<HexToRgbComponent>;
  let toast: { info: jest.Mock; error: jest.Mock; success: jest.Mock };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HexToRgbComponent],
      providers: [...ictToolTestProviders(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(HexToRgbComponent);
    component = fixture.componentInstance;
    toast = TestBed.inject(ToastService) as unknown as {
      info: jest.Mock;
      error: jest.Mock;
      success: jest.Mock;
    };
    fixture.detectChanges();
  });

  it('should create with default conversion and related tools', () => {
    expect(component).toBeTruthy();
    expect(component.result()?.hex).toBe('#007BFF');
    expect(component.relatedTools.length).toBeGreaterThan(0);
    expect(component.primarySuggestion()).toBeTruthy();
  });

  it('converts from rgb and switches input mode', () => {
    component.form.patchValue({ red: 255, green: 0, blue: 0 });
    component.onRgbInput();
    expect(component.inputMode()).toBe('rgb');
    expect(component.result()?.hex).toBe('#FF0000');
  });

  it('surfaces invalid hex errors', () => {
    component.form.patchValue({ hex: '#xyz' });
    component.convertFromHex();
    expect(component.errors()[0]).toContain('Invalid HEX');
    expect(component.result()).toBeNull();
  });

  it('prepends history on each conversion', () => {
    const before = component.history().length;
    component.convertFromHex();
    expect(component.history().length).toBeGreaterThan(before);
  });

  it('dismisses contextual suggestions', () => {
    const suggestion = component.primarySuggestion();
    expect(suggestion).toBeTruthy();
    if (suggestion) {
      component.dismissSuggestion(suggestion.id);
      expect(component.primarySuggestion()).toBeNull();
    }
  });

  it('copies values with toast feedback', async () => {
    Object.assign(navigator, {
      clipboard: { writeText: jest.fn().mockResolvedValue(undefined) }
    });
    await component.copyToClipboard('#007BFF', 'HEX');
    expect(toast.info).toHaveBeenCalledWith('HEX copied to clipboard');
  });
});
