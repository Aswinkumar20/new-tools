import type { IctRelatedToolLink } from '../shared/ict-tool-suggestion.model';
import type { ColorPickerDefaults, ColorPreset } from '../types/color-picker.types';

export const COLOR_PICKER_DEBOUNCE_MS = 300;

export const COLOR_PICKER_HISTORY_LIMIT = 10;

export const COLOR_PICKER_CANVAS_SIZE = { width: 300, height: 300 } as const;

export const COLOR_PICKER_HUE_CANVAS_SIZE = { width: 30, height: 300 } as const;

export const COLOR_PICKER_DEFAULTS: ColorPickerDefaults = {
  hex: '#007bff',
  red: 0,
  green: 123,
  blue: 255,
  hue: 214,
  saturation: 100,
  lightness: 50,
  alpha: 1
};

export const COLOR_PICKER_ERROR = {
  invalidHex: 'Invalid HEX color format. Use #RRGGBB or #RGB.',
  parseHex: 'Unable to parse HEX color.',
  rgbRange: 'RGB values must be between 0 and 255.',
  hslRange: 'HSL values must be within valid ranges.'
} as const;

export const COLOR_PICKER_PRESETS: ReadonlyArray<ColorPreset> = [
  { label: 'Blue', hex: '#007bff' },
  { label: 'Indigo', hex: '#6610f2' },
  { label: 'Purple', hex: '#6f42c1' },
  { label: 'Pink', hex: '#e83e8c' },
  { label: 'Red', hex: '#dc3545' },
  { label: 'Orange', hex: '#fd7e14' },
  { label: 'Yellow', hex: '#ffc107' },
  { label: 'Green', hex: '#28a745' },
  { label: 'Teal', hex: '#20c997' },
  { label: 'Cyan', hex: '#17a2b8' },
  { label: 'White', hex: '#ffffff' },
  { label: 'Gray', hex: '#6c757d' },
  { label: 'Dark Gray', hex: '#343a40' },
  { label: 'Black', hex: '#000000' }
];

export const COLOR_PICKER_RELATED_TOOLS: ReadonlyArray<IctRelatedToolLink> = [
  {
    label: 'HEX to RGB',
    path: '/image-color-tools/hex-to-rgb',
    description: 'Convert HEX ↔ RGB with a simpler form'
  },
  {
    label: 'Palette Generator',
    path: '/image-color-tools/palette-generator',
    description: 'Build harmonious palettes from this color'
  },
  {
    label: 'Gradient Generator',
    path: '/image-color-tools/gradient-generator',
    description: 'Turn this color into CSS gradients'
  },
  {
    label: 'Favicon Generator',
    path: '/image-color-tools/favicon-generator',
    description: 'Use the picked color in a favicon'
  },
  {
    label: 'Drawing Pad',
    path: '/image-color-tools/drawing-pad',
    description: 'Sketch with your selected color'
  }
];
