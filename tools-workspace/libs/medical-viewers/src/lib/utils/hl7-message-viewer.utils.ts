import {
  HL7_FORMATS_HINT,
  HL7_MAX_FILE_BYTES,
  HL7_SUPPORTED_EXTENSIONS
} from '../constants/hl7-message-viewer.constants';
import type { Hl7LoadedMessage, Hl7Suggestion } from '../types/hl7-message-viewer.types';
import { formatMedicalFileSize, getFileExtension } from './medical-file.utils';
import { buildSampleHl7Message, formatHl7Message, parseHl7Bytes } from './hl7-parse.utils';
import {
  createClinicalRecordId,
  filterValidClinicalFiles,
  isSupportedClinicalFile
} from './clinical-document.utils';

export {
  downloadBinaryFile,
  downloadTextFile,
  formatMedicalFileSize as formatHl7FileSize,
  readFileBytes as readHl7FileBytes
} from './medical-file.utils';

export { formatHl7Message, filterHl7Segments } from './hl7-parse.utils';

export function isSupportedHl7File(file: File): boolean {
  return isSupportedClinicalFile(file, HL7_SUPPORTED_EXTENSIONS);
}

export function filterValidHl7Files(files: FileList | File[]) {
  return filterValidClinicalFiles(files, HL7_SUPPORTED_EXTENSIONS, HL7_MAX_FILE_BYTES);
}

export function createSampleHl7File(): File {
  const text = buildSampleHl7Message();
  return new File([text], 'sample-oru-r01.hl7', { type: 'text/plain', lastModified: 0 });
}

export function createHl7MessageRecord(file: File, bytes: Uint8Array): Hl7LoadedMessage {
  const extension = getFileExtension(file.name) || '.hl7';
  const text = new TextDecoder('utf-8').decode(bytes);
  const parsed = parseHl7Bytes(bytes);
  const warnings = [...parsed.warnings];

  if (!parsed.messageType) {
    warnings.push('Message type could not be determined from MSH-9.');
  }

  return {
    id: createClinicalRecordId(file),
    name: file.name,
    size: file.size,
    extension,
    bytes,
    text,
    parsed,
    warnings
  };
}

export function exportHl7SummaryJson(record: Hl7LoadedMessage): string {
  const p = record.parsed;
  return JSON.stringify(
    {
      name: record.name,
      messageType: p.messageType,
      triggerEvent: p.triggerEvent,
      version: p.version,
      messageControlId: p.messageControlId,
      sendingApplication: p.sendingApplication,
      sendingFacility: p.sendingFacility,
      segmentCount: p.segments.length,
      segmentTypes: [...new Set(p.segments.map((s) => s.name))],
      warnings: record.warnings,
      note: 'Education/research HL7 preview — not for diagnostic use.'
    },
    null,
    2
  );
}

export function exportHl7SegmentsJson(record: Hl7LoadedMessage): string {
  return JSON.stringify(
    {
      messageControlId: record.parsed.messageControlId,
      segments: record.parsed.segments.map((s) => ({
        name: s.name,
        lineIndex: s.lineIndex,
        fields: s.fields.map((f) => ({
          index: f.index,
          label: f.label,
          value: f.value,
          components: f.components
        })),
        raw: s.raw
      }))
    },
    null,
    2
  );
}

export function canExportHl7(record: Hl7LoadedMessage | null): boolean {
  return !!record && record.parsed.segments.length > 0;
}

export function resolveHl7Suggestion(state: {
  hasMessages: boolean;
  hasError: boolean;
}): Hl7Suggestion | null {
  if (state.hasError) {
    return {
      id: 'try-sample',
      title: 'Try the sample ORU^R01 message',
      reason: 'Load the embedded HL7 lab result message to verify segment decode.',
      actionLabel: 'Open sample',
      path: '/medical-viewers/hl7-message-viewer'
    };
  }
  if (!state.hasMessages) {
    return {
      id: 'upload',
      title: 'Upload an HL7 message',
      reason: HL7_FORMATS_HINT,
      actionLabel: 'Choose file',
      path: '/medical-viewers/hl7-message-viewer'
    };
  }
  return null;
}

export function segmentTypeCounts(record: Hl7LoadedMessage): Array<{ type: string; count: number }> {
  const counts = new Map<string, number>();
  for (const seg of record.parsed.segments) {
    counts.set(seg.name, (counts.get(seg.name) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => a.type.localeCompare(b.type));
}
