import type { BuRelatedToolLink } from '../shared/bu-tool-suggestion.model';

export const SCREEN_MOBILE_VIEWPORT_MAX = 767;
export const SCREEN_TABLET_VIEWPORT_MAX = 1023;

export const SCREEN_RELATED_TOOLS: ReadonlyArray<BuRelatedToolLink> = [
  {
    label: 'Viewport Size Detector',
    path: '/dev-design-tools/viewport-size-detector',
    description: 'Live viewport and media-query checks'
  },
  {
    label: 'Responsive Breakpoint Tester',
    path: '/dev-design-tools/responsive-breakpoint-tester',
    description: 'Validate layouts across breakpoints'
  },
  {
    label: 'Device Orientation Logger',
    path: '/browser-utils/device-orientation-logger',
    description: 'Alpha / beta / gamma motion stream'
  },
  {
    label: 'User Agent Parser',
    path: '/testing-tools/user-agent-parser',
    description: 'Confirm device and browser profile'
  }
];
