import {
  FITS_MAX_FILE_BYTES,
  FITS_SAMPLE_BASE64,
  FITS_SUPPORTED_EXTENSIONS
} from '../constants/fits-viewer.constants';
import type {
  FitsHistogramBar,
  FitsHduPreview,
  FitsLoadedFile,
  FitsMetadataRow,
  FitsParsedFile,
  FitsSuggestion
} from '../types/fits-viewer.types';
import { parseFitsBytes, readFitsHduPreview } from './fits-parse.utils';
import {
  base64ToUint8Array,
  formatScienceFileSize,
  getFileExtension
} from './science-file.utils';
import { computeVolumeHistogram, extractVolumeSlice, maxVolumeSliceIndex } from './volume-slice.utils';

export {
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  formatScienceFileSize as formatFitsFileSize,
  readFileBytes as readFitsFileBytes
} from './science-file.utils';

export { extractVolumeSlice as extractFitsSlice, maxVolumeSliceIndex as maxFitsSliceIndex } from './volume-slice.utils';
export { parseFitsBytes, readFitsHduPreview } from './fits-parse.utils';

export function isSupportedFitsFile(file: File): boolean {
  const ext = getFileExtension(file.name);
  return (FITS_SUPPORTED_EXTENSIONS as readonly string[]).includes(ext);
}

export function validateFitsFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > FITS_MAX_FILE_BYTES) {
    return `File is too large (max ${formatScienceFileSize(FITS_MAX_FILE_BYTES)})`;
  }
  return null;
}

export function filterValidFitsFiles(files: FileList | File[]): {
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
    if (!isSupportedFitsFile(file)) {
      rejected.push({ name: file.name, reason: 'Unsupported format (use .fits)' });
      continue;
    }
    const sizeError = validateFitsFileSize(file);
    if (sizeError) {
      rejected.push({ name: file.name, reason: sizeError });
      continue;
    }
    accepted.push(file);
  }
  return { accepted, rejected };
}

export function createSampleFitsFile(): File {
  const bytes = base64ToUint8Array(FITS_SAMPLE_BASE64);
  return new File([bytes as BlobPart], 'sample-starfield.fits', {
    type: 'application/fits',
    lastModified: 0
  });
}

export function createFitsFileRecord(file: File, bytes: Uint8Array): FitsLoadedFile {
  const extension = getFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const warnings: string[] = [];
  let parsed: FitsParsedFile | null = null;
  let softFail = false;
  try {
    parsed = parseFitsBytes(bytes);
    warnings.push(...parsed.warnings);
    if (!parsed.hdus.length) softFail = true;
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse FITS');
  }
  return { id, name: file.name, size: file.size, extension, bytes, parsed, warnings, softFail };
}

export function canExportFits(file: FitsLoadedFile | null): boolean {
  return !!file?.parsed && !file.softFail;
}

export function defaultWindowForPreview(preview: FitsHduPreview): { center: number; width: number } {
  const { dataMin: min, dataMax: max } = preview;
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) return { center: 0, width: 1 };
  return { center: (min + max) / 2, width: max - min };
}

export function buildFitsMetadataRows(parsed: FitsParsedFile, hduIndex: number): FitsMetadataRow[] {
  const hdu = parsed.hdus.find((h) => h.index === hduIndex) ?? parsed.hdus[0];
  if (!hdu) return [];
  return [
    { key: 'HDU', value: hdu.name },
    { key: 'BITPIX', value: String(hdu.bitpix) },
    { key: 'NAXIS', value: String(hdu.naxis) },
    { key: 'Shape', value: hdu.shape.join(' × ') },
    { key: 'BSCALE', value: String(hdu.bscale) },
    { key: 'BZERO', value: String(hdu.bzero) }
  ];
}

export function buildFitsHistogramBars(preview: FitsHduPreview): FitsHistogramBar[] {
  const hist = computeVolumeHistogram(preview.data, 12);
  const maxCount = Math.max(...hist.counts, 1);
  return hist.counts.map((count, i) => ({
    label: hist.binEdges[i].toFixed(1),
    count,
    heightPct: Math.round((count / maxCount) * 100)
  }));
}

export function exportFitsSummaryJson(file: FitsLoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed FITS data');
  return JSON.stringify(
    {
      file: file.name,
      hdus: parsed.hdus.map((h) => ({
        index: h.index,
        name: h.name,
        bitpix: h.bitpix,
        shape: h.shape,
        wcs: h.wcs
      })),
      defaultHdu: parsed.defaultHduIndex
    },
    null,
    2
  );
}

export function exportFitsHeaderJson(file: FitsLoadedFile, hduIndex: number): string {
  const hdu = file.parsed?.hdus.find((h) => h.index === hduIndex);
  if (!hdu) throw new Error('HDU not found');
  return JSON.stringify(hdu.cards, null, 2);
}

export function exportFitsDataCsv(preview: FitsHduPreview): string {
  const lines = ['index,value'];
  for (let i = 0; i < preview.data.length; i++) lines.push(`${i},${preview.data[i]}`);
  return lines.join('\n');
}

export function resolveFitsSuggestion(opts: { hasFiles: boolean; hasError: boolean }): FitsSuggestion | null {
  if (opts.hasError) {
    return {
      id: 'try-sample',
      title: 'Try the sample star field',
      reason: 'Load the embedded 8×8 float FITS image with WCS keywords to verify stretch and header view.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  if (!opts.hasFiles) {
    return {
      id: 'upload-fits',
      title: 'Upload a FITS image',
      reason: 'FITS files stay in your browser — inspect headers, WCS metadata, and stretched previews.',
      actionLabel: 'Choose file',
      action: 'upload'
    };
  }
  return null;
}

export function getHduPreview(file: FitsLoadedFile, hduIndex: number): FitsHduPreview | null {
  if (!file.parsed) return null;
  if (hduIndex === file.parsed.defaultHduIndex && file.parsed.preview) return file.parsed.preview;
  return readFitsHduPreview(file.bytes, file.parsed, hduIndex);
}

export function filterHeaderCards(cards: Array<{ keyword: string; value: string; comment: string }>, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return cards;
  return cards.filter(
    (c) => c.keyword.toLowerCase().includes(q) || c.value.toLowerCase().includes(q) || c.comment.toLowerCase().includes(q)
  );
}
