import type { EcgRelatedToolLink } from '../types/ecg-viewer.types';

export const ECG_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.ecg', '.csv', '.json', '.txt'];

export const ECG_ACCEPT_ATTR = '.ecg,.csv,.json,.txt,text/csv,application/json';

export const ECG_FORMATS_LABEL = '.ecg, .csv, .json';

export const ECG_FORMATS_HINT =
  'ECG waveform CSV/JSON with time + lead columns, or JSON with sampleRateHz and leads/channels. Education/research only — not for diagnosis.';

export const ECG_MAX_FILE_BYTES = 25 * 1024 * 1024;

export const ECG_STANDARD_LEADS: ReadonlyArray<string> = [
  'I',
  'II',
  'III',
  'aVR',
  'aVL',
  'aVF',
  'V1',
  'V2',
  'V3',
  'V4',
  'V5',
  'V6'
];

export const ECG_DEFAULT_SAMPLE_RATE = 500;

/** Display px/s ≈ mm/s × 4 (96 DPI). Standard paper speeds: 25 and 50 mm/s. */
export const ECG_PAPER_SPEED_PRESETS: ReadonlyArray<{ id: string; label: string; pixelsPerSecond: number }> = [
  { id: '25', label: '25 mm/s', pixelsPerSecond: 100 },
  { id: '50', label: '50 mm/s', pixelsPerSecond: 200 }
];

export const ECG_RELATED_TOOLS: ReadonlyArray<EcgRelatedToolLink> = [
  { label: 'EEG Viewer', description: 'Multi-channel EEG montage', path: '/medical-viewers/eeg-viewer' },
  { label: 'HL7 Message Viewer', description: 'HL7 v2 segment decode', path: '/medical-viewers/hl7-message-viewer' },
  { label: 'FHIR Resource Viewer', description: 'FHIR JSON/XML tree and refs', path: '/medical-viewers/fhir-resource-viewer' }
];
