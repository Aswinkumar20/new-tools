import {
  ECG_DEFAULT_SAMPLE_RATE,
  ECG_FORMATS_HINT,
  ECG_MAX_FILE_BYTES,
  ECG_STANDARD_LEADS,
  ECG_SUPPORTED_EXTENSIONS
} from '../constants/ecg-viewer.constants';
import type { EcgCaliperMark, EcgLoadedRecording, EcgSuggestion } from '../types/ecg-viewer.types';
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

export function buildSampleEcgPayload(): { sampleRateHz: number; leads: Record<string, number[]> } {
  const sr = ECG_DEFAULT_SAMPLE_RATE;
  const durationSec = 4;
  const n = sr * durationSec;
  const beatPeriod = Math.floor(sr * 0.82);
  const leads: Record<string, number[]> = {};

  for (let li = 0; li < ECG_STANDARD_LEADS.length; li++) {
    const name = ECG_STANDARD_LEADS[li];
    const amp = 0.75 + (li % 4) * 0.12;
    const arr = new Array<number>(n);
    for (let i = 0; i < n; i++) {
      const phase = i % beatPeriod;
      let v = 0.04 * Math.sin((2 * Math.PI * i) / (sr * 0.35));
      if (phase < 18) {
        v += amp * 0.12 * Math.sin((phase / 18) * Math.PI);
      } else if (phase >= 38 && phase < 52) {
        v += amp * (phase < 45 ? 1.15 : 1.15 - (phase - 45) * 0.12);
      } else if (phase >= 68 && phase < 105) {
        v += amp * 0.22 * Math.sin(((phase - 68) / 37) * Math.PI);
      }
      arr[i] = Number(v.toFixed(4));
    }
    leads[name] = arr;
  }

  return { sampleRateHz: sr, leads };
}

export function createSampleEcgFile(): File {
  const json = JSON.stringify(buildSampleEcgPayload(), null, 0);
  return new File([json], 'sample-12lead-ecg.json', { type: 'application/json', lastModified: 0 });
}

export function isSupportedEcgFile(file: File): boolean {
  return isSupportedWaveformFile(file, ECG_SUPPORTED_EXTENSIONS);
}

export function filterValidEcgFiles(files: FileList | File[]) {
  return filterValidWaveformFiles(files, ECG_SUPPORTED_EXTENSIONS, ECG_MAX_FILE_BYTES);
}

export function createEcgRecording(file: File, bytes: Uint8Array): EcgLoadedRecording {
  const extension = file.name.toLowerCase().endsWith('.json')
    ? '.json'
    : file.name.toLowerCase().endsWith('.csv')
      ? '.csv'
      : file.name.toLowerCase().endsWith('.ecg')
        ? '.ecg'
        : '.txt';

  const waveform = parseWaveformBytes(bytes, extension, ECG_DEFAULT_SAMPLE_RATE);
  const warnings = [...waveform.warnings];

  const leadIds = new Set(waveform.channels.map((c) => c.id));
  const standardFound = ECG_STANDARD_LEADS.filter((l) => leadIds.has(l)).length;
  if (standardFound > 0 && standardFound < ECG_STANDARD_LEADS.length) {
    warnings.push(
      `Partial 12-lead set (${standardFound}/${ECG_STANDARD_LEADS.length} standard leads found).`
    );
  } else if (standardFound === 0 && waveform.channels.length < 2) {
    warnings.push('Fewer than 2 leads — multi-lead layout may look sparse.');
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

export function sortEcgChannels(channelIds: string[]): string[] {
  const order = new Map(ECG_STANDARD_LEADS.map((id, index) => [id, index]));
  return [...channelIds].sort((a, b) => {
    const ai = order.get(a) ?? 999;
    const bi = order.get(b) ?? 999;
    if (ai !== bi) return ai - bi;
    return a.localeCompare(b);
  });
}

export function exportEcgSummaryJson(record: EcgLoadedRecording, caliperCount: number): string {
  return JSON.stringify(
    {
      name: record.name,
      size: record.size,
      sampleRateHz: record.waveform.sampleRateHz,
      durationSec: record.waveform.durationSec,
      channelCount: record.waveform.channels.length,
      channels: record.waveform.channels.map((c) => c.id),
      caliperCount,
      warnings: record.warnings,
      note: 'Education/research ECG preview — not for diagnostic use.'
    },
    null,
    2
  );
}

export function exportEcgCalipersJson(
  record: EcgLoadedRecording,
  calipers: EcgCaliperMark[]
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

export function canExportEcg(record: EcgLoadedRecording | null): boolean {
  return !!record && record.waveform.channels.length > 0;
}

export function resolveEcgSuggestion(state: {
  hasRecordings: boolean;
  hasError: boolean;
}): EcgSuggestion | null {
  if (state.hasError) {
    return {
      id: 'try-sample',
      title: 'Try the sample 12-lead ECG',
      reason: 'Load the embedded waveform to verify leads, gain, and calipers.',
      actionLabel: 'Open sample',
      path: '/medical-viewers/ecg-viewer'
    };
  }
  if (!state.hasRecordings) {
    return {
      id: 'upload',
      title: 'Upload an ECG waveform',
      reason: ECG_FORMATS_HINT,
      actionLabel: 'Choose file',
      path: '/medical-viewers/ecg-viewer'
    };
  }
  return null;
}

export function estimateHeartRateBpm(deltaTimeMs: number): number | null {
  if (!Number.isFinite(deltaTimeMs) || deltaTimeMs <= 0) return null;
  return Math.round(60000 / deltaTimeMs);
}
