import type { DdRelatedToolLink } from '../shared/dd-tool-suggestion.model';
import type { BorderRadiusPreset } from '../types/border-radius-preview.types';

export const BORDER_RADIUS_HISTORY_LIMIT = 10;
export const BORDER_RADIUS_MIN = 0;
export const BORDER_RADIUS_MAX = 500;
export const BORDER_RADIUS_DEFAULT = 8;

export const BORDER_RADIUS_PRESETS: ReadonlyArray<BorderRadiusPreset> = [
  {
    label: 'None',
    description: 'Sharp corners',
    topLeft: 0,
    topRight: 0,
    bottomRight: 0,
    bottomLeft: 0
  },
  {
    label: 'Chip',
    description: '4px filter chip',
    topLeft: 4,
    topRight: 4,
    bottomRight: 4,
    bottomLeft: 4
  },
  {
    label: 'Button',
    description: '8px primary button',
    topLeft: 8,
    topRight: 8,
    bottomRight: 8,
    bottomLeft: 8
  },
  {
    label: 'Product card',
    description: '12px storefront card',
    topLeft: 12,
    topRight: 12,
    bottomRight: 12,
    bottomLeft: 12
  },
  {
    label: 'Modal',
    description: '16px dialog',
    topLeft: 16,
    topRight: 16,
    bottomRight: 16,
    bottomLeft: 16
  },
  {
    label: 'Hero tile',
    description: '24px feature tile',
    topLeft: 24,
    topRight: 24,
    bottomRight: 24,
    bottomLeft: 24
  },
  {
    label: 'Pill',
    description: '9999px pill / badge',
    topLeft: 9999,
    topRight: 9999,
    bottomRight: 9999,
    bottomLeft: 9999
  },
  {
    label: 'Circle',
    description: '50% avatar',
    topLeft: 50,
    topRight: 50,
    bottomRight: 50,
    bottomLeft: 50
  },
  {
    label: 'Top sheet',
    description: 'Rounded top only',
    topLeft: 16,
    topRight: 16,
    bottomRight: 0,
    bottomLeft: 0
  },
  {
    label: 'Bottom sheet',
    description: 'Rounded bottom only',
    topLeft: 0,
    topRight: 0,
    bottomRight: 16,
    bottomLeft: 16
  },
  {
    label: 'Left tab',
    description: 'Rounded left edge',
    topLeft: 16,
    topRight: 0,
    bottomRight: 0,
    bottomLeft: 16
  },
  {
    label: 'Right tab',
    description: 'Rounded right edge',
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
