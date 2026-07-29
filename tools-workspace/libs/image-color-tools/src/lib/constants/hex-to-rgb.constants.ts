import type { IctRelatedToolLink } from '../shared/ict-tool-suggestion.model';
import type { HexRgbDefaults } from '../types/hex-to-rgb.types';

export const HEX_RGB_DEBOUNCE_MS = 300;

export const HEX_RGB_HISTORY_LIMIT = 10;

export const HEX_RGB_DEFAULTS: HexRgbDefaults = {
  hex: '#007bff',
  red: 0,
  green: 123,
  blue: 255,
  alpha: 1
};

export const HEX_RGB_ERROR = {
  invalidHex: 'Invalid HEX color format. Use #RRGGBB or #RGB.',
  parseHex: 'Unable to parse HEX color.',
  rgbRange: 'RGB values must be between 0 and 255.'
} as const;

export const HEX_RGB_RELATED_TOOLS: ReadonlyArray<IctRelatedToolLink> = [
  {
    label: 'Color Picker',
    path: '/image-color-tools/color-picker',
    description: 'Visual canvas picker with HSL controls'
  },
  {
    label: 'Gradient Generator',
    path: '/image-color-tools/gradient-generator',
    description: 'Use converted colors as gradient stops'
  },
  {
    label: 'Palette Generator',
    path: '/image-color-tools/palette-generator',
    description: 'Expand one color into a full palette'
  },
  {
    label: 'Favicon Generator',
    path: '/image-color-tools/favicon-generator',
    description: 'Apply HEX/RGB colors to a favicon'
  },
  {
    label: 'Drawing Pad',
    path: '/image-color-tools/drawing-pad',
    description: 'Sketch with the converted brush color'
  }
];
