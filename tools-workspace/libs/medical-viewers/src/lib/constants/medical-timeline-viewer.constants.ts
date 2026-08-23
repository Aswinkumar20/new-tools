import type { TimelineRelatedToolLink } from '../types/medical-timeline-viewer.types';

export const TIMELINE_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = [
  '.json',
  '.csv',
  '.hl7',
  '.fhir',
  '.txt'
];

export const TIMELINE_ACCEPT_ATTR = '.json,.csv,.hl7,.fhir,.txt,text/csv,application/json';

export const TIMELINE_FORMATS_LABEL = '.json, .csv, .hl7, FHIR JSON';

export const TIMELINE_FORMATS_HINT =
  'Clinical event timelines as JSON/CSV, or auto-extract events from FHIR JSON and HL7 messages. Education/research only — not for diagnosis.';

export const TIMELINE_MAX_FILE_BYTES = 15 * 1024 * 1024;

export const TIMELINE_EVENT_CATEGORIES: ReadonlyArray<string> = [
  'encounter',
  'lab',
  'imaging',
  'medication',
  'procedure',
  'diagnosis',
  'message',
  'other'
];

export const TIMELINE_RELATED_TOOLS: ReadonlyArray<TimelineRelatedToolLink> = [
  { label: 'FHIR Resource Viewer', description: 'FHIR tree, refs, dates', path: '/medical-viewers/fhir-resource-viewer' },
  { label: 'HL7 Message Viewer', description: 'HL7 v2 segment decode', path: '/medical-viewers/hl7-message-viewer' },
  { label: 'CDA Viewer', description: 'CDA sections and narrative', path: '/medical-viewers/cda-viewer' }
];
