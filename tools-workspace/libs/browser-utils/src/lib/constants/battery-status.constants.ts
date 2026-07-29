import type { BuRelatedToolLink } from '../shared/bu-tool-suggestion.model';

export const BATTERY_HISTORY_LIMIT = 50;
export const BATTERY_LOW_THRESHOLD = 0.2;
export const BATTERY_CRITICAL_THRESHOLD = 0.1;

export const BATTERY_MANAGER_EVENTS = [
  'chargingchange',
  'chargingtimechange',
  'dischargingtimechange',
  'levelchange'
] as const;

export const BATTERY_RELATED_TOOLS: ReadonlyArray<BuRelatedToolLink> = [
  {
    label: 'Screen Resolution Info',
    path: '/browser-utils/screen-resolution-info',
    description: 'Viewport, DPR, and orientation'
  },
  {
    label: 'Device Orientation Logger',
    path: '/browser-utils/device-orientation-logger',
    description: 'Alpha / beta / gamma stream'
  },
  {
    label: 'Network Speed Test',
    path: '/browser-utils/network-speed-test',
    description: 'Download timing benchmarks'
  },
  {
    label: 'User Agent Parser',
    path: '/testing-tools/user-agent-parser',
    description: 'Browser and device profile'
  }
];
