import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ToastService } from '@tools-workspace/features-home';
import { buToolTestProviders } from '../../shared/bu-tool-test.utils';
import { BatteryStatusViewerComponent } from './battery-status-viewer';
import type { BatteryStatusSnapshot } from '../../types/battery-status.types';

describe('BatteryStatusViewerComponent', () => {
  let component: BatteryStatusViewerComponent;
  let fixture: ComponentFixture<BatteryStatusViewerComponent>;
  let toast: { info: jest.Mock; error: jest.Mock; success: jest.Mock };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BatteryStatusViewerComponent],
      providers: [...buToolTestProviders(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(BatteryStatusViewerComponent);
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

  it('formats percentages and times via helpers', () => {
    expect(component.formatPercentage(0.756)).toBe('76%');
    expect(component.formatTime(null)).toBe('N/A');
    expect(component.formatTime(45)).toBe('45s');
  });

  it('suggests User Agent Parser when Battery API is unsupported', () => {
    component.isSupported.set(false);
    component.currentStatus.set(null);
    expect(component.primarySuggestion()?.path).toBe('/testing-tools/user-agent-parser');
  });

  it('suggests a lightweight tool when battery is critically low', () => {
    component.isSupported.set(true);
    component.currentStatus.set({
      charging: false,
      chargingTime: null,
      dischargingTime: 600,
      level: 0.05,
      timestamp: Date.now(),
    });
    expect(component.isCriticalBattery()).toBe(true);
    expect(component.primarySuggestion()?.path).toBe('/browser-utils/screen-resolution-info');
  });

  it('hides dismissed suggestions until context changes', () => {
    component.isSupported.set(true);
    component.currentStatus.set({
      charging: false,
      chargingTime: null,
      dischargingTime: 7200,
      level: 0.82,
      timestamp: Date.now(),
    });
    const suggestion = component.primarySuggestion();
    expect(suggestion?.id).toBe('device-qa-suite');
    component.dismissSuggestion(suggestion!.id);
    expect(component.primarySuggestion()).toBeNull();

    component.currentStatus.set({
      charging: true,
      chargingTime: 1200,
      dischargingTime: null,
      level: 0.5,
      timestamp: Date.now(),
    });
    expect(component.primarySuggestion()?.id).toBe('charging-device-qa');
  });

  it('copies status text via shared clipboard helper', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    component.currentStatus.set({
      charging: true,
      chargingTime: 1800,
      dischargingTime: null,
      level: 0.5,
      timestamp: Date.now(),
    });

    component.copyStatus();
    await Promise.resolve();

    expect(writeText).toHaveBeenCalled();
    expect(toast.info).toHaveBeenCalledWith('Battery status copied to clipboard');
  });

  it('does not append duplicate history when values are unchanged', () => {
    const status: BatteryStatusSnapshot = {
      charging: false,
      chargingTime: null,
      dischargingTime: 3600,
      level: 0.7,
      timestamp: Date.now(),
    };

    (component as unknown as { batteryManager: object }).batteryManager = {
      charging: status.charging,
      chargingTime: Infinity,
      dischargingTime: 3600,
      level: 0.7,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    };

    (component as unknown as { syncBatteryStatus: (force?: boolean) => void }).syncBatteryStatus(true);
    expect(component.history().length).toBe(1);

    (component as unknown as { syncBatteryStatus: (force?: boolean) => void }).syncBatteryStatus(false);
    expect(component.history().length).toBe(1);
  });

  it('clears history and notifies the user', () => {
    component.history.set([
      {
        charging: false,
        chargingTime: null,
        dischargingTime: null,
        level: 0.4,
        timestamp: Date.now(),
      },
    ]);

    component.clearHistory();
    expect(component.history()).toEqual([]);
    expect(toast.info).toHaveBeenCalledWith('History cleared');
  });
});
