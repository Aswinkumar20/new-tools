import {
  ULTRASOUND_PREFERRED_MODALITY,
  ULTRASOUND_SAMPLE_BASE64
} from '../constants/ultrasound-viewer.constants';
import type {
  UltrasoundCineMode,
  UltrasoundLoadedFile,
  UltrasoundSuggestion
} from '../types/ultrasound-viewer.types';
import type { DicomParsedImage } from '../types/dicom-viewer.types';
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
  getDicomFramePixels,
  probeDicomPixel,
  readDicomFileBytes,
  sortDicomSeries
} from './dicom-viewer.utils';
import { groupBySeries, sortSlices } from './dicom-series.utils';

export {
  canExportDicom as canExportUltrasound,
  createDicomFileRecord as createUltrasoundFileRecord,
  defaultWindowForParsed as defaultWindowForUltrasound,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  exportDicomMetadataJson as exportUltrasoundMetadataJson,
  exportDicomSummaryJson as exportUltrasoundSummaryJson,
  filterValidDicomFiles as filterValidUltrasoundFiles,
  formatDicomFileSize as formatUltrasoundFileSize,
  getDicomFramePixels,
  probeDicomPixel as probeUltrasoundPixel,
  readDicomFileBytes as readUltrasoundFileBytes,
  sortDicomSeries,
  groupBySeries,
  sortSlices
};

export function createSampleUltrasoundFile(): File {
  const bytes = base64ToUint8Array(ULTRASOUND_SAMPLE_BASE64);
  return new File([bytes as BlobPart], 'sample-abdominal-us.dcm', {
    type: 'application/dicom',
    lastModified: 0
  });
}

export function modalityPreferenceWarning(modality: string | undefined | null): string | null {
  const mod = (modality || '').trim().toUpperCase();
  if (!mod) {
    return `Modality tag missing — preferred modality is ${ULTRASOUND_PREFERRED_MODALITY}. File still loaded.`;
  }
  if (mod !== ULTRASOUND_PREFERRED_MODALITY) {
    return `Modality is ${mod} (preferred: ${ULTRASOUND_PREFERRED_MODALITY}). File still loaded for education/research.`;
  }
  return null;
}

export function enrichUltrasoundFileRecord(file: UltrasoundLoadedFile): UltrasoundLoadedFile {
  const warning = modalityPreferenceWarning(file.parsed?.modality);
  if (!warning) return file;
  if (file.warnings.includes(warning)) return file;
  return {
    ...file,
    warnings: [...file.warnings, warning]
  };
}

export function resolveUltrasoundCineMode(
  parsed: DicomParsedImage | null,
  seriesFileCount: number
): UltrasoundCineMode {
  if (!parsed) {
    return seriesFileCount > 1 ? 'multi-file' : 'single';
  }
  if (parsed.numberOfFrames > 1) {
    return 'multi-frame';
  }
  if (seriesFileCount > 1) {
    return 'multi-file';
  }
  return 'single';
}

export function resolveCineFrameCount(
  mode: UltrasoundCineMode,
  parsed: DicomParsedImage | null,
  seriesFileCount: number
): number {
  if (mode === 'multi-frame') {
    return Math.max(1, parsed?.numberOfFrames ?? 1);
  }
  if (mode === 'multi-file') {
    return Math.max(1, seriesFileCount);
  }
  return 1;
}

export function getCineDisplayPixels(
  mode: UltrasoundCineMode,
  frameIndex: number,
  parsed: DicomParsedImage | null,
  seriesFiles: UltrasoundLoadedFile[]
): Float32Array {
  if (!parsed) {
    return new Float32Array(0);
  }
  if (mode === 'multi-frame') {
    return getDicomFramePixels(parsed, frameIndex);
  }
  if (mode === 'multi-file') {
    const file = seriesFiles[frameIndex];
    const p = file?.parsed;
    return p ? getDicomFramePixels(p, 0) : new Float32Array(0);
  }
  return getDicomFramePixels(parsed, 0);
}

export function resolveUltrasoundSuggestion(state: {
  hasFiles: boolean;
  hasError: boolean;
  compressed: boolean;
}): UltrasoundSuggestion | null {
  if (state.hasError) {
    return {
      id: 'try-sample',
      title: 'Try the sample abdominal US',
      reason: 'Load the embedded 32×32 MONOCHROME2 US DICOM to verify cine controls and metadata.',
      actionLabel: 'Open sample',
      path: '/medical-viewers/ultrasound-viewer'
    };
  }
  if (state.compressed) {
    return {
      id: 'dicom-alt',
      title: 'Try generic DICOM viewer',
      reason: 'Compressed DICOM pixels are not decoded here — metadata export still works.',
      actionLabel: 'DICOM Viewer',
      path: '/medical-viewers/dicom-viewer'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'upload',
      title: 'Open ultrasound DICOM locally',
      reason: 'Prefer Modality US with single or multi-frame cine. Education/research only — not diagnosis.',
      actionLabel: 'Upload',
      path: '/medical-viewers/ultrasound-viewer'
    };
  }
  return null;
}
