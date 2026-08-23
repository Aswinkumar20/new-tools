import type { DdRelatedToolLink } from '../shared/dd-tool-suggestion.model';
import type { BoxShadowPreset, BoxShadowValues } from '../types/box-shadow-generator.types';

export const BOX_SHADOW_HISTORY_LIMIT = 10;

export const BOX_SHADOW_DEFAULTS: Readonly<BoxShadowValues> = {
  offsetX: 0,
  offsetY: 4,
  blur: 12,
  spread: 0,
  color: 'rgba(0, 0, 0, 0.15)',
  inset: false
};

export const BOX_SHADOW_OFFSET_MIN = -100;
export const BOX_SHADOW_OFFSET_MAX = 100;
export const BOX_SHADOW_BLUR_MIN = 0;
export const BOX_SHADOW_BLUR_MAX = 200;
export const BOX_SHADOW_SPREAD_MIN = -50;
export const BOX_SHADOW_SPREAD_MAX = 50;

export const BOX_SHADOW_PRESETS: ReadonlyArray<BoxShadowPreset> = [
  {
    label: 'None',
    description: 'No shadow',
    offsetX: 0,
    offsetY: 0,
    blur: 0,
    spread: 0,
    color: '#000000',
    inset: false
  },
  {
    label: 'Resting card',
    description: 'Subtle surface elevation',
    offsetX: 0,
    offsetY: 1,
    blur: 3,
    spread: 0,
    color: 'rgba(0, 0, 0, 0.12)',
    inset: false
  },
  {
    label: 'Raised card',
    description: 'Standard card elevation',
    offsetX: 0,
    offsetY: 2,
    blur: 8,
    spread: 0,
    color: 'rgba(0, 0, 0, 0.15)',
    inset: false
  },
  {
    label: 'Modal',
    description: 'Dialog elevation',
    offsetX: 0,
    offsetY: 4,
    blur: 16,
    spread: 0,
    color: 'rgba(0, 0, 0, 0.18)',
    inset: false
  },
  {
    label: 'Popover',
    description: 'Menu / popover elevation',
    offsetX: 0,
    offsetY: 8,
    blur: 24,
    spread: 0,
    color: 'rgba(0, 0, 0, 0.2)',
    inset: false
  },
  {
    label: 'Brand glow',
    description: 'Accent-tinted elevation',
    offsetX: 0,
    offsetY: 4,
    blur: 12,
    spread: 0,
    color: 'rgba(0, 123, 255, 0.3)',
    inset: false
  },
  {
    label: 'Inset',
    description: 'Pressed input / well',
    offsetX: 0,
    offsetY: 2,
    blur: 4,
    spread: 0,
    color: 'rgba(0, 0, 0, 0.15)',
    inset: true
  },
  {
    label: 'Floating card',
    description: 'Soft elevated product card',
    offsetX: 0,
    offsetY: 10,
    blur: 30,
    spread: -5,
    color: 'rgba(0, 0, 0, 0.12)',
    inset: false
  },
  {
    label: 'Top bar',
    description: 'Sticky header shadow',
    offsetX: 0,
    offsetY: -4,
    blur: 8,
    spread: 0,
    color: 'rgba(0, 0, 0, 0.15)',
    inset: false
  },
  {
    label: 'Drawer',
    description: 'Side drawer edge',
    offsetX: 4,
    offsetY: 0,
    blur: 8,
    spread: 0,
    color: 'rgba(0, 0, 0, 0.15)',
    inset: false
  }
];

export const BOX_SHADOW_RELATED_TOOLS: ReadonlyArray<DdRelatedToolLink> = [
  {
    label: 'Border Radius Preview',
    path: '/dev-design-tools/border-radius-preview',
    description: 'Round corners to match elevated card surfaces'
  },
  {
    label: 'CSS Gradient Generator',
    path: '/dev-design-tools/css-gradient-generator',
    description: 'Fill shadowed surfaces with gradients'
  },
  {
    label: 'Pixel to Rem',
    path: '/dev-design-tools/pixel-to-rem',
    description: 'Convert shadow offsets between px and rem'
  }
];
