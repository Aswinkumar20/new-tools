import {
  EEG_DEFAULT_CHANNELS,
  EEG_DEFAULT_SAMPLE_RATE,
  EEG_FORMATS_HINT,
  EEG_MAX_FILE_BYTES,
  EEG_SUPPORTED_EXTENSIONS
} from '../constants/eeg-viewer.constants';
import type { EegCaliperMark, EegLoadedRecording, EegSuggestion } from '../types/eeg-viewer.types';
import { parseWaveformBytes } from './waveform-parse.utils';
import {
  createWaveformRecordId,
  filterValidWaveformFiles,
  isSupportedWaveformFile
} from './waveform-viewer.utils';

export {
  downloadBinaryFile,
  downloadTextFile,
  downloadDataUrl,
  formatWaveformFileSize,
  readWaveformFileBytes,
  createCaliperId
} from './waveform-viewer.utils';

export function buildSampleEegPayload(): {
  sampleRateHz: number;
  channels: Array<{ id: string; label: string; samples: number[] }>;
} {
  const sr = EEG_DEFAULT_SAMPLE_RATE;
  const durationSec = 3;
  const n = sr * durationSec;
  const channels: Array<{ id: string; label: string; samples: number[] }> = [];

  for (let ci = 0; ci < EEG_DEFAULT_CHANNELS.length; ci++) {
    const id = EEG_DEFAULT_CHANNELS[ci];
    const samples = new Array<number>(n);
    const alphaHz = 10;
    const thetaHz = 5;
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      const alpha = 0.35 * Math.sin(2 * Math.PI * alphaHz * t + ci * 0.4);
      const theta = 0.12 * Math.sin(2 * Math.PI * thetaHz * t);
      const noise = (Math.sin(i * 0.17 + ci) + Math.cos(i * 0.23)) * 0.04;
      samples[i] = Number((alpha + theta + noise).toFixed(4));
    }
    channels.push({ id, label: id, samples });
  }

  return { sampleRateHz: sr, channels };
}

export function createSampleEegFile(): File {
  const json = JSON.stringify(buildSampleEegPayload(), null, 0);
  return new File([json], 'sample-8ch-eeg.json', { type: 'application/json', lastModified: 0 });
}

export function isSupportedEegFile(file: File): boolean {
  return isSupportedWaveformFile(file, EEG_SUPPORTED_EXTENSIONS);
}

export function filterValidEegFiles(files: FileList | File[]) {
  return filterValidWaveformFiles(files, EEG_SUPPORTED_EXTENSIONS, EEG_MAX_FILE_BYTES);
}

export function createEegRecording(file: File, bytes: Uint8Array): EegLoadedRecording {
  const extension = file.name.toLowerCase().endsWith('.json')
    ? '.json'
    : file.name.toLowerCase().endsWith('.csv')
      ? '.csv'
      : file.name.toLowerCase().endsWith('.eeg')
        ? '.eeg'
        : '.txt';

  const waveform = parseWaveformBytes(bytes, extension, EEG_DEFAULT_SAMPLE_RATE);
  const warnings = [...waveform.warnings];

  if (waveform.channels.length < 2) {
    warnings.push('Fewer than 2 channels — montage options may be limited.');
  }
  if (waveform.sampleRateHz < 128) {
    warnings.push(`Low sample rate (${waveform.sampleRateHz} Hz) — high-frequency detail may be lost.`);
  }

  return {
    id: createWaveformRecordId(file),
    name: file.name,
    size: file.size,
    extension,
    bytes,
    waveform,
    warnings
  };
}

export function sortEegChannelIds(channelIds: string[]): string[] {
  const order = new Map(EEG_DEFAULT_CHANNELS.map((id, index) => [id, index]));
  return [...channelIds].sort((a, b) => {
    const ai = order.get(a) ?? 999;
    const bi = order.get(b) ?? 999;
    if (ai !== bi) return ai - bi;
    return a.localeCompare(b);
  });
}

export function exportEegSummaryJson(
  record: EegLoadedRecording,
  visibleChannelIds: string[],
  montageMode: string
): string {
  return JSON.stringify(
    {
      name: record.name,
      size: record.size,
      sampleRateHz: record.waveform.sampleRateHz,
      durationSec: record.waveform.durationSec,
      channelCount: record.waveform.channels.length,
      visibleChannels: visibleChannelIds,
      montageMode,
      warnings: record.warnings,
      note: 'Education/research EEG preview — not for diagnostic use.'
    },
    null,
    2
  );
}

export function exportEegVisibleChannelsJson(
  record: EegLoadedRecording,
  visibleChannelIds: string[],
  montageMode: string,
  startSample: number,
  windowSamples: number
): string {
  const channels = record.waveform.channels.filter((c) => visibleChannelIds.includes(c.id));
  const end = Math.min(startSample + windowSamples, channels[0]?.samples.length ?? 0);
  return JSON.stringify(
    {
      recording: record.name,
      sampleRateHz: record.waveform.sampleRateHz,
      montageMode,
      startSample,
      windowSamples: end - startSample,
      channels: channels.map((c) => ({
        id: c.id,
        label: c.label,
        samples: Array.from(c.samples.subarray(startSample, end))
      })),
      note: 'Visible window export — not for clinical interpretation.'
    },
    null,
    2
  );
}

export function exportEegCalipersJson(
  record: EegLoadedRecording,
  calipers: EegCaliperMark[]
): string {
  return JSON.stringify(
    {
      recording: record.name,
      sampleRateHz: record.waveform.sampleRateHz,
      calipers: calipers.map((c) => ({
        id: c.id,
        label: c.label,
        deltaTimeMs: c.deltaTimeMs,
        deltaAmplitude: c.deltaAmplitude,
        points: { x1: c.x1, y1: c.y1, x2: c.x2, y2: c.y2 }
      })),
      note: 'Caliper measurements are approximate — not for clinical interpretation.'
    },
    null,
    2
  );
}

export function canExportEeg(record: EegLoadedRecording | null): boolean {
  return !!record && record.waveform.channels.length > 0;
}

export function resolveEegSuggestion(state: {
  hasRecordings: boolean;
  hasError: boolean;
}): EegSuggestion | null {
  if (state.hasError) {
    return {
      id: 'try-sample',
      title: 'Try the sample 8-channel EEG',
      reason: 'Load the embedded recording to verify channels, montage, and scrolling.',
      actionLabel: 'Open sample',
      path: '/medical-viewers/eeg-viewer'
    };
  }
  if (!state.hasRecordings) {
    return {
      id: 'upload',
      title: 'Upload an EEG recording',
      reason: EEG_FORMATS_HINT,
      actionLabel: 'Choose file',
      path: '/medical-viewers/eeg-viewer'
    };
  }
  return null;
}
