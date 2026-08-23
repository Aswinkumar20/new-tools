import type { DdRelatedToolLink } from '../shared/dd-tool-suggestion.model';
import type { GradientPreset } from '../types/css-gradient-generator.types';

export const CSS_GRADIENT_HISTORY_LIMIT = 10;
export const CSS_GRADIENT_ANGLE_MIN = 0;
export const CSS_GRADIENT_ANGLE_MAX = 360;
export const CSS_GRADIENT_DEFAULT_ANGLE = 135;
export const CSS_GRADIENT_DEFAULT_POSITION = 'center';
export const CSS_GRADIENT_DEFAULT_SHAPE = 'ellipse';
export const CSS_GRADIENT_DEFAULT_SIZE = 'farthest-corner';
export const CSS_GRADIENT_FALLBACK_STYLE =
  'linear-gradient(135deg, #007bff 0%, #0056b3 100%)';

export const CSS_GRADIENT_HEX_PATTERN = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

export const CSS_GRADIENT_DEFAULT_STOPS = [
  { color: '#007bff', position: 0 },
  { color: '#0056b3', position: 100 }
] as const;

export const CSS_GRADIENT_PRESETS: ReadonlyArray<GradientPreset> = [
  {
    label: 'Brand CTA',
    description: 'Primary button / hero CTA',
    type: 'linear',
    angle: 135,
    colors: [
      { color: '#007bff', position: 0 },
      { color: '#0056b3', position: 100 }
    ]
  },
  {
    label: 'Sunset hero',
    description: 'Landing-page hero wash',
    type: 'linear',
    angle: 45,
    colors: [
      { color: '#FF6B6B', position: 0 },
      { color: '#FFE66D', position: 100 }
    ]
  },
  {
    label: 'Ocean mesh',
    description: 'Indigo-to-violet overlay',
    type: 'linear',
    angle: 180,
    colors: [
      { color: '#667EEA', position: 0 },
      { color: '#764BA2', position: 100 }
    ]
  },
  {
    label: 'Radial blue',
    description: 'Spotlight / badge fill',
    type: 'radial',
    position: 'center',
    shape: 'circle',
    colors: [
      { color: '#007bff', position: 0 },
      { color: '#0056b3', position: 100 }
    ]
  },
  {
    label: 'Conic rainbow',
    description: 'Progress ring / spinner',
    type: 'conic',
    angle: 0,
    position: 'center',
    colors: [
      { color: '#FF0000', position: 0 },
      { color: '#FFFF00', position: 16.66 },
      { color: '#00FF00', position: 33.33 },
      { color: '#00FFFF', position: 50 },
      { color: '#0000FF', position: 66.66 },
      { color: '#FF0000', position: 100 }
    ]
  }
];

export const CSS_GRADIENT_RELATED_TOOLS: ReadonlyArray<DdRelatedToolLink> = [
  {
    label: 'Border Radius Preview',
    path: '/dev-design-tools/border-radius-preview',
    description: 'Round corners on gradient-filled surfaces'
  },
  {
    label: 'Box Shadow Generator',
    path: '/dev-design-tools/box-shadow-generator',
    description: 'Add elevation to gradient cards and buttons'
  },
  {
    label: 'Pixel to Rem',
    path: '/dev-design-tools/pixel-to-rem',
    description: 'Convert spacing tokens used alongside gradients'
  }
];
