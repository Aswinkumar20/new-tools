import {
  MAMMOGRAPHY_PREFERRED_MODALITY,
  MAMMOGRAPHY_SAMPLE_BASE64
} from '../constants/mammography-viewer.constants';
import type { MammographyLoadedFile, MammographySuggestion } from '../types/mammography-viewer.types';
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

export {
  canExportDicom as canExportMammography,
  createDicomFileRecord as createMammographyFileRecord,
  defaultWindowForParsed as defaultWindowForMammography,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  exportDicomMetadataJson as exportMammographyMetadataJson,
  exportDicomSummaryJson as exportMammographySummaryJson,
  filterValidDicomFiles as filterValidMammographyFiles,
  formatDicomFileSize as formatMammographyFileSize,
  probeDicomPixel as probeMammographyPixel,
  readDicomFileBytes as readMammographyFileBytes,
  sortDicomSeries
};

export { buildMammographyHanging, inferMammographySlot, hangingAssignedCount } from './mammography-hanging.utils';

export function createSampleMammographyFile(): File {
  const bytes = base64ToUint8Array(MAMMOGRAPHY_SAMPLE_BASE64);
  return new File([bytes as BlobPart], 'sample-mg-screening.dcm', {
    type: 'application/dicom',
    lastModified: 0
  });
}

export function modalityPreferenceWarning(modality: string | undefined | null): string | null {
  const mod = (modality || '').trim().toUpperCase();
  if (!mod) {
    return `Modality tag missing — preferred modality is ${MAMMOGRAPHY_PREFERRED_MODALITY}. File still loaded.`;
  }
  if (mod !== MAMMOGRAPHY_PREFERRED_MODALITY) {
    return `Modality is ${mod} (preferred: ${MAMMOGRAPHY_PREFERRED_MODALITY}). File still loaded for education/research.`;
  }
  return null;
}

export function enrichMammographyFileRecord(file: MammographyLoadedFile): MammographyLoadedFile {
  const warning = modalityPreferenceWarning(file.parsed?.modality);
  if (!warning) return file;
  if (file.warnings.includes(warning)) return file;
  return { ...file, warnings: [...file.warnings, warning] };
}

export function resolveMammographySuggestion(state: {
  hasFiles: boolean;
  hasError: boolean;
  compressed: boolean;
}): MammographySuggestion | null {
  if (state.hasError) {
    return {
      id: 'try-sample',
      title: 'Try the sample mammography',
      reason: 'Load the embedded 32×32 MONOCHROME2 MG DICOM to verify hanging layout and zoom.',
      actionLabel: 'Open sample',
      path: '/medical-viewers/mammography-viewer'
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
      title: 'Open mammography DICOM locally',
      reason: 'Load CC/MLO views for hanging layout. Education/research only — not diagnosis.',
      actionLabel: 'Upload',
      path: '/medical-viewers/mammography-viewer'
    };
  }
  return null;
}
