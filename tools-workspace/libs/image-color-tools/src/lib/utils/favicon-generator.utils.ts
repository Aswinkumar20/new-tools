import type { IctToolSuggestion } from '../shared/ict-tool-suggestion.model';
import { FAVICON_HISTORY_LIMIT } from '../constants/favicon-generator.constants';
import type {
  FaviconFormat,
  FaviconHistoryEntry,
  FaviconMode,
  FaviconResult,
  FaviconSize
} from '../types/favicon-generator.types';

export function buildFaviconHtmlCode(dataUrl: string, size: FaviconSize): string {
  const sizes = size === 32 ? '32x32' : `${size}x${size}`;
  return `<link rel="icon" type="image/png" sizes="${sizes}" href="${dataUrl}">`;
}

export function buildFaviconFilename(size: FaviconSize, format: FaviconFormat): string {
  const extension = format === 'ico' ? 'ico' : 'png';
  return `favicon-${size}x${size}.${extension}`;
}

export function createFaviconHistoryEntry(
  result: FaviconResult,
  mode: FaviconMode,
  now: (() => number) = Date.now
): FaviconHistoryEntry {
  return {
    timestamp: now(),
    mode,
    preview: result.dataUrl,
    size: result.size
  };
}

/** Prepend history, skipping duplicate preview+size pairs (existing behavior). */
export function prependUniqueFaviconHistory(
  entries: readonly FaviconHistoryEntry[],
  entry: FaviconHistoryEntry,
  limit: number = FAVICON_HISTORY_LIMIT
): FaviconHistoryEntry[] {
  if (entries.some((existing) => existing.preview === entry.preview && existing.size === entry.size)) {
    return [...entries];
  }
  return [entry, ...entries].slice(0, limit);
}

export function computeContainFit(
  imageWidth: number,
  imageHeight: number,
  boxSize: number
): { width: number; height: number; x: number; y: number } {
  const scale = Math.min(boxSize / imageWidth, boxSize / imageHeight);
  const width = imageWidth * scale;
  const height = imageHeight * scale;
  return {
    width,
    height,
    x: (boxSize - width) / 2,
    y: (boxSize - height) / 2
  };
}

export function drawTextFavicon(
  ctx: CanvasRenderingContext2D,
  size: number,
  text: string,
  fontSize: number,
  fontFamily: string,
  textColor: string
): void {
  ctx.fillStyle = textColor;
  ctx.font = `bold ${fontSize}px ${fontFamily}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, size / 2, size / 2);
}

export function drawEmojiFavicon(
  ctx: CanvasRenderingContext2D,
  size: number,
  emoji: string,
  fontSize: number
): void {
  ctx.font = `${fontSize}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(emoji, size / 2, size / 2);
}

export function drawImageFavicon(
  ctx: CanvasRenderingContext2D,
  size: number,
  img: HTMLImageElement
): void {
  const fit = computeContainFit(img.width, img.height, size);
  ctx.drawImage(img, fit.x, fit.y, fit.width, fit.height);
}

export function resolveFaviconSuggestion(options: {
  mode: FaviconMode;
  hasResult: boolean;
  hasUploadedImage: boolean;
  hasError: boolean;
  historyCount: number;
}): IctToolSuggestion | null {
  const { mode, hasResult, hasUploadedImage, hasError, historyCount } = options;

  if (hasError && mode === 'image' && !hasUploadedImage) {
    return {
      id: 'fg-need-image',
      title: 'Image mode needs an upload',
      reason:
        'Switch to Image mode only after choosing a file, or sketch one in Drawing Pad first.',
      actionLabel: 'Open Drawing Pad',
      path: '/image-color-tools/drawing-pad'
    };
  }

  if (mode === 'image' && !hasUploadedImage) {
    return {
      id: 'fg-upload',
      title: 'Upload an image to continue',
      reason:
        'Image mode draws your uploaded asset scaled to fit. Drawing Pad can create a simple icon first.',
      actionLabel: 'Open Drawing Pad',
      path: '/image-color-tools/drawing-pad'
    };
  }

  if (hasResult) {
    return {
      id: 'fg-compress',
      title: 'Optimize before shipping?',
      reason:
        'Image Compressor can shrink the PNG favicon, or Image to Base64 embeds it as a data URL.',
      actionLabel: 'Open Image Compressor',
      path: '/image-color-tools/image-compressor'
    };
  }

  if (historyCount >= 3) {
    return {
      id: 'fg-history',
      title: 'Comparing recent favicons?',
      reason:
        'You have several history entries. Color Picker helps refine brand colors for the next pass.',
      actionLabel: 'Open Color Picker',
      path: '/image-color-tools/color-picker'
    };
  }

  return {
    id: 'fg-start',
    title: 'Start with text or emoji',
    reason:
      'Defaults generate a live preview. Use Color Picker when you need exact brand HEX values.',
    actionLabel: 'Open Color Picker',
    path: '/image-color-tools/color-picker'
  };
}
