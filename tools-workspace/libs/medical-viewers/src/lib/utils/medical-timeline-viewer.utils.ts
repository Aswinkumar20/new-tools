import {
  TIMELINE_FORMATS_HINT,
  TIMELINE_MAX_FILE_BYTES,
  TIMELINE_SUPPORTED_EXTENSIONS
} from '../constants/medical-timeline-viewer.constants';
import type { TimelineLoadedDocument, TimelineSuggestion } from '../types/medical-timeline-viewer.types';
import { getFileExtension } from './medical-file.utils';
import {
  buildSampleTimelineJson,
  categoryCounts,
  exportTimelineEventsCsv,
  filterTimelineEvents,
  groupTimelineEvents,
  parseTimelineBytes
} from './timeline-parse.utils';
import {
  createClinicalRecordId,
  filterValidClinicalFiles,
  isSupportedClinicalFile
} from './clinical-document.utils';

export {
  downloadBinaryFile,
  downloadTextFile,
  formatMedicalFileSize as formatTimelineFileSize,
  readFileBytes as readTimelineFileBytes
} from './medical-file.utils';

export { filterTimelineEvents, groupTimelineEvents, categoryCounts, exportTimelineEventsCsv } from './timeline-parse.utils';

export function isSupportedTimelineFile(file: File): boolean {
  return isSupportedClinicalFile(file, TIMELINE_SUPPORTED_EXTENSIONS);
}

export function filterValidTimelineFiles(files: FileList | File[]) {
  return filterValidClinicalFiles(files, TIMELINE_SUPPORTED_EXTENSIONS, TIMELINE_MAX_FILE_BYTES);
}

export function createSampleTimelineFile(): File {
  return new File([buildSampleTimelineJson()], 'sample-patient-timeline.json', {
    type: 'application/json',
    lastModified: 0
  });
}

export function createTimelineDocumentRecord(file: File, bytes: Uint8Array): TimelineLoadedDocument {
  const extension = getFileExtension(file.name) || '.json';
  const text = new TextDecoder('utf-8').decode(bytes);
  const parsedWithFormat = parseTimelineBytes(bytes, extension);
  const { format, ...parsed } = parsedWithFormat;
  const warnings = [...parsed.warnings];

  return {
    id: createClinicalRecordId(file),
    name: file.name,
    size: file.size,
    extension,
    bytes,
    text,
    format,
    parsed,
    warnings
  };
}

export function exportTimelineSummaryJson(record: TimelineLoadedDocument): string {
  return JSON.stringify(
    {
      name: record.name,
      format: record.format,
      patientLabel: record.parsed.patientLabel,
      eventCount: record.parsed.events.length,
      categories: categoryCounts(record.parsed.events),
      dateRange: dateRangeLabel(record.parsed.events),
      warnings: record.warnings,
      note: 'Education/research timeline preview — not for diagnostic use.'
    },
    null,
    2
  );
}

export function exportTimelineEventsJson(record: TimelineLoadedDocument): string {
  return JSON.stringify(
    {
      patient: record.parsed.patientLabel,
      events: record.parsed.events
    },
    null,
    2
  );
}

export function canExportTimeline(record: TimelineLoadedDocument | null): boolean {
  return !!record && record.parsed.events.length > 0;
}

export function resolveTimelineSuggestion(state: {
  hasDocuments: boolean;
  hasError: boolean;
}): TimelineSuggestion | null {
  if (state.hasError) {
    return {
      id: 'try-sample',
      title: 'Try the sample patient timeline',
      reason: 'Load embedded clinical events to verify filters and grouping.',
      actionLabel: 'Open sample',
      path: '/medical-viewers/medical-timeline-viewer'
    };
  }
  if (!state.hasDocuments) {
    return {
      id: 'upload',
      title: 'Upload a clinical timeline',
      reason: TIMELINE_FORMATS_HINT,
      actionLabel: 'Choose file',
      path: '/medical-viewers/medical-timeline-viewer'
    };
  }
  return null;
}

function dateRangeLabel(events: Array<{ isoDate: string }>): string {
  if (!events.length) return '';
  const sorted = [...events].sort((a, b) => a.isoDate.localeCompare(b.isoDate));
  return `${sorted[0].isoDate} – ${sorted[sorted.length - 1].isoDate}`;
}
