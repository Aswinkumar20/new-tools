import { PATHOLOGY_SAMPLE_BASE64, PATHOLOGY_MAX_FILE_BYTES, PATHOLOGY_SUPPORTED_EXTENSIONS } from '../constants/pathology-slide-viewer.constants';
import type { PathologyLoadedSlide, PathologySuggestion } from '../types/pathology-slide-viewer.types';
import { base64ToUint8Array, formatMedicalFileSize, getFileExtension } from './medical-file.utils';
import { extensionPreferenceWarning } from './wsi-image-load.utils';
import { buildPyramidLevels } from './wsi-pyramid.utils';

export {
  downloadBinaryFile,
  downloadTextFile,
  downloadDataUrl,
  formatMedicalFileSize as formatPathologyFileSize,
  readFileBytes as readPathologyFileBytes
} from './medical-file.utils';

export { exportAnnotationsJson, createAnnotationId, clampAnnotationRect } from './pathology-annotation.utils';
export { loadImageFromBytes, buildSlideSourceFromImage, drawSlideToCanvas, mimeForSlideExtension } from './wsi-image-load.utils';
export { buildPyramidLevels, pickPyramidLevel, computeZoomFit as computePathologyZoomFit, screenToImage } from './wsi-pyramid.utils';

export function isSupportedPathologyFile(file: File): boolean {
  return (PATHOLOGY_SUPPORTED_EXTENSIONS as readonly string[]).includes(getFileExtension(file.name));
}

export function filterValidPathologyFiles(files: FileList | File[]): {
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
    if (!isSupportedPathologyFile(file)) {
      rejected.push({ name: file.name, reason: 'Unsupported format' });
      continue;
    }
    if (file.size <= 0) {
      rejected.push({ name: file.name, reason: 'File is empty' });
      continue;
    }
    if (file.size > PATHOLOGY_MAX_FILE_BYTES) {
      rejected.push({ name: file.name, reason: `File too large (max ${formatMedicalFileSize(PATHOLOGY_MAX_FILE_BYTES)})` });
      continue;
    }
    accepted.push(file);
  }
  return { accepted, rejected };
}

export function createSamplePathologyFile(): File {
  const bytes = base64ToUint8Array(PATHOLOGY_SAMPLE_BASE64);
  return new File([bytes as BlobPart], 'sample-he-slide.png', { type: 'image/png', lastModified: 0 });
}

export function createPathologySlideRecord(file: File, bytes: Uint8Array): PathologyLoadedSlide {
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
    warnings,
    softFail: false
  };
}

export function applySlideDimensions(
  record: PathologyLoadedSlide,
  width: number,
  height: number
): PathologyLoadedSlide {
  return { ...record, fullWidth: width, fullHeight: height };
}

export function exportPathologySummaryJson(record: PathologyLoadedSlide, annotationCount: number): string {
  const levels = buildPyramidLevels(record.fullWidth || 1, record.fullHeight || 1);
  return JSON.stringify(
    {
      name: record.name,
      size: record.size,
      fullWidth: record.fullWidth,
      fullHeight: record.fullHeight,
      pyramidLevels: levels.length,
      annotationCount,
      warnings: record.warnings,
      note: 'Education/research pathology preview — not for diagnostic use.'
    },
    null,
    2
  );
}

export function canExportPathology(record: PathologyLoadedSlide | null): boolean {
  return !!record && record.fullWidth > 0;
}

export function resolvePathologySuggestion(state: {
  hasSlides: boolean;
  hasError: boolean;
}): PathologySuggestion | null {
  if (state.hasError) {
    return {
      id: 'try-sample',
      title: 'Try the sample H&E slide',
      reason: 'Load the embedded pathology PNG to verify deep zoom and annotations.',
      actionLabel: 'Open sample',
      path: '/medical-viewers/pathology-slide-viewer'
    };
  }
  if (!state.hasSlides) {
    return {
      id: 'upload',
      title: 'Open a pathology slide locally',
      reason: 'PNG/JPEG slides stay in your browser. Add point/rectangle annotations for education.',
      actionLabel: 'Upload',
      path: '/medical-viewers/pathology-slide-viewer'
    };
  }
  return null;
}
