import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ToastService } from '@tools-workspace/features-home';
import { ftToolTestProviders } from '../../shared/ft-tool-test.utils';
import { TimezoneConverterComponent } from './timezone-converter';

describe('TimezoneConverterComponent', () => {
  let component: TimezoneConverterComponent;
  let fixture: ComponentFixture<TimezoneConverterComponent>;
  let toast: { info: jest.Mock; error: jest.Mock; success: jest.Mock };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TimezoneConverterComponent],
      providers: [...ftToolTestProviders(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(TimezoneConverterComponent);
    component = fixture.componentInstance;
    toast = TestBed.inject(ToastService) as unknown as {
      info: jest.Mock;
      error: jest.Mock;
      success: jest.Mock;
    };
    fixture.detectChanges();
  });

  it('should create with defaults, conversion, and related tools', () => {
    expect(component).toBeTruthy();
    expect(component.form.controls.dateTime.value).toBeTruthy();
    expect(component.form.controls.targetTimezone.value).toBe('UTC');
    expect(component.hasConversion()).toBe(true);
    expect(component.relatedTools.length).toBeGreaterThan(0);
    expect(component.primarySuggestion()).toBeTruthy();
  });

  it('swaps timezones and updates conversion via form snapshot', fakeAsync(() => {
    component.form.patchValue({
      sourceTimezone: 'UTC',
      targetTimezone: 'Asia/Tokyo'
    });
    tick();
    expect(component.formSnapshot().sourceTimezone).toBe('UTC');
    component.swapTimezones();
    tick();
    expect(component.form.controls.sourceTimezone.value).toBe('Asia/Tokyo');
    expect(component.form.controls.targetTimezone.value).toBe('UTC');
    expect(component.hasConversion()).toBe(true);
  }));

  it('useCurrentTime patches datetime-local value', () => {
    component.form.patchValue({ dateTime: '2020-01-01T00:00' });
    component.useCurrentTime();
    expect(component.form.controls.dateTime.value).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });

  it('dismisses contextual suggestions', () => {
    const suggestion = component.primarySuggestion();
    expect(suggestion).toBeTruthy();
    if (suggestion) {
      component.dismissSuggestion(suggestion.id);
      expect(component.primarySuggestion()).toBeNull();
    }
  });

  it('copies conversion with toast feedback', async () => {
    Object.assign(navigator, {
      clipboard: { writeText: jest.fn().mockResolvedValue(undefined) }
    });
    await component.copyOutput();
    expect(toast.info).toHaveBeenCalledWith('Conversion copied to clipboard');
  });

  it('copies target time with toast feedback', async () => {
    Object.assign(navigator, {
      clipboard: { writeText: jest.fn().mockResolvedValue(undefined) }
    });
    await component.copyTargetTime();
    expect(toast.info).toHaveBeenCalledWith('Target time copied to clipboard');
  });
});
