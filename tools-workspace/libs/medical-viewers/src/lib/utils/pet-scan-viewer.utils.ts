import {
  PET_SCAN_FUSE_ANATOMY_MODALITIES,
  PET_SCAN_PREFERRED_MODALITY,
  PET_SCAN_SAMPLE_BASE64
} from '../constants/pet-scan-viewer.constants';
import type {
  PetScanFusionPair,
  PetScanLoadedFile,
  PetScanSeriesGroup,
  PetScanSuggestion
} from '../types/pet-scan-viewer.types';
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
  canExportDicom as canExportPetScan,
  createDicomFileRecord as createPetScanFileRecord,
  defaultWindowForParsed as defaultWindowForPetScan,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  exportDicomMetadataJson as exportPetScanMetadataJson,
  exportDicomSummaryJson as exportPetScanSummaryJson,
  filterValidDicomFiles as filterValidPetScanFiles,
  formatDicomFileSize as formatPetScanFileSize,
  getDicomFramePixels,
  probeDicomPixel as probePetScanPixel,
  readDicomFileBytes as readPetScanFileBytes,
  sortDicomSeries,
  groupBySeries,
  sortSlices
};

export function createSamplePetScanFile(): File {
  const bytes = base64ToUint8Array(PET_SCAN_SAMPLE_BASE64);
  return new File([bytes as BlobPart], 'sample-fdg-pet.dcm', {
    type: 'application/dicom',
    lastModified: 0
  });
}

export function modalityPreferenceWarning(modality: string | undefined | null): string | null {
  const mod = (modality || '').trim().toUpperCase();
  if (!mod) {
    return `Modality tag missing — preferred modality is ${PET_SCAN_PREFERRED_MODALITY}. File still loaded.`;
  }
  if (mod !== PET_SCAN_PREFERRED_MODALITY) {
    return `Modality is ${mod} (preferred: ${PET_SCAN_PREFERRED_MODALITY}). File still loaded for education/research.`;
  }
  return null;
}

export function enrichPetScanFileRecord(file: PetScanLoadedFile): PetScanLoadedFile {
  const warning = modalityPreferenceWarning(file.parsed?.modality);
  if (!warning) return file;
  if (file.warnings.includes(warning)) return file;
  return { ...file, warnings: [...file.warnings, warning] };
}

export function isPetModality(modality: string | undefined | null): boolean {
  return (modality || '').trim().toUpperCase() === PET_SCAN_PREFERRED_MODALITY;
}

export function isAnatomyModality(modality: string | undefined | null): boolean {
  const mod = (modality || '').trim().toUpperCase();
  return mod === 'CT' || mod === 'MR';
}

export function resolvePetFusionPair(seriesGroups: PetScanSeriesGroup[]): PetScanFusionPair | null {
  let ptIndex = -1;
  let anatomyIndex = -1;

  seriesGroups.forEach((group, index) => {
    const mod = group.files[0]?.parsed?.modality;
    if (isPetModality(mod) && ptIndex < 0) {
      ptIndex = index;
    } else if (isAnatomyModality(mod) && anatomyIndex < 0) {
      anatomyIndex = index;
    }
  });

  if (ptIndex < 0 || anatomyIndex < 0 || ptIndex === anatomyIndex) {
    return null;
  }

  return {
    ptSeriesIndex: ptIndex,
    anatomySeriesIndex: anatomyIndex,
    ptLabel: seriesGroups[ptIndex]?.label ?? 'PET',
    anatomyLabel: seriesGroups[anatomyIndex]?.label ?? 'Anatomy'
  };
}

/** Rescaled PET value — SUV-like when rescale tags present (education/research context). */
export function petActivityValue(parsed: DicomParsedImage, raw: number): number {
  return raw * parsed.rescaleSlope + parsed.rescaleIntercept;
}

export function petUnitsLabel(parsed: DicomParsedImage | null): string {
  if (!parsed) return 'SUV-like';
  const units = (parsed.units || '').trim();
  if (units) return units;
  return parsed.modality === 'PT' ? 'SUV-like (rescaled)' : 'Rescaled';
}

export function resolvePetScanSuggestion(state: {
  hasFiles: boolean;
  hasError: boolean;
  compressed: boolean;
  canFuse: boolean;
}): PetScanSuggestion | null {
  if (state.hasError) {
    return {
      id: 'try-sample',
      title: 'Try the sample FDG PET',
      reason: 'Load the embedded 32×32 PT DICOM to verify hot colormap and SUV probe.',
      actionLabel: 'Open sample',
      path: '/medical-viewers/pet-scan-viewer'
    };
  }
  if (state.compressed) {
    return {
      id: 'dicom-alt',
      title: 'Try generic DICOM viewer',
      reason: 'Compressed DICOM pixels are not decoded here.',
      actionLabel: 'DICOM Viewer',
      path: '/medical-viewers/dicom-viewer'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'upload',
      title: 'Open PET DICOM locally',
      reason: 'Load PT series; add CT for fuse overlay. Education/research only — not diagnosis.',
      actionLabel: 'Upload',
      path: '/medical-viewers/pet-scan-viewer'
    };
  }
  if (!state.canFuse && state.hasFiles) {
    return {
      id: 'fuse-hint',
      title: 'Add CT for fuse overlay',
      reason: 'Load a CT series alongside PT to preview a simple hot-colormap overlay (education only).',
      actionLabel: 'Upload CT',
      path: '/medical-viewers/pet-scan-viewer'
    };
  }
  return null;
}
