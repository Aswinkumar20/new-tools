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
    label: 'Small',
    description: 'Subtle shadow',
    offsetX: 0,
    offsetY: 1,
    blur: 3,
    spread: 0,
    color: 'rgba(0, 0, 0, 0.12)',
    inset: false
  },
  {
    label: 'Medium',
    description: 'Standard shadow',
    offsetX: 0,
    offsetY: 2,
    blur: 8,
    spread: 0,
    color: 'rgba(0, 0, 0, 0.15)',
    inset: false
  },
  {
    label: 'Large',
    description: 'Prominent shadow',
    offsetX: 0,
    offsetY: 4,
    blur: 16,
    spread: 0,
    color: 'rgba(0, 0, 0, 0.18)',
    inset: false
  },
  {
    label: 'Extra Large',
    description: 'Dramatic shadow',
    offsetX: 0,
    offsetY: 8,
    blur: 24,
    spread: 0,
    color: 'rgba(0, 0, 0, 0.2)',
    inset: false
  },
  {
    label: 'Blue shadow',
    description: 'Blue themed shadow',
    offsetX: 0,
    offsetY: 4,
    blur: 12,
    spread: 0,
    color: 'rgba(0, 123, 255, 0.3)',
    inset: false
  },
  {
    label: 'Inset',
    description: 'Inset shadow',
    offsetX: 0,
    offsetY: 2,
    blur: 4,
    spread: 0,
    color: 'rgba(0, 0, 0, 0.15)',
    inset: true
  },
  {
    label: 'Soft elevation',
    description: 'Soft elevated card shadow',
    offsetX: 0,
    offsetY: 10,
    blur: 30,
    spread: -5,
    color: 'rgba(0, 0, 0, 0.12)',
    inset: false
  },
  {
    label: 'Top shadow',
    description: 'Shadow above',
    offsetX: 0,
    offsetY: -4,
    blur: 8,
    spread: 0,
    color: 'rgba(0, 0, 0, 0.15)',
    inset: false
  },
  {
    label: 'Right shadow',
    description: 'Shadow to the right',
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
