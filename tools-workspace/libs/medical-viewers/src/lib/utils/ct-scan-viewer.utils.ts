import {
  CT_PREFERRED_MODALITY,
  CT_SAMPLE_BASE64
} from '../constants/ct-scan-viewer.constants';
import type {
  CtLoadedFile,
  CtMeasurePoint,
  CtMeasureResult,
  CtSuggestion
} from '../types/ct-scan-viewer.types';
import { base64ToUint8Array } from './medical-file.utils';
import {
  canExportDicom,
  createDicomFileRecord,
  defaultWindowForParsed,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  exportDicomMetadataJson,
  exportDicomSummaryJson,
  filterValidDicomFiles,
  formatDicomFileSize,
  probeDicomPixel,
  readDicomFileBytes,
  sortDicomSeries
} from './dicom-viewer.utils';
import { groupBySeries, sortSlices } from './dicom-series.utils';

export {
  canExportDicom as canExportCt,
  createDicomFileRecord as createCtFileRecord,
  defaultWindowForParsed as defaultWindowForCt,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  exportDicomMetadataJson as exportCtMetadataJson,
  exportDicomSummaryJson as exportCtSummaryJson,
  filterValidDicomFiles as filterValidCtFiles,
  formatDicomFileSize as formatCtFileSize,
  probeDicomPixel as probeCtPixel,
  readDicomFileBytes as readCtFileBytes,
  sortDicomSeries,
  groupBySeries,
  sortSlices
};

export function createSampleCtFile(): File {
  const bytes = base64ToUint8Array(CT_SAMPLE_BASE64);
  return new File([bytes as BlobPart], 'sample-chest-ct.dcm', {
    type: 'application/dicom',
    lastModified: 0
  });
}

/** Soft preference for Modality CT — warn but still load other modalities. */
export function modalityPreferenceWarning(modality: string | undefined | null): string | null {
  const mod = (modality || '').trim().toUpperCase();
  if (!mod) {
    return `Modality tag missing — preferred modality is ${CT_PREFERRED_MODALITY}. File still loaded.`;
  }
  if (mod !== CT_PREFERRED_MODALITY) {
    return `Modality is ${mod} (preferred: ${CT_PREFERRED_MODALITY}). File still loaded for education/research.`;
  }
  return null;
}

export function enrichCtFileRecord(file: CtLoadedFile): CtLoadedFile {
  const warning = modalityPreferenceWarning(file.parsed?.modality);
  if (!warning) return file;
  if (file.warnings.includes(warning)) return file;
  return {
    ...file,
    warnings: [...file.warnings, warning]
  };
}

export function distancePx(a: CtMeasurePoint, b: CtMeasurePoint): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/**
 * PixelSpacing is [rowSpacingMm, columnSpacingMm] (DICOM 0028,0030).
 * Distance uses anisotropic spacing when present.
 */
export function distanceMm(
  a: CtMeasurePoint,
  b: CtMeasurePoint,
  pixelSpacing: [number, number] | null | undefined
): number | null {
  if (!pixelSpacing || pixelSpacing.length < 2) return null;
  const rowSp = pixelSpacing[0];
  const colSp = pixelSpacing[1];
  if (!Number.isFinite(rowSp) || !Number.isFinite(colSp) || rowSp <= 0 || colSp <= 0) {
    return null;
  }
  const dy = (b.y - a.y) * rowSp;
  const dx = (b.x - a.x) * colSp;
  return Math.hypot(dx, dy);
}

export function buildMeasureResult(
  a: CtMeasurePoint,
  b: CtMeasurePoint,
  pixelSpacing: [number, number] | null | undefined
): CtMeasureResult {
  return {
    a,
    b,
    distancePx: distancePx(a, b),
    distanceMm: distanceMm(a, b, pixelSpacing)
  };
}

export function resolveCtSuggestion(state: {
  hasFiles: boolean;
  hasError: boolean;
  compressed: boolean;
}): CtSuggestion | null {
  if (state.hasError) {
    return {
      id: 'try-sample',
      title: 'Try the sample chest CT',
      reason: 'Load the embedded 32×32 MONOCHROME2 CT DICOM to verify the viewport.',
      actionLabel: 'Open sample',
      path: '/medical-viewers/ct-scan-viewer'
    };
  }
  if (state.compressed) {
    return {
      id: 'dicom-alt',
      title: 'Try DICOM Viewer',
      reason: 'Compressed transfer syntaxes soft-fail here — metadata-only path may still help.',
      actionLabel: 'DICOM Viewer',
      path: '/medical-viewers/dicom-viewer'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'upload',
      title: 'Open a CT series locally',
      reason: 'Prefer Modality CT. Wheel-scroll slices, measure distance, probe HU — not for diagnosis.',
      actionLabel: 'Upload',
      path: '/medical-viewers/ct-scan-viewer'
    };
  }
  return null;
}
