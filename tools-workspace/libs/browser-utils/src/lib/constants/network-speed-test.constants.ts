import type { BuRelatedToolLink } from '../shared/bu-tool-suggestion.model';
import type { SpeedTestFormValues } from '../types/network-speed-test.types';

export const SPEED_TEST_RESULT_LIMIT = 20;
export const SPEED_TEST_MIN_RUNS = 1;
export const SPEED_TEST_MAX_RUNS = 5;

export const SPEED_TEST_DEFAULT_FORM_VALUES: SpeedTestFormValues = {
  url: 'https://speed.hetzner.de/1MB.bin',
  sizeBytes: 1_000_000,
  runs: 1
};

export const SPEED_TEST_RELATED_TOOLS: ReadonlyArray<BuRelatedToolLink> = [
  {
    label: 'Battery Status Viewer',
    path: '/browser-utils/battery-status-viewer',
    description: 'Check power before long download runs'
  },
  {
    label: 'Screen Resolution Info',
    path: '/browser-utils/screen-resolution-info',
    description: 'Capture display context for QA notes'
  },
  {
    label: 'User Agent Parser',
    path: '/testing-tools/user-agent-parser',
    description: 'Confirm client and network stack'
  },
  {
    label: 'CORS Test Tool',
    path: '/dev-design-tools/cors-test-tool',
    description: 'Debug blocked cross-origin downloads'
  }
];
