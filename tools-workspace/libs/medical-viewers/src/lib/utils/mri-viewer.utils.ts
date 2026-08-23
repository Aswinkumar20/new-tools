import {
  MRI_PREFERRED_MODALITY,
  MRI_SAMPLE_BASE64
} from '../constants/mri-viewer.constants';
import type { MriLoadedFile, MriSuggestion } from '../types/mri-viewer.types';
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
  canExportDicom as canExportMri,
  createDicomFileRecord as createMriFileRecord,
  defaultWindowForParsed as defaultWindowForMri,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  exportDicomMetadataJson as exportMriMetadataJson,
  exportDicomSummaryJson as exportMriSummaryJson,
  filterValidDicomFiles as filterValidMriFiles,
  formatDicomFileSize as formatMriFileSize,
  probeDicomPixel as probeMriPixel,
  readDicomFileBytes as readMriFileBytes,
  sortDicomSeries,
  groupBySeries,
  sortSlices
};

export function createSampleMriFile(): File {
  const bytes = base64ToUint8Array(MRI_SAMPLE_BASE64);
  return new File([bytes as BlobPart], 'sample-brain-mr.dcm', {
    type: 'application/dicom',
    lastModified: 0
  });
}

/** Soft preference for Modality MR — warn but still load other modalities. */
export function modalityPreferenceWarning(modality: string | undefined | null): string | null {
  const mod = (modality || '').trim().toUpperCase();
  if (!mod) {
    return `Modality tag missing — preferred modality is ${MRI_PREFERRED_MODALITY}. File still loaded.`;
  }
  if (mod !== MRI_PREFERRED_MODALITY) {
    return `Modality is ${mod} (preferred: ${MRI_PREFERRED_MODALITY}). File still loaded for education/research.`;
  }
  return null;
}

export function enrichMriFileRecord(file: MriLoadedFile): MriLoadedFile {
  const warning = modalityPreferenceWarning(file.parsed?.modality);
  if (!warning) return file;
  if (file.warnings.includes(warning)) return file;
  return {
    ...file,
    warnings: [...file.warnings, warning]
  };
}

export function resolveMriSuggestion(state: {
  hasFiles: boolean;
  hasError: boolean;
  compressed: boolean;
}): MriSuggestion | null {
  if (state.hasError) {
    return {
      id: 'try-sample',
      title: 'Try the sample brain MR',
      reason: 'Load the embedded 32×32 MONOCHROME2 MR DICOM to verify the viewport.',
      actionLabel: 'Open sample',
      path: '/medical-viewers/mri-viewer'
    };
  }
  if (state.compressed) {
    return {
      id: 'nifti-alt',
      title: 'Try NIfTI volumes',
      reason: 'Compressed DICOM pixels are not decoded here — NIfTI may fit neuroimaging workflows.',
      actionLabel: 'NIfTI Viewer',
      path: '/medical-viewers/nifti-viewer'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'upload',
      title: 'Open an MRI series locally',
      reason: 'Prefer Modality MR. Files stay in your browser — education/research only, not diagnosis.',
      actionLabel: 'Upload',
      path: '/medical-viewers/mri-viewer'
    };
  }
  return null;
}
