import {
  NIFTI_MAX_FILE_BYTES,
  NIFTI_SAMPLE_BASE64,
  NIFTI_SUPPORTED_EXTENSIONS
} from '../constants/nifti-viewer.constants';
import type {
  NiftiLoadedFile,
  NiftiParsedVolume,
  NiftiSuggestion
} from '../types/nifti-viewer.types';
import {
  base64ToUint8Array,
  formatMedicalFileSize,
  getFileExtension
} from './medical-file.utils';
import { parseNiftiBytes } from './nifti-parse.utils';

export {
  downloadBinaryFile,
  downloadTextFile,
  downloadDataUrl,
  formatMedicalFileSize as formatNiftiFileSize,
  readFileBytes as readNiftiFileBytes
} from './medical-file.utils';

export {
  parseNiftiBytes,
  extractNiftiSlice,
  maxSliceIndex,
  inflateNiftiBytes
} from './nifti-parse.utils';

export function isSupportedNiftiFile(file: File): boolean {
  const ext = getFileExtension(file.name);
  return (NIFTI_SUPPORTED_EXTENSIONS as readonly string[]).includes(ext);
}

export function validateNiftiFileSize(file: File): string | null {
  if (!file || file.size <= 0) {
    return 'File is empty';
  }
  if (file.size > NIFTI_MAX_FILE_BYTES) {
    return `File is too large (max ${formatMedicalFileSize(NIFTI_MAX_FILE_BYTES)})`;
  }
  return null;
}

export function filterValidNiftiFiles(files: FileList | File[]): {
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

    if (!isSupportedNiftiFile(file)) {
      rejected.push({
        name: file.name,
        reason: 'Unsupported format (use .nii or .nii.gz)'
      });
      continue;
    }
    const sizeError = validateNiftiFileSize(file);
    if (sizeError) {
      rejected.push({ name: file.name, reason: sizeError });
      continue;
    }
    accepted.push(file);
  }
  return { accepted, rejected };
}

export function createSampleNiftiFile(): File {
  const bytes = base64ToUint8Array(NIFTI_SAMPLE_BASE64);
  return new File([bytes as BlobPart], 'sample-brain.nii', {
    type: 'application/octet-stream',
    lastModified: 0
  });
}

export function createNiftiFileRecord(file: File, bytes: Uint8Array): NiftiLoadedFile {
  const extension = getFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const warnings: string[] = [];
  let parsed: NiftiParsedVolume | null = null;
  let softFail = false;

  try {
    parsed = parseNiftiBytes(bytes);
    warnings.push(...parsed.warnings);
    if (!parsed.data.length) {
      softFail = true;
    }
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse NIfTI');
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

export function defaultWindowForVolume(parsed: NiftiParsedVolume): {
  center: number;
  width: number;
} {
  const min = parsed.dataMin;
  const max = parsed.dataMax;
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) {
    return { center: 0, width: 1 };
  }
  return { center: (min + max) / 2, width: max - min };
}

export function exportNiftiHeaderJson(file: NiftiLoadedFile): string {
  return JSON.stringify(
    {
      name: file.name,
      size: file.size,
      header: file.parsed?.header ?? null
    },
    null,
    2
  );
}

export function exportNiftiSummaryJson(file: NiftiLoadedFile): string {
  const p = file.parsed;
  return JSON.stringify(
    {
      name: file.name,
      size: file.size,
      dims: p?.dims ?? null,
      voxelSize: p?.voxelSize ?? null,
      datatype: p?.header.datatypeLabel ?? null,
      dataMin: p?.dataMin ?? null,
      dataMax: p?.dataMax ?? null,
      compressedSource: p?.compressedSource ?? false,
      affineNotes: p?.header.affineNotes ?? [],
      warnings: file.warnings,
      note: 'Local private preview for education/research — not for diagnostic use.'
    },
    null,
    2
  );
}

export function canExportNifti(file: NiftiLoadedFile | null): boolean {
  return !!file;
}

export function resolveNiftiSuggestion(state: {
  hasFiles: boolean;
  hasError: boolean;
}): NiftiSuggestion | null {
  if (state.hasError) {
    return {
      id: 'try-sample',
      title: 'Try the sample brain volume',
      reason: 'Load the embedded 16×16×8 float32 NIfTI to verify ortho slices.',
      actionLabel: 'Open sample',
      path: '/medical-viewers/nifti-viewer'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'upload',
      title: 'Open a NIfTI locally',
      reason: 'Volumes stay in your browser. Preview is for education/research, not diagnosis.',
      actionLabel: 'Upload',
      path: '/medical-viewers/nifti-viewer'
    };
  }
  return null;
}
