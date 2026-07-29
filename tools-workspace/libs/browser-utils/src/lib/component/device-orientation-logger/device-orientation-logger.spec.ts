import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ToastService } from '@tools-workspace/features-home';
import { buToolTestProviders } from '../../shared/bu-tool-test.utils';
import { DeviceOrientationLoggerComponent } from './device-orientation-logger';

describe('DeviceOrientationLoggerComponent', () => {
  let component: DeviceOrientationLoggerComponent;
  let fixture: ComponentFixture<DeviceOrientationLoggerComponent>;
  let toast: { info: jest.Mock; error: jest.Mock; success: jest.Mock };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DeviceOrientationLoggerComponent],
      providers: [...buToolTestProviders(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(DeviceOrientationLoggerComponent);
    component = fixture.componentInstance;
    toast = TestBed.inject(ToastService) as unknown as {
      info: jest.Mock;
      error: jest.Mock;
      success: jest.Mock;
    };
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('formats angles via shared helpers', () => {
    expect(component.formatAngle(null)).toBe('N/A');
    expect(component.formatAngle(45.67)).toBe('45.7°');
  });

  it('sets an unsupported error when start is called without support', async () => {
    component.isSupported.set(false);
    await component.start();
    expect(component.errors()).toEqual(['Device orientation is not supported in this browser.']);
    expect(component.isListening()).toBe(false);
  });

  it('starts and stops listening with toast feedback', async () => {
    component.isSupported.set(true);
    const addSpy = jest.spyOn(window, 'addEventListener');
    const removeSpy = jest.spyOn(window, 'removeEventListener');

    await component.start();
    expect(component.isListening()).toBe(true);
    expect(addSpy).toHaveBeenCalledWith('deviceorientation', expect.any(Function), {
      passive: true
    });
    expect(toast.info).toHaveBeenCalledWith('Orientation logging started');

    component.stop();
    expect(component.isListening()).toBe(false);
    expect(removeSpy).toHaveBeenCalled();
    expect(toast.info).toHaveBeenCalledWith('Orientation logging stopped');
  });

  it('suggests user agent parser when unsupported', () => {
    component.isSupported.set(false);
    expect(component.primarySuggestion()?.path).toBe('/testing-tools/user-agent-parser');
  });

  it('suggests viewport detector while listening with samples', () => {
    component.isSupported.set(true);
    component.isListening.set(true);
    component.samples.set([
      {
        alpha: 1,
        beta: 2,
        gamma: 3,
        absolute: false,
        timestamp: Date.now()
      }
    ]);
    expect(component.primarySuggestion()?.path).toBe('/dev-design-tools/viewport-size-detector');
  });

  it('copies latest sample through shared clipboard helper', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText }
    });

    component.samples.set([
      {
        alpha: 10,
        beta: 20,
        gamma: 30,
        absolute: true,
        timestamp: 1_700_000_000_000
      }
    ]);

    component.copyLatest();
    await Promise.resolve();

    expect(writeText).toHaveBeenCalled();
    expect(toast.info).toHaveBeenCalledWith('Latest sample copied to clipboard');
  });

  it('clears samples and notifies the user', () => {
    component.samples.set([
      {
        alpha: 1,
        beta: 2,
        gamma: 3,
        absolute: false,
        timestamp: Date.now()
      }
    ]);
    component.clear();
    expect(component.samples()).toEqual([]);
    expect(toast.info).toHaveBeenCalledWith('Samples cleared');
  });
});
