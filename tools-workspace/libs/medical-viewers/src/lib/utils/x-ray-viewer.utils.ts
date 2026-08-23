import {
  XRAY_PREFERRED_MODALITIES,
  XRAY_SAMPLE_BASE64
} from '../constants/x-ray-viewer.constants';
import type { XRayLoadedFile, XRaySuggestion } from '../types/x-ray-viewer.types';
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
  canExportDicom as canExportXRay,
  createDicomFileRecord as createXRayFileRecord,
  defaultWindowForParsed as defaultWindowForXRay,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  exportDicomMetadataJson as exportXRayMetadataJson,
  exportDicomSummaryJson as exportXRaySummaryJson,
  filterValidDicomFiles as filterValidXRayFiles,
  formatDicomFileSize as formatXRayFileSize,
  probeDicomPixel as probeXRayPixel,
  readDicomFileBytes as readXRayFileBytes,
  sortDicomSeries
};

export function createSampleXRayFile(): File {
  const bytes = base64ToUint8Array(XRAY_SAMPLE_BASE64);
  return new File([bytes as BlobPart], 'sample-chest-xray.dcm', {
    type: 'application/dicom',
    lastModified: 0
  });
}

/** Soft preference for radiograph modalities — warn but still load others. */
export function modalityPreferenceWarning(modality: string | undefined | null): string | null {
  const mod = (modality || '').trim().toUpperCase();
  if (!mod) {
    return `Modality tag missing — preferred: ${XRAY_PREFERRED_MODALITIES.join('/')}. File still loaded.`;
  }
  if (!(XRAY_PREFERRED_MODALITIES as readonly string[]).includes(mod)) {
    return `Modality is ${mod} (preferred: ${XRAY_PREFERRED_MODALITIES.join('/')}). File still loaded for education/research.`;
  }
  return null;
}

export function enrichXRayFileRecord(file: XRayLoadedFile): XRayLoadedFile {
  const warning = modalityPreferenceWarning(file.parsed?.modality);
  if (!warning) return file;
  if (file.warnings.includes(warning)) return file;
  return {
    ...file,
    warnings: [...file.warnings, warning]
  };
}

export function resolveXRaySuggestion(state: {
  hasFiles: boolean;
  hasError: boolean;
  compressed: boolean;
}): XRaySuggestion | null {
  if (state.hasError) {
    return {
      id: 'try-sample',
      title: 'Try the sample chest X-ray',
      reason: 'Load the embedded 32×32 MONOCHROME2 DX DICOM to verify zoom and window/level.',
      actionLabel: 'Open sample',
      path: '/medical-viewers/x-ray-viewer'
    };
  }
  if (state.compressed) {
    return {
      id: 'dicom-alt',
      title: 'Try generic DICOM viewer',
      reason: 'Compressed DICOM pixels are not decoded here — export metadata or convert to Explicit VR LE.',
      actionLabel: 'DICOM Viewer',
      path: '/medical-viewers/dicom-viewer'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'upload',
      title: 'Open a radiograph locally',
      reason: 'Prefer CR/DX/XR/RF. Files stay in your browser — education/research only, not diagnosis.',
      actionLabel: 'Upload',
      path: '/medical-viewers/x-ray-viewer'
    };
  }
  return null;
}
