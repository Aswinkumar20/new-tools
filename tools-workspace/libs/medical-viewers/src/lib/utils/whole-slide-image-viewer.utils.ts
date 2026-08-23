import { WSI_SAMPLE_BASE64, WSI_MAX_FILE_BYTES, WSI_SUPPORTED_EXTENSIONS } from '../constants/whole-slide-image-viewer.constants';
import type { WholeSlideLoadedImage, WholeSlideSuggestion } from '../types/whole-slide-image-viewer.types';
import { base64ToUint8Array, formatMedicalFileSize, getFileExtension } from './medical-file.utils';
import { extensionPreferenceWarning } from './wsi-image-load.utils';
import { buildPyramidLevels, pickPyramidLevel } from './wsi-pyramid.utils';
import { exportRegionsJson, createRegionId, nextRegionColor } from './wsi-region.utils';

export {
  downloadBinaryFile,
  downloadTextFile,
  downloadDataUrl,
  formatMedicalFileSize as formatWholeSlideFileSize,
  readFileBytes as readWholeSlideFileBytes
} from './medical-file.utils';

export { exportRegionsJson, createRegionId, nextRegionColor };
export { loadImageFromBytes, buildSlideSourceFromImage, drawSlideToCanvas, mimeForSlideExtension } from './wsi-image-load.utils';
export {
  buildPyramidLevels,
  pickPyramidLevel,
  computeZoomFit as computeWholeSlideZoomFit,
  screenToImage,
  computeVisibleImageRect,
  imageToScreen
} from './wsi-pyramid.utils';

export function isSupportedWholeSlideFile(file: File): boolean {
  return (WSI_SUPPORTED_EXTENSIONS as readonly string[]).includes(getFileExtension(file.name));
}

export function filterValidWholeSlideFiles(files: FileList | File[]): {
  accepted: File[];
  rejected: Array<{ name: string; reason: string }>;
} {
  const accepted: File[] = [];
  const rejected: Array<{ name: string; reason: string }> = [];
  const seen = new Set<string>();
  for (const file of Array.from(files)) {
    const key = `${file.name}|${file.size}|${file.lastModified}`;
    if (seen.has(key)) {
      rejected.push({ name: file.name, reason: 'Duplicate file in this selection' });
      continue;
    }
    seen.add(key);
    if (!isSupportedWholeSlideFile(file)) {
      rejected.push({ name: file.name, reason: 'Unsupported format' });
      continue;
    }
    if (file.size <= 0) {
      rejected.push({ name: file.name, reason: 'File is empty' });
      continue;
    }
    if (file.size > WSI_MAX_FILE_BYTES) {
      rejected.push({ name: file.name, reason: `File too large (max ${formatMedicalFileSize(WSI_MAX_FILE_BYTES)})` });
      continue;
    }
    accepted.push(file);
  }
  return { accepted, rejected };
}

export function createSampleWholeSlideFile(): File {
  const bytes = base64ToUint8Array(WSI_SAMPLE_BASE64);
  return new File([bytes as BlobPart], 'sample-wsi-slide.png', { type: 'image/png', lastModified: 0 });
}

export function createWholeSlideRecord(file: File, bytes: Uint8Array): WholeSlideLoadedImage {
  const extension = getFileExtension(file.name);
  const warnings: string[] = [];
  const pref = extensionPreferenceWarning(extension);
  if (pref) warnings.push(pref);
  return {
    id: `${file.name}|${file.size}|${file.lastModified}`,
    name: file.name,
    size: file.size,
    extension,
    bytes,
    fullWidth: 0,
    fullHeight: 0,
    pyramidLevelCount: 0,
    warnings,
    softFail: false
  };
}

export function applyWholeSlideDimensions(
  record: WholeSlideLoadedImage,
  width: number,
  height: number
): WholeSlideLoadedImage {
  const levels = buildPyramidLevels(width, height);
  return {
    ...record,
    fullWidth: width,
    fullHeight: height,
    pyramidLevelCount: levels.length
  };
}

export function activePyramidLabel(levels: ReturnType<typeof buildPyramidLevels>, zoom: number): string {
  const lv = pickPyramidLevel(levels, zoom);
  return `Level ${lv.level} · ${lv.width}×${lv.height} · ${lv.downsample}×`;
}

export function exportWholeSlideSummaryJson(record: WholeSlideLoadedImage, regionCount: number): string {
  return JSON.stringify(
    {
      name: record.name,
      size: record.size,
      fullWidth: record.fullWidth,
      fullHeight: record.fullHeight,
      pyramidLevelCount: record.pyramidLevelCount,
      regionCount,
      warnings: record.warnings,
      note: 'Education/research WSI preview — not for diagnostic use.'
    },
    null,
    2
  );
}

export function canExportWholeSlide(record: WholeSlideLoadedImage | null): boolean {
  return !!record && record.fullWidth > 0;
}

export function resolveWholeSlideSuggestion(state: {
  hasSlides: boolean;
  hasError: boolean;
}): WholeSlideSuggestion | null {
  if (state.hasError) {
    return {
      id: 'try-sample',
      title: 'Try the sample WSI slide',
      reason: 'Load the embedded slide PNG to verify pyramid zoom and minimap.',
      actionLabel: 'Open sample',
      path: '/medical-viewers/whole-slide-image-viewer'
    };
  }
  if (!state.hasSlides) {
    return {
      id: 'upload',
      title: 'Open a whole slide image locally',
      reason: 'Use PNG/JPEG exports or rendered tiles. Define regions of interest in the sidebar.',
      actionLabel: 'Upload',
      path: '/medical-viewers/whole-slide-image-viewer'
    };
  }
  return null;
}
