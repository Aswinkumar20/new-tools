import type { IctRelatedToolLink } from '../shared/ict-tool-suggestion.model';
import type { DrawingPadDefaults } from '../types/drawing-pad.types';

export const DRAWING_PAD_INIT_DELAY_MS = 100;

export const DRAWING_PAD_HISTORY_LIMIT = 20;

export const DRAWING_PAD_CONTAINER_PADDING = 32;

export const DRAWING_PAD_MIN_SIZE = 400;

export const DRAWING_PAD_FALLBACK_SIZE = { width: 800, height: 600 } as const;

export const DRAWING_PAD_BACKGROUND = '#ffffff';

export const DRAWING_PAD_DEFAULTS: DrawingPadDefaults = {
  tool: 'pen',
  color: '#007bff',
  brushSize: 10,
  lineWidth: 2
};

export const DRAWING_PAD_BRUSH_MIN = 1;
export const DRAWING_PAD_BRUSH_MAX = 100;
export const DRAWING_PAD_LINE_MAX = 50;

export const DRAWING_PAD_RELATED_TOOLS: ReadonlyArray<IctRelatedToolLink> = [
  {
    label: 'Color Picker',
    path: '/image-color-tools/color-picker',
    description: 'Pick HEX/RGB colors for the brush'
  },
  {
    label: 'Favicon Generator',
    path: '/image-color-tools/favicon-generator',
    description: 'Turn a simple sketch into a favicon'
  },
  {
    label: 'Image Resizer',
    path: '/image-color-tools/image-resizer',
    description: 'Resize your PNG after download'
  },
  {
    label: 'Image Compressor',
    path: '/image-color-tools/image-compressor',
    description: 'Shrink the exported PNG for sharing'
  },
  {
    label: 'Image to Base64',
    path: '/image-color-tools/image-to-base64',
    description: 'Embed the drawing as a data URL'
  }
];
