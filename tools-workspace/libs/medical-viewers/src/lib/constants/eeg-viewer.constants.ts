import type { EegMontagePreset, EegRelatedToolLink } from '../types/eeg-viewer.types';

export const EEG_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.eeg', '.csv', '.json', '.txt'];

export const EEG_ACCEPT_ATTR = '.eeg,.csv,.json,.txt,text/csv,application/json';

export const EEG_FORMATS_LABEL = '.eeg, .csv, .json';

export const EEG_FORMATS_HINT =
  'EEG waveform CSV/JSON with channel columns, or JSON with sampleRateHz and channels. Education/research only — not for diagnosis.';

export const EEG_MAX_FILE_BYTES = 25 * 1024 * 1024;

export const EEG_DEFAULT_SAMPLE_RATE = 256;

export const EEG_DEFAULT_CHANNELS: ReadonlyArray<string> = [
  'Fp1',
  'Fp2',
  'F3',
  'F4',
  'C3',
  'C4',
  'O1',
  'O2'
];

export const EEG_MONTAGE_PRESETS: ReadonlyArray<EegMontagePreset> = [
  { id: 'referential', label: 'Referential', description: 'Raw channel traces' },
  { id: 'bipolar', label: 'Bipolar', description: 'Adjacent channel differences' },
  { id: 'average', label: 'Average ref', description: 'Each channel minus common average' }
];

export const EEG_RELATED_TOOLS: ReadonlyArray<EegRelatedToolLink> = [
  { label: 'ECG Viewer', description: '12-lead ECG with calipers', path: '/medical-viewers/ecg-viewer' },
  { label: 'DICOM Viewer', description: 'Window/level medical imaging', path: '/medical-viewers/dicom-viewer' },
  { label: 'MRI Viewer', description: 'MRI slice navigation', path: '/medical-viewers/mri-viewer' }
];
