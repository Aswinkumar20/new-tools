import type { BuToolSuggestion } from '../shared/bu-tool-suggestion.model';
import {
  BATTERY_CRITICAL_THRESHOLD,
  BATTERY_LOW_THRESHOLD
} from '../constants/battery-status.constants';
import type { BatteryNavigator, BatteryStatusSnapshot } from '../types/battery-status.types';

export function isBatteryApiSupported(isBrowser: boolean, nav: BatteryNavigator | null): boolean {
  if (!isBrowser || !nav) {
    return false;
  }
  return typeof nav.getBattery === 'function' || !!nav.battery;
}

export function normalizeBatteryTime(value: number): number | null {
  return !Number.isFinite(value) || value === Infinity ? null : value;
}

export function isMeaningfulBatteryChange(
  previous: BatteryStatusSnapshot | null,
  next: BatteryStatusSnapshot
): boolean {
  if (!previous) {
    return true;
  }

  return (
    previous.charging !== next.charging ||
    Math.round(previous.level * 100) !== Math.round(next.level * 100) ||
    previous.chargingTime !== next.chargingTime ||
    previous.dischargingTime !== next.dischargingTime
  );
}

export function isLowBatteryLevel(status: BatteryStatusSnapshot | null): boolean {
  return !!status && !status.charging && status.level <= BATTERY_LOW_THRESHOLD;
}

export function isCriticalBatteryLevel(status: BatteryStatusSnapshot | null): boolean {
  return !!status && !status.charging && status.level <= BATTERY_CRITICAL_THRESHOLD;
}

export function formatBatteryPercentage(level: number): string {
  return `${Math.round(level * 100)}%`;
}

export function formatBatteryTime(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds) || seconds === Infinity) {
    return 'N/A';
  }
  if (seconds < 60) {
    return `${Math.round(seconds)}s`;
  }
  if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${minutes}m ${secs}s`;
  }
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

export function formatBatteryTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString();
}

/** Resolve a single high-confidence next-step recommendation from battery context. */
export function resolveBatterySuggestion(
  isSupported: boolean,
  status: BatteryStatusSnapshot | null
): BuToolSuggestion | null {
  if (!isSupported) {
    return {
      id: 'unsupported-ua',
      title: 'Battery API not available here',
      reason:
        'Desktop Safari and Firefox often hide battery data. Parse this browser’s user agent to confirm the client before switching devices.',
      actionLabel: 'Open User Agent Parser',
      path: '/testing-tools/user-agent-parser'
    };
  }

  if (status && !status.charging && status.level <= BATTERY_CRITICAL_THRESHOLD) {
    return {
      id: 'critical-light-check',
      title: 'Battery critically low',
      reason:
        'Prefer a lightweight display check while power is limited. Screen metrics update locally without network load.',
      actionLabel: 'Open Screen Resolution Info',
      path: '/browser-utils/screen-resolution-info'
    };
  }

  if (status && !status.charging && status.level <= BATTERY_LOW_THRESHOLD) {
    return {
      id: 'low-avoid-network',
      title: 'Battery is getting low',
      reason:
        'Heavy download benchmarks drain power faster. Capture display metrics first, then run Network Speed Test after charging.',
      actionLabel: 'Open Screen Resolution Info',
      path: '/browser-utils/screen-resolution-info'
    };
  }

  if (status?.charging) {
    return {
      id: 'charging-device-qa',
      title: 'Good time for device QA',
      reason:
        'While charging, pair battery readings with live viewport and orientation checks for a complete device profile.',
      actionLabel: 'Open Viewport Size Detector',
      path: '/dev-design-tools/viewport-size-detector'
    };
  }

  if (status) {
    return {
      id: 'device-qa-suite',
      title: 'Continue device inspection',
      reason:
        'Battery looks healthy. Log orientation next to build a fuller sensor snapshot for debugging or QA notes.',
      actionLabel: 'Open Device Orientation Logger',
      path: '/browser-utils/device-orientation-logger'
    };
  }

  return null;
}

export function buildBatteryStatusCopyLines(status: BatteryStatusSnapshot): string[] {
  const lines = [
    `Level: ${formatBatteryPercentage(status.level)}`,
    `Charging: ${status.charging ? 'Yes' : 'No'}`,
    `Updated: ${formatBatteryTimestamp(status.timestamp)}`
  ];
  if (status.charging && status.chargingTime !== null) {
    lines.push(`Time to full: ${formatBatteryTime(status.chargingTime)}`);
  }
  if (!status.charging && status.dischargingTime !== null) {
    lines.push(`Time until empty: ${formatBatteryTime(status.dischargingTime)}`);
  }
  return lines;
}

export function buildBatteryStatusJsonPayload(status: BatteryStatusSnapshot): Record<string, unknown> {
  return {
    ...status,
    levelPercent: Math.round(status.level * 100),
    chargingTimeLabel: status.chargingTime !== null ? formatBatteryTime(status.chargingTime) : null,
    dischargingTimeLabel:
      status.dischargingTime !== null ? formatBatteryTime(status.dischargingTime) : null,
    updatedAt: new Date(status.timestamp).toISOString()
  };
}

export function formatBatteryHistoryEntry(entry: BatteryStatusSnapshot): string {
  const parts = [
    `[${formatBatteryTimestamp(entry.timestamp)}]`,
    `${formatBatteryPercentage(entry.level)}`,
    entry.charging ? 'Charging' : 'Discharging'
  ];
  if (entry.charging && entry.chargingTime !== null) {
    parts.push(`to full: ${formatBatteryTime(entry.chargingTime)}`);
  }
  if (!entry.charging && entry.dischargingTime !== null) {
    parts.push(`until empty: ${formatBatteryTime(entry.dischargingTime)}`);
  }
  return parts.join(' · ');
}
