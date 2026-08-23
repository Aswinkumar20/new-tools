import {
  DICOM_MAX_FILE_BYTES,
  DICOM_SAMPLE_BASE64,
  DICOM_SUPPORTED_EXTENSIONS
} from '../constants/dicom-viewer.constants';
import type {
  DicomLoadedFile,
  DicomParsedImage,
  DicomSuggestion
} from '../types/dicom-viewer.types';
import {
  base64ToUint8Array,
  formatMedicalFileSize,
  getFileExtension
} from './medical-file.utils';
import { parseDicomBytes, getDicomFramePixels } from './dicom-parse.utils';

export {
  downloadBinaryFile,
  downloadTextFile,
  downloadDataUrl,
  formatMedicalFileSize as formatDicomFileSize,
  readFileBytes as readDicomFileBytes
} from './medical-file.utils';

export { parseDicomBytes, hasDicomMagic, getDicomFramePixels } from './dicom-parse.utils';

export function isSupportedDicomFile(file: File): boolean {
  const ext = getFileExtension(file.name);
  return (DICOM_SUPPORTED_EXTENSIONS as readonly string[]).includes(ext);
}

export function validateDicomFileSize(file: File): string | null {
  if (!file || file.size <= 0) {
    return 'File is empty';
  }
  if (file.size > DICOM_MAX_FILE_BYTES) {
    return `File is too large (max ${formatMedicalFileSize(DICOM_MAX_FILE_BYTES)})`;
  }
  return null;
}

export function filterValidDicomFiles(files: FileList | File[]): {
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

    if (!isSupportedDicomFile(file)) {
      rejected.push({
        name: file.name,
        reason: 'Unsupported format (use .dcm / .dicom / .ima)'
      });
      continue;
    }
    const sizeError = validateDicomFileSize(file);
    if (sizeError) {
      rejected.push({ name: file.name, reason: sizeError });
      continue;
    }
    accepted.push(file);
  }
  return { accepted, rejected };
}

export function createSampleDicomFile(): File {
  const bytes = base64ToUint8Array(DICOM_SAMPLE_BASE64);
  return new File([bytes as BlobPart], 'sample-scout.dcm', {
    type: 'application/dicom',
    lastModified: 0
  });
}

export function createDicomFileRecord(file: File, bytes: Uint8Array): DicomLoadedFile {
  const extension = getFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const warnings: string[] = [];
  let parsed: DicomParsedImage | null = null;
  let softFail = false;

  try {
    parsed = parseDicomBytes(bytes);
    warnings.push(...parsed.warnings);
    if (parsed.compressed) {
      softFail = true;
    }
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse DICOM');
  }

  return {
    id,
    name: file.name,
    size: file.size,
    extension,
    bytes,
    parsed,
    warnings,
    softFail
  };
}

export function sortDicomSeries(files: DicomLoadedFile[]): DicomLoadedFile[] {
  return [...files].sort((a, b) => {
    const ai = a.parsed?.instanceNumber;
    const bi = b.parsed?.instanceNumber;
    if (ai != null && bi != null && ai !== bi) {
      return ai - bi;
    }
    return a.name.localeCompare(b.name);
  });
}

export function defaultWindowForParsed(parsed: DicomParsedImage): {
  center: number;
  width: number;
} {
  if (parsed.windowCenter != null && parsed.windowWidth != null && parsed.windowWidth > 0) {
    return { center: parsed.windowCenter, width: parsed.windowWidth };
  }
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < parsed.pixels.length; i++) {
    const v = parsed.pixels[i] * parsed.rescaleSlope + parsed.rescaleIntercept;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) {
    return { center: 0, width: 1 };
  }
  return { center: (min + max) / 2, width: max - min };
}

export function probeDicomPixel(
  parsed: DicomParsedImage,
  x: number,
  y: number,
  frameIndex = 0
): { raw: number; hu: number; suv: number | null } | null {
  if (x < 0 || y < 0 || x >= parsed.columns || y >= parsed.rows) {
    return null;
  }
  const pixels = getDicomFramePixels(parsed, frameIndex);
  const raw = pixels[y * parsed.columns + x];
  const rescaled = raw * parsed.rescaleSlope + parsed.rescaleIntercept;
  return { raw, hu: rescaled, suv: parsed.modality === 'PT' ? rescaled : null };
}

export function exportDicomMetadataJson(file: DicomLoadedFile): string {
  const rows = file.parsed?.metadataRows ?? [];
  return JSON.stringify(
    {
      name: file.name,
      size: file.size,
      tags: rows
    },
    null,
    2
  );
}

export function exportDicomSummaryJson(file: DicomLoadedFile): string {
  const p = file.parsed;
  return JSON.stringify(
    {
      name: file.name,
      size: file.size,
      modality: p?.modality ?? null,
      patientName: p?.patientName ?? null,
      patientId: p?.patientId ?? null,
      rows: p?.rows ?? null,
      columns: p?.columns ?? null,
      bitsAllocated: p?.bitsAllocated ?? null,
      photometricInterpretation: p?.photometricInterpretation ?? null,
      transferSyntaxUid: p?.transferSyntaxUid ?? null,
      windowCenter: p?.windowCenter ?? null,
      windowWidth: p?.windowWidth ?? null,
      rescaleSlope: p?.rescaleSlope ?? null,
      rescaleIntercept: p?.rescaleIntercept ?? null,
      instanceNumber: p?.instanceNumber ?? null,
      warnings: file.warnings,
      note: 'Local private preview for education/research — not for diagnostic use.'
    },
    null,
    2
  );
}

export function canExportDicom(file: DicomLoadedFile | null): boolean {
  return !!file;
}

export function resolveDicomSuggestion(state: {
  hasFiles: boolean;
  hasError: boolean;
  compressed: boolean;
}): DicomSuggestion | null {
  if (state.hasError) {
    return {
      id: 'try-sample',
      title: 'Try the sample scout',
      reason: 'Load the embedded 32×32 MONOCHROME2 DICOM to verify the viewport.',
      actionLabel: 'Open sample',
      path: '/medical-viewers/dicom-viewer'
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
      title: 'Open a DICOM locally',
      reason: 'Files stay in your browser. Preview is for education/research, not diagnosis.',
      actionLabel: 'Upload',
      path: '/medical-viewers/dicom-viewer'
    };
  }
  return null;
}
