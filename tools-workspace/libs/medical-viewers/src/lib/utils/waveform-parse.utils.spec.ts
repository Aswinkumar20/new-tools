import { applyMontage, computeCaliper, parseWaveformBytes } from './waveform-parse.utils';
import { buildSampleEcgPayload } from './ecg-viewer.utils';
import { buildSampleEegPayload } from './eeg-viewer.utils';

describe('waveform-parse.utils', () => {
  it('parses JSON ECG with leads', () => {
    const payload = buildSampleEcgPayload();
    const bytes = new TextEncoder().encode(JSON.stringify(payload));
    const parsed = parseWaveformBytes(bytes, '.json');
    expect(parsed.sampleRateHz).toBe(500);
    expect(parsed.channels.length).toBe(12);
    expect(parsed.durationSec).toBeCloseTo(4, 1);
  });

  it('parses CSV waveforms', () => {
    const csv = 'time,I,II\n0,0.1,0.2\n0.002,0.15,0.25\n';
    const bytes = new TextEncoder().encode(csv);
    const parsed = parseWaveformBytes(bytes, '.csv', 500);
    expect(parsed.channels.length).toBe(2);
    expect(parsed.channels[0].samples.length).toBe(2);
  });

  it('computes caliper deltas', () => {
    const result = computeCaliper(0, 0, 120, 40, 120, 28);
    expect(result.deltaTimeMs).toBeCloseTo(1000, 0);
    expect(result.deltaAmplitude).toBeCloseTo(40 / 28, 2);
  });

  it('applies bipolar montage', () => {
    const payload = buildSampleEegPayload();
    const bytes = new TextEncoder().encode(JSON.stringify(payload));
    const parsed = parseWaveformBytes(bytes, '.json');
    const ids = parsed.channels.map((c) => c.id);
    const bipolar = applyMontage(parsed, 'bipolar', ids);
    expect(bipolar.length).toBe(ids.length - 1);
  });
});
