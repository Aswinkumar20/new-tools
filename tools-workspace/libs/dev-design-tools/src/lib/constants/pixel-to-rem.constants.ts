import type { DdRelatedToolLink } from '../shared/dd-tool-suggestion.model';
import type { PixelRemCommonSize } from '../types/pixel-to-rem.types';

export const PIXEL_REM_HISTORY_LIMIT = 10;
export const PIXEL_REM_DEFAULT_INPUT = 16;
export const PIXEL_REM_DEFAULT_BASE = 16;
export const PIXEL_REM_BASE_MIN = 1;
export const PIXEL_REM_BASE_MAX = 100;
export const PIXEL_REM_INPUT_MIN = 0;

export const PIXEL_REM_COMMON_SIZES: ReadonlyArray<PixelRemCommonSize> = [
  { px: 8, rem: 0.5 },
  { px: 10, rem: 0.625 },
  { px: 12, rem: 0.75 },
  { px: 14, rem: 0.875 },
  { px: 16, rem: 1 },
  { px: 18, rem: 1.125 },
  { px: 20, rem: 1.25 },
  { px: 24, rem: 1.5 },
  { px: 32, rem: 2 },
  { px: 40, rem: 2.5 },
  { px: 48, rem: 3 },
  { px: 64, rem: 4 }
];

export const PIXEL_REM_RELATED_TOOLS: ReadonlyArray<DdRelatedToolLink> = [
  {
    label: 'Border Radius Preview',
    path: '/dev-design-tools/border-radius-preview',
    description: 'Apply rem-based radii after converting spacing tokens'
  },
  {
    label: 'Box Shadow Generator',
    path: '/dev-design-tools/box-shadow-generator',
    description: 'Convert shadow offsets to rem-friendly values'
  },
  {
    label: 'CSS Gradient Generator',
    path: '/dev-design-tools/css-gradient-generator',
    description: 'Style surfaces that use rem spacing tokens'
  }
];
