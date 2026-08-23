import { formatMedicalFileSize, getFileExtension, readFileBytes } from './medical-file.utils';

export {
  downloadBinaryFile,
  downloadTextFile,
  downloadDataUrl,
  formatMedicalFileSize as formatWaveformFileSize,
  readFileBytes as readWaveformFileBytes
} from './medical-file.utils';

export function isSupportedWaveformFile(
  file: File,
  supportedExtensions: readonly string[]
): boolean {
  return supportedExtensions.includes(getFileExtension(file.name));
}

export function filterValidWaveformFiles(
  files: FileList | File[],
  supportedExtensions: readonly string[],
  maxBytes: number
): { accepted: File[]; rejected: Array<{ name: string; reason: string }> } {
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

    if (!isSupportedWaveformFile(file, supportedExtensions)) {
      rejected.push({ name: file.name, reason: 'Unsupported format' });
      continue;
    }
    if (file.size <= 0) {
      rejected.push({ name: file.name, reason: 'File is empty' });
      continue;
    }
    if (file.size > maxBytes) {
      rejected.push({
        name: file.name,
        reason: `File too large (max ${formatMedicalFileSize(maxBytes)})`
      });
      continue;
    }
    accepted.push(file);
  }

  return { accepted, rejected };
}

export function createWaveformRecordId(file: File): string {
  return `${file.name}|${file.size}|${file.lastModified}`;
}

export async function readWaveformUpload(file: File): Promise<{ bytes: Uint8Array; extension: string }> {
  const bytes = await readFileBytes(file);
  return { bytes, extension: getFileExtension(file.name) };
}

export function createCaliperId(): string {
  return `cal-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}
