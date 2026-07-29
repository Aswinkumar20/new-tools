import type { IctRelatedToolLink } from '../shared/ict-tool-suggestion.model';
import type { GradientDefaults, GradientPreset } from '../types/gradient-generator.types';

export const GRADIENT_DEBOUNCE_MS = 200;

export const GRADIENT_HISTORY_LIMIT = 10;

export const GRADIENT_MIN_STOPS = 2;

export const GRADIENT_DEFAULT_PREVIEW =
  'linear-gradient(90deg, #007bff 0%, #0056b3 100%)';

export const GRADIENT_DEFAULTS: GradientDefaults = {
  type: 'linear',
  angle: 90,
  position: 'center',
  shape: 'ellipse',
  size: 'farthest-corner',
  stops: [
    { color: '#007bff', position: 0 },
    { color: '#0056b3', position: 100 }
  ]
};

export const GRADIENT_ERROR = {
  minStops: 'A gradient must have at least two color stops.',
  parseHistory: 'Unable to parse history entry.'
} as const;

export const GRADIENT_PRESETS: ReadonlyArray<GradientPreset> = [
  {
    label: 'Sunset',
    description: 'Linear gradient',
    type: 'linear',
    angle: 45,
    colors: [
      { color: '#FF6B6B', position: 0 },
      { color: '#FFE66D', position: 100 }
    ]
  },
  {
    label: 'Ocean',
    description: 'Linear gradient',
    type: 'linear',
    angle: 180,
    colors: [
      { color: '#667EEA', position: 0 },
      { color: '#764BA2', position: 100 }
    ]
  },
  {
    label: 'Radial sunset',
    description: 'Radial gradient',
    type: 'radial',
    position: 'center',
    shape: 'circle',
    colors: [
      { color: '#FF6B6B', position: 0 },
      { color: '#FFE66D', position: 100 }
    ]
  },
  {
    label: 'Conic rainbow',
    description: 'Conic gradient',
    type: 'conic',
    angle: 0,
    position: 'center',
    colors: [
      { color: '#FF0000', position: 0 },
      { color: '#FFFF00', position: 16.66 },
      { color: '#00FF00', position: 33.33 },
      { color: '#00FFFF', position: 50 },
      { color: '#0000FF', position: 66.66 },
      { color: '#FF00FF', position: 83.33 },
      { color: '#FF0000', position: 100 }
    ]
  }
];

export const GRADIENT_RELATED_TOOLS: ReadonlyArray<IctRelatedToolLink> = [
  {
    label: 'Color Picker',
    path: '/image-color-tools/color-picker',
    description: 'Pick exact HEX values for color stops'
  },
  {
    label: 'Palette Generator',
    path: '/image-color-tools/palette-generator',
    description: 'Build a palette, then turn it into a gradient'
  },
  {
    label: 'HEX to RGB',
    path: '/image-color-tools/hex-to-rgb',
    description: 'Convert stop colors to RGB/HSL channels'
  },
  {
    label: 'Favicon Generator',
    path: '/image-color-tools/favicon-generator',
    description: 'Reuse gradient colors in a brand favicon'
  },
  {
    label: 'Drawing Pad',
    path: '/image-color-tools/drawing-pad',
    description: 'Sketch over a gradient-inspired color set'
  }
];
