import { formatMedicalFileSize, getFileExtension } from './medical-file.utils';

export function createClinicalRecordId(file: File): string {
  return `${file.name}|${file.size}|${file.lastModified}`;
}

export function isSupportedClinicalFile(file: File, supportedExtensions: readonly string[]): boolean {
  const ext = getFileExtension(file.name);
  if (supportedExtensions.includes(ext)) return true;
  if (supportedExtensions.includes('.txt') && !ext) return true;
  return false;
}

export function filterValidClinicalFiles(
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

    if (!isSupportedClinicalFile(file, supportedExtensions)) {
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

export function fileFromPastedText(text: string, filename: string, mimeType: string): File | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  return new File([trimmed], filename, { type: mimeType, lastModified: Date.now() });
}

export function clipboardFiles(event: ClipboardEvent): File[] {
  const list = event.clipboardData?.files;
  return list?.length ? Array.from(list) : [];
}

export function clipboardText(event: ClipboardEvent): string {
  return event.clipboardData?.getData('text/plain')?.trim() ?? '';
}

export function looksLikeJsonOrXml(text: string): boolean {
  const trimmed = text.trim();
  return trimmed.startsWith('{') || trimmed.startsWith('[') || trimmed.startsWith('<');
}

export function looksLikeFhirText(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return /"resourceType"\s*:/.test(trimmed) || /"entry"\s*:/.test(trimmed);
  }
  if (trimmed.startsWith('<')) {
    return /<(Bundle|Patient|Observation|Composition|MedicationRequest|DiagnosticReport)\b/i.test(trimmed);
  }
  return false;
}

export function looksLikeHl7Text(text: string): boolean {
  return /^(MSH|FHS|BHS)\|/m.test(text.trim());
}

export function looksLikeCdaText(text: string): boolean {
  const trimmed = text.trim();
  return trimmed.startsWith('<') && /ClinicalDocument/i.test(trimmed);
}

export function looksLikeTimelineText(text: string): boolean {
  const trimmed = text.trim();
  if (looksLikeHl7Text(trimmed) || looksLikeCdaText(trimmed) || looksLikeFhirText(trimmed)) return true;
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return /"events"\s*:/.test(trimmed) || /"date"\s*:/.test(trimmed);
  }
  const header = trimmed.split(/\r?\n/, 1)[0] ?? '';
  return /date/i.test(header) && /title|event|name/i.test(header);
}

export function looksLikeWaveformText(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.startsWith('{')) {
    return /sampleRateHz|leads|channels/i.test(trimmed);
  }
  const header = trimmed.split(/\r?\n/, 1)[0] ?? '';
  return header.includes(',') && /(time|lead|ch|fp|cz|\bI\b|\bII\b)/i.test(header);
}
