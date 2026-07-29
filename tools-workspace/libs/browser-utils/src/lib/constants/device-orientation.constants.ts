import type { BuRelatedToolLink } from '../shared/bu-tool-suggestion.model';

export const ORIENTATION_SAMPLE_LIMIT = 50;

export const ORIENTATION_RELATED_TOOLS: ReadonlyArray<BuRelatedToolLink> = [
  {
    label: 'Battery Status Viewer',
    path: '/browser-utils/battery-status-viewer',
    description: 'Monitor charging state and level'
  },
  {
    label: 'Screen Resolution Info',
    path: '/browser-utils/screen-resolution-info',
    description: 'Viewport, DPR, and orientation type'
  },
  {
    label: 'Viewport Size Detector',
    path: '/dev-design-tools/viewport-size-detector',
    description: 'Live viewport and media-query checks'
  },
  {
    label: 'User Agent Parser',
    path: '/testing-tools/user-agent-parser',
    description: 'Confirm device and browser profile'
  }
];
