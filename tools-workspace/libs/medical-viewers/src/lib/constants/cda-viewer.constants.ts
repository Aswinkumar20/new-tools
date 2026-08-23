import type { CdaRelatedToolLink } from '../types/cda-viewer.types';

export const CDA_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.xml', '.cda', '.txt'];

export const CDA_ACCEPT_ATTR = '.xml,.cda,.txt,application/xml,text/xml';

export const CDA_FORMATS_LABEL = '.xml, .cda';

export const CDA_FORMATS_HINT =
  'HL7 Clinical Document Architecture (CDA) XML with structured sections and narrative text. Education/research only — not for diagnosis.';

export const CDA_MAX_FILE_BYTES = 15 * 1024 * 1024;

export const CDA_RELATED_TOOLS: ReadonlyArray<CdaRelatedToolLink> = [
  { label: 'Medical Timeline Viewer', description: 'Patient event timelines', path: '/medical-viewers/medical-timeline-viewer' },
  { label: 'FHIR Resource Viewer', description: 'FHIR JSON/XML resources', path: '/medical-viewers/fhir-resource-viewer' },
  { label: 'HL7 Message Viewer', description: 'HL7 v2 messages', path: '/medical-viewers/hl7-message-viewer' }
];
