import type { Hl7RelatedToolLink } from '../types/hl7-message-viewer.types';

export const HL7_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.hl7', '.txt'];

export const HL7_ACCEPT_ATTR = '.hl7,.txt,text/plain';

export const HL7_FORMATS_LABEL = '.hl7, .txt';

export const HL7_FORMATS_HINT =
  'HL7 v2 pipe-delimited messages (MSH, PID, OBR, OBX segments). Education/research only — not for diagnosis.';

export const HL7_MAX_FILE_BYTES = 10 * 1024 * 1024;

export const HL7_COMMON_SEGMENTS: ReadonlyArray<string> = [
  'MSH',
  'EVN',
  'PID',
  'PV1',
  'OBR',
  'OBX',
  'NK1',
  'AL1',
  'DG1'
];

export const HL7_RELATED_TOOLS: ReadonlyArray<Hl7RelatedToolLink> = [
  { label: 'FHIR Resource Viewer', description: 'FHIR JSON/XML tree and refs', path: '/medical-viewers/fhir-resource-viewer' },
  { label: 'ECG Viewer', description: '12-lead ECG waveforms', path: '/medical-viewers/ecg-viewer' },
  { label: 'DICOM Viewer', description: 'Window/level medical imaging', path: '/medical-viewers/dicom-viewer' }
];
