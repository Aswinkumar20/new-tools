import {
  BATTERY_CRITICAL_THRESHOLD,
  BATTERY_LOW_THRESHOLD
} from '../constants/battery-status.constants';
import type { BatteryStatusSnapshot } from '../types/battery-status.types';
import {
  buildBatteryStatusCopyLines,
  buildBatteryStatusJsonPayload,
  formatBatteryHistoryEntry,
  formatBatteryPercentage,
  formatBatteryTime,
  isBatteryApiSupported,
  isCriticalBatteryLevel,
  isLowBatteryLevel,
  isMeaningfulBatteryChange,
  normalizeBatteryTime,
  resolveBatterySuggestion
} from './battery-status.utils';

describe('battery-status.utils', () => {
  const baseStatus = (overrides: Partial<BatteryStatusSnapshot> = {}): BatteryStatusSnapshot => ({
    charging: false,
    chargingTime: null,
    dischargingTime: 3600,
    level: 0.75,
    timestamp: 1_700_000_000_000,
    ...overrides
  });

  it('detects Battery API support safely', () => {
    expect(isBatteryApiSupported(false, null)).toBe(false);
    expect(isBatteryApiSupported(true, {} as Navigator)).toBe(false);
    expect(
      isBatteryApiSupported(true, {
        getBattery: async () => ({}) as never
      } as never)
    ).toBe(true);
  });

  it('normalizes infinite battery times to null', () => {
    expect(normalizeBatteryTime(Infinity)).toBeNull();
    expect(normalizeBatteryTime(Number.NaN)).toBeNull();
    expect(normalizeBatteryTime(120)).toBe(120);
  });

  it('detects meaningful battery changes', () => {
    const previous = baseStatus({ level: 0.7 });
    expect(isMeaningfulBatteryChange(null, previous)).toBe(true);
    expect(isMeaningfulBatteryChange(previous, baseStatus({ level: 0.7 }))).toBe(false);
    expect(isMeaningfulBatteryChange(previous, baseStatus({ level: 0.69 }))).toBe(true);
    expect(isMeaningfulBatteryChange(previous, baseStatus({ charging: true }))).toBe(true);
  });

  it('classifies low and critical levels', () => {
    expect(isLowBatteryLevel(baseStatus({ level: BATTERY_LOW_THRESHOLD }))).toBe(true);
    expect(isCriticalBatteryLevel(baseStatus({ level: BATTERY_CRITICAL_THRESHOLD }))).toBe(true);
    expect(isLowBatteryLevel(baseStatus({ level: 0.5 }))).toBe(false);
    expect(isCriticalBatteryLevel(baseStatus({ charging: true, level: 0.05 }))).toBe(false);
  });

  it('formats percentage and time labels', () => {
    expect(formatBatteryPercentage(0.756)).toBe('76%');
    expect(formatBatteryTime(null)).toBe('N/A');
    expect(formatBatteryTime(45)).toBe('45s');
    expect(formatBatteryTime(125)).toBe('2m 5s');
    expect(formatBatteryTime(3725)).toBe('1h 2m');
  });

  it('resolves contextual tool suggestions', () => {
    expect(resolveBatterySuggestion(false, null)?.path).toBe('/testing-tools/user-agent-parser');
    expect(resolveBatterySuggestion(true, baseStatus({ level: 0.05 }))?.path).toBe(
      '/browser-utils/screen-resolution-info'
    );
    expect(resolveBatterySuggestion(true, baseStatus({ level: 0.15 }))?.path).toBe(
      '/browser-utils/screen-resolution-info'
    );
    expect(resolveBatterySuggestion(true, baseStatus({ charging: true, level: 0.4 }))?.path).toBe(
      '/dev-design-tools/viewport-size-detector'
    );
    expect(resolveBatterySuggestion(true, baseStatus({ level: 0.8 }))?.path).toBe(
      '/browser-utils/device-orientation-logger'
    );
    expect(resolveBatterySuggestion(true, null)).toBeNull();
  });

  it('builds copy and JSON payloads', () => {
    const status = baseStatus({
      charging: true,
      chargingTime: 1800,
      dischargingTime: null,
      level: 0.5
    });
    const lines = buildBatteryStatusCopyLines(status);
    expect(lines[0]).toContain('50%');
    expect(lines.some((line) => line.includes('Time to full'))).toBe(true);

    const json = buildBatteryStatusJsonPayload(status);
    expect(json['levelPercent']).toBe(50);
    expect(json['chargingTimeLabel']).toBe('30m 0s');
  });

  it('formats history entries', () => {
    const entry = formatBatteryHistoryEntry(
      baseStatus({ charging: false, dischargingTime: 90, level: 0.4 })
    );
    expect(entry).toContain('40%');
    expect(entry).toContain('Discharging');
    expect(entry).toContain('until empty');
  });
});
