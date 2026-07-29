import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ToastService } from '@tools-workspace/features-home';
import { ddToolTestProviders } from '../../shared/dd-tool-test.utils';
import { ResponsiveBreakpointTesterComponent } from './responsive-breakpoint-tester';

describe('ResponsiveBreakpointTesterComponent', () => {
  let component: ResponsiveBreakpointTesterComponent;
  let fixture: ComponentFixture<ResponsiveBreakpointTesterComponent>;
  let toast: { info: jest.Mock; error: jest.Mock; success: jest.Mock };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ResponsiveBreakpointTesterComponent],
      providers: [...ddToolTestProviders(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(ResponsiveBreakpointTesterComponent);
    component = fixture.componentInstance;
    toast = TestBed.inject(ToastService) as unknown as {
      info: jest.Mock;
      error: jest.Mock;
      success: jest.Mock;
    };
  });

  it('should create with default desktop preview', () => {
    expect(component).toBeTruthy();
    expect(component.form.controls.width.value).toBe(1280);
    expect(component.activeBreakpoint().name).toBe('Desktop');
    expect(component.iframeUrl()).toBeTruthy();
  });

  it('rejects invalid URLs on load', () => {
    component.form.controls.url.setValue('not-a-url');
    component.loadUrl();
    expect(component.errors()[0]).toContain('http:// or https://');
    expect(component.iframeUrl()).toBeNull();
  });

  it('applies presets and rotates dimensions', () => {
    const mobile = component.presetBreakpoints[0];
    component.applyPreset(mobile);
    expect(component.form.controls.width.value).toBe(mobile.width);
    expect(component.form.controls.height.value).toBe(mobile.height);

    component.rotate();
    expect(component.form.controls.width.value).toBe(mobile.height);
    expect(component.form.controls.height.value).toBe(mobile.width);
  });

  it('copies dimensions via toast clipboard helper', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: jest.fn().mockResolvedValue(undefined) }
    });

    await component.copyDimensions();
    expect(toast.info).toHaveBeenCalled();
    expect(component.primarySuggestion()?.id).toBe('rbt-pixel-rem');
  });

  it('dismisses contextual suggestions', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: jest.fn().mockResolvedValue(undefined) }
    });

    await component.copyDimensions();
    const suggestion = component.primarySuggestion();
    expect(suggestion?.id).toBe('rbt-pixel-rem');
    if (suggestion) {
      component.dismissSuggestion(suggestion.id);
      expect(component.primarySuggestion()).toBeNull();
    }
  });

  it('resets defaults', () => {
    component.form.patchValue({
      url: 'https://other.test',
      width: 375,
      height: 667,
      showGrid: true
    });
    component.reset();
    expect(component.form.controls.url.value).toBe('https://example.com');
    expect(component.form.controls.width.value).toBe(1280);
    expect(component.form.controls.showGrid.value).toBe(false);
  });
});
