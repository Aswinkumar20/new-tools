import type { IctRelatedToolLink } from '../shared/ict-tool-suggestion.model';
import type { PaletteMethodOption } from '../types/palette-generator.types';

export const PALETTE_MAX_FILE_SIZE = 25 * 1024 * 1024;

export const PALETTE_HISTORY_LIMIT = 10;

export const PALETTE_DEFAULT_COLOR_COUNT = 5;

export const PALETTE_DEFAULT_METHOD = 'dominant';

/** Max canvas edge used when sampling pixels for extraction. */
export const PALETTE_SAMPLE_MAX_SIZE = 200;

/** Target sample budget used to derive pixel stride. */
export const PALETTE_SAMPLE_BUDGET = 10000;

/** RGB channel quantization step (reduces noise). */
export const PALETTE_QUANTIZE_STEP = 10;

export const PALETTE_EXTRACTION_METHODS: ReadonlyArray<PaletteMethodOption> = [
  { value: 'dominant', label: 'Dominant colors' },
  { value: 'vibrant', label: 'Vibrant colors' },
  { value: 'muted', label: 'Muted colors' },
  { value: 'light', label: 'Light colors' },
  { value: 'dark', label: 'Dark colors' }
];

export const PALETTE_ERROR = {
  invalidImage: 'Please select a valid image file.',
  canvasUnavailable: 'Canvas context not available',
  loadFailed: 'Failed to load image'
} as const;

export const PALETTE_RELATED_TOOLS: ReadonlyArray<IctRelatedToolLink> = [
  {
    label: 'Color Picker',
    path: '/image-color-tools/color-picker',
    description: 'Fine-tune a single extracted HEX with HSL controls'
  },
  {
    label: 'HEX to RGB',
    path: '/image-color-tools/hex-to-rgb',
    description: 'Convert palette HEX values to RGB/HSL formats'
  },
  {
    label: 'Gradient Generator',
    path: '/image-color-tools/gradient-generator',
    description: 'Turn palette stops into CSS gradients'
  },
  {
    label: 'Image Compressor',
    path: '/image-color-tools/image-compressor',
    description: 'Shrink large photos before extraction'
  },
  {
    label: 'Favicon Generator',
    path: '/image-color-tools/favicon-generator',
    description: 'Apply brand colors from the palette to icons'
  }
];
