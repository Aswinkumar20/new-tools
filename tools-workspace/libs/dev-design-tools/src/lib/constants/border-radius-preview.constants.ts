import type { DdRelatedToolLink } from '../shared/dd-tool-suggestion.model';
import type { BorderRadiusPreset } from '../types/border-radius-preview.types';

export const BORDER_RADIUS_HISTORY_LIMIT = 10;
export const BORDER_RADIUS_MIN = 0;
export const BORDER_RADIUS_MAX = 500;
export const BORDER_RADIUS_DEFAULT = 8;

export const BORDER_RADIUS_PRESETS: ReadonlyArray<BorderRadiusPreset> = [
  {
    label: 'None',
    description: '0px all corners',
    topLeft: 0,
    topRight: 0,
    bottomRight: 0,
    bottomLeft: 0
  },
  {
    label: 'Small',
    description: '4px all corners',
    topLeft: 4,
    topRight: 4,
    bottomRight: 4,
    bottomLeft: 4
  },
  {
    label: 'Medium',
    description: '8px all corners',
    topLeft: 8,
    topRight: 8,
    bottomRight: 8,
    bottomLeft: 8
  },
  {
    label: 'Large',
    description: '16px all corners',
    topLeft: 16,
    topRight: 16,
    bottomRight: 16,
    bottomLeft: 16
  },
  {
    label: 'Extra Large',
    description: '24px all corners',
    topLeft: 24,
    topRight: 24,
    bottomRight: 24,
    bottomLeft: 24
  },
  {
    label: 'Pill',
    description: '9999px all corners (pill shape)',
    topLeft: 9999,
    topRight: 9999,
    bottomRight: 9999,
    bottomLeft: 9999
  },
  {
    label: 'Circle',
    description: '50% all corners',
    topLeft: 50,
    topRight: 50,
    bottomRight: 50,
    bottomLeft: 50
  },
  {
    label: 'Top rounded',
    description: 'Top corners only',
    topLeft: 16,
    topRight: 16,
    bottomRight: 0,
    bottomLeft: 0
  },
  {
    label: 'Bottom rounded',
    description: 'Bottom corners only',
    topLeft: 0,
    topRight: 0,
    bottomRight: 16,
    bottomLeft: 16
  },
  {
    label: 'Left rounded',
    description: 'Left corners only',
    topLeft: 16,
    topRight: 0,
    bottomRight: 0,
    bottomLeft: 16
  },
  {
    label: 'Right rounded',
    description: 'Right corners only',
    topLeft: 0,
    topRight: 16,
    bottomRight: 16,
    bottomLeft: 0
  }
];

export const BORDER_RADIUS_RELATED_TOOLS: ReadonlyArray<DdRelatedToolLink> = [
  {
    label: 'Box Shadow Generator',
    path: '/dev-design-tools/box-shadow-generator',
    description: 'Pair rounded corners with elevation shadows'
  },
  {
    label: 'CSS Gradient Generator',
    path: '/dev-design-tools/css-gradient-generator',
    description: 'Fill rounded surfaces with gradients'
  },
  {
    label: 'Pixel to Rem',
    path: '/dev-design-tools/pixel-to-rem',
    description: 'Convert radius values between px and rem'
  }
];
