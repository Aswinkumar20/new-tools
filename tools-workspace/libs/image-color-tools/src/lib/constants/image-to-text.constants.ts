import type { IctRelatedToolLink } from '../shared/ict-tool-suggestion.model';
import type {
  ImageToTextLanguageOption,
  ImageToTextPsmOption
} from '../types/image-to-text.types';

export const IMAGE_TO_TEXT_MAX_FILE_SIZE = 25 * 1024 * 1024;

export const IMAGE_TO_TEXT_HISTORY_LIMIT = 10;

export const IMAGE_TO_TEXT_DEFAULT_LANGUAGE = 'eng';

export const IMAGE_TO_TEXT_DEFAULT_PSM = 3;

export const IMAGE_TO_TEXT_DEFAULT_OEM = 3;

export const IMAGE_TO_TEXT_LANGUAGES: ReadonlyArray<ImageToTextLanguageOption> = [
  { code: 'eng', name: 'English' },
  { code: 'spa', name: 'Spanish' },
  { code: 'fra', name: 'French' },
  { code: 'deu', name: 'German' },
  { code: 'ita', name: 'Italian' },
  { code: 'por', name: 'Portuguese' },
  { code: 'rus', name: 'Russian' },
  { code: 'chi_sim', name: 'Chinese (Simplified)' },
  { code: 'jpn', name: 'Japanese' },
  { code: 'kor', name: 'Korean' },
  { code: 'ara', name: 'Arabic' },
  { code: 'hin', name: 'Hindi' }
];

export const IMAGE_TO_TEXT_PSM_OPTIONS: ReadonlyArray<ImageToTextPsmOption> = [
  { value: 3, label: 'Fully automatic (default)' },
  { value: 6, label: 'Single uniform block' },
  { value: 7, label: 'Single text line' },
  { value: 8, label: 'Single word' },
  { value: 11, label: 'Sparse text' },
  { value: 12, label: 'Sparse text with OSD' }
];

export const IMAGE_TO_TEXT_FALLBACK_MESSAGE =
  'Text extraction requires Tesseract.js library. Please install tesseract.js package for OCR functionality.\n\nTo install: npm install tesseract.js';

export const IMAGE_TO_TEXT_ERROR = {
  invalidImage: 'Please select a valid image file.',
  clipboardDenied: 'Clipboard access denied.',
  noText:
    'No text detected in the image. Try adjusting the page segmentation mode or ensure the image contains clear text.'
} as const;

export const IMAGE_TO_TEXT_RELATED_TOOLS: ReadonlyArray<IctRelatedToolLink> = [
  {
    label: 'Image Compressor',
    path: '/image-color-tools/image-compressor',
    description: 'Shrink large screenshots before OCR for faster runs'
  },
  {
    label: 'Image Resizer',
    path: '/image-color-tools/image-resizer',
    description: 'Upscale small text images for clearer recognition'
  },
  {
    label: 'Image to Base64',
    path: '/image-color-tools/image-to-base64',
    description: 'Embed the source image when you need a data URI'
  },
  {
    label: 'Palette Generator',
    path: '/image-color-tools/palette-generator',
    description: 'Pull colors from the same screenshot for UI work'
  },
  {
    label: 'Drawing Pad',
    path: '/image-color-tools/drawing-pad',
    description: 'Sketch clear text samples to test OCR settings'
  }
];
