import type { SafeUrl } from '@angular/platform-browser';
import type { IctToolSuggestion } from '../shared/ict-tool-suggestion.model';
import { ictFormatBytes } from '../shared/ict-format.util';
import {
  IMAGE_TO_TEXT_ERROR,
  IMAGE_TO_TEXT_FALLBACK_MESSAGE,
  IMAGE_TO_TEXT_HISTORY_LIMIT,
  IMAGE_TO_TEXT_LANGUAGES,
  IMAGE_TO_TEXT_MAX_FILE_SIZE
} from '../constants/image-to-text.constants';
import type {
  ImageToTextExtractionResult,
  ImageToTextHistoryEntry,
  ImageToTextLanguageOption,
  ImageToTextStats
} from '../types/image-to-text.types';

export function validateImageToTextFile(file: File): {
  errors: string[] | null;
  isOversized: boolean;
} {
  if (!file.type.startsWith('image/')) {
    return { errors: [IMAGE_TO_TEXT_ERROR.invalidImage], isOversized: false };
  }
  if (file.size > IMAGE_TO_TEXT_MAX_FILE_SIZE) {
    return {
      errors: [
        `File size ${ictFormatBytes(file.size)} exceeds the ${ictFormatBytes(IMAGE_TO_TEXT_MAX_FILE_SIZE)} limit.`,
        'Consider compressing the image before processing.'
      ],
      isOversized: true
    };
  }
  return { errors: null, isOversized: false };
}

export function computeImageToTextStats(text: string): ImageToTextStats {
  const trimmed = text.trim();
  return {
    words: trimmed ? trimmed.split(/\s+/).length : 0,
    characters: text.length,
    lines: trimmed ? text.split('\n').filter((line) => line.trim()).length : 0
  };
}

export function resolveImageToTextLanguageName(
  code: string,
  languages: ReadonlyArray<ImageToTextLanguageOption> = IMAGE_TO_TEXT_LANGUAGES
): string {
  return languages.find((lang) => lang.code === code)?.name ?? 'English';
}

export function buildExtractedTextFilename(filename: string | null): string {
  const base = filename?.replace(/\.[^/.]+$/, '') ?? 'extracted-text';
  return `${base}.txt`;
}

export function getImageToTextFallbackMessage(): string {
  return IMAGE_TO_TEXT_FALLBACK_MESSAGE;
}

/** Extract underlying URL string from Angular SafeUrl (existing history behavior). */
export function extractSafeUrlString(previewUrl: SafeUrl | string): string {
  if (typeof previewUrl === 'string') {
    return previewUrl;
  }
  return (
    (previewUrl as { changingThisBreaksApplicationSecurity?: string })
      ?.changingThisBreaksApplicationSecurity || ''
  );
}

export function createImageToTextHistoryEntry(
  result: ImageToTextExtractionResult,
  now: (() => number) = Date.now
): ImageToTextHistoryEntry {
  return {
    timestamp: now(),
    filename: result.filename,
    text: result.text,
    words: result.words,
    preview: extractSafeUrlString(result.previewUrl)
  };
}

/** Prepend history, skipping duplicates of the same text+filename (existing behavior). */
export function prependImageToTextHistory(
  entries: readonly ImageToTextHistoryEntry[],
  entry: ImageToTextHistoryEntry,
  limit: number = IMAGE_TO_TEXT_HISTORY_LIMIT
): ImageToTextHistoryEntry[] {
  const exists = entries.some((e) => e.text === entry.text && e.filename === entry.filename);
  if (exists) {
    return [...entries];
  }
  return [entry, ...entries].slice(0, limit);
}

export function resolveImageToTextSuggestion(options: {
  hasFile: boolean;
  hasResult: boolean;
  hasError: boolean;
  isOversizedHint: boolean;
  tesseractUnavailable: boolean;
  emptyText: boolean;
  lowConfidence: boolean;
}): IctToolSuggestion | null {
  const {
    hasFile,
    hasResult,
    hasError,
    isOversizedHint,
    tesseractUnavailable,
    emptyText,
    lowConfidence
  } = options;

  if (hasError && isOversizedHint) {
    return {
      id: 'itt-oversized',
      title: 'Image is too large for OCR',
      reason:
        'Uploads cap at 25 MB. Compress the screenshot first, then re-run recognition for faster results.',
      actionLabel: 'Open Image Compressor',
      path: '/image-color-tools/image-compressor'
    };
  }

  if (hasError && !hasFile) {
    return {
      id: 'itt-invalid',
      title: 'That file is not a usable image',
      reason:
        'Choose a JPEG, PNG, or WebP screenshot. Drawing Pad can create a clean text sample to test settings.',
      actionLabel: 'Open Drawing Pad',
      path: '/image-color-tools/drawing-pad'
    };
  }

  if (tesseractUnavailable && !hasResult) {
    return {
      id: 'itt-tesseract',
      title: 'OCR engine is not ready',
      reason:
        'Tesseract.js failed to load. After fixing the install, compress large images so retries stay snappy.',
      actionLabel: 'Open Image Compressor',
      path: '/image-color-tools/image-compressor'
    };
  }

  if (!hasFile) {
    return {
      id: 'itt-start',
      title: 'Upload an image to extract text',
      reason:
        'Clear screenshots work best. Upscale tiny text with Image Resizer, or compress bulky photos first.',
      actionLabel: 'Open Image Resizer',
      path: '/image-color-tools/image-resizer'
    };
  }

  if (hasResult && emptyText) {
    return {
      id: 'itt-empty',
      title: 'No text was detected',
      reason:
        'Try a different page segmentation mode, or resize/crop so letters fill more of the frame.',
      actionLabel: 'Open Image Resizer',
      path: '/image-color-tools/image-resizer'
    };
  }

  if (hasResult && lowConfidence) {
    return {
      id: 'itt-low-confidence',
      title: 'OCR confidence is low',
      reason:
        'Blurry or small text reduces accuracy. Resize for sharper glyphs, then run OCR again.',
      actionLabel: 'Open Image Resizer',
      path: '/image-color-tools/image-resizer'
    };
  }

  if (hasResult) {
    return {
      id: 'itt-next',
      title: 'Text extracted — what’s next?',
      reason:
        'Copy or download the result. Image to Base64 embeds the source if you also need the screenshot inline.',
      actionLabel: 'Open Image to Base64',
      path: '/image-color-tools/image-to-base64'
    };
  }

  return {
    id: 'itt-ready',
    title: 'Ready for OCR',
    reason:
      'Pick a language and segmentation mode, then wait for recognition. Compress first on large files.',
    actionLabel: 'Open Image Compressor',
    path: '/image-color-tools/image-compressor'
  };
}
