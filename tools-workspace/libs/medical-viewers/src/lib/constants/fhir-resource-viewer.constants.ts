import type { FhirRelatedToolLink } from '../types/fhir-resource-viewer.types';

export const FHIR_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.json', '.xml', '.fhir', '.txt'];

export const FHIR_ACCEPT_ATTR = '.json,.xml,.fhir,.txt,application/json,application/xml,text/xml';

export const FHIR_FORMATS_LABEL = '.json, .xml, .fhir';

export const FHIR_FORMATS_HINT =
  'FHIR R4 JSON or XML resources and Bundles. Education/research only — not for diagnosis.';

export const FHIR_MAX_FILE_BYTES = 15 * 1024 * 1024;

export const FHIR_RELATED_TOOLS: ReadonlyArray<FhirRelatedToolLink> = [
  { label: 'Medical Timeline Viewer', description: 'Patient event timelines', path: '/medical-viewers/medical-timeline-viewer' },
  { label: 'HL7 Message Viewer', description: 'HL7 v2 segment decode', path: '/medical-viewers/hl7-message-viewer' },
  { label: 'CDA Viewer', description: 'CDA sections and narrative', path: '/medical-viewers/cda-viewer' }
];
