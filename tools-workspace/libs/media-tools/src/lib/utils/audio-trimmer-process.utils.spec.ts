import {
  applyFadeEnvelope,
  audioBufferToWavBlob,
  buildTrimmedFileName,
  computeWaveformPeaks,
  extractTrimmedBuffer,
  nearestTrimHandle,
  parseTrimTimestampInput
} from './audio-trimmer-process.utils';

function createTestBuffer(durationSeconds = 1, sampleRate = 44100): AudioBuffer {
  const length = Math.floor(durationSeconds * sampleRate);
  const buffer = {
    length,
    duration: durationSeconds,
    sampleRate,
    numberOfChannels: 1,
    getChannelData: () => new Float32Array(length).fill(0.5)
  } as unknown as AudioBuffer;
  return buffer;
}

describe('audio-trimmer-process.utils', () => {
  it('computes waveform peaks', () => {
    const peaks = computeWaveformPeaks(createTestBuffer(), 10);
    expect(peaks).toHaveLength(10);
    expect(peaks.every((p) => p >= 0 && p <= 1)).toBe(true);
  });

  it('extracts trimmed buffer with fades', () => {
    if (typeof AudioContext === 'undefined') {
      return;
    }
    const source = createTestBuffer(2);
    const trimmed = extractTrimmedBuffer(source, 0.25, 1.25, {
      fadeInSeconds: 0.1,
      fadeOutSeconds: 0.1
    });
    expect(trimmed.duration).toBeCloseTo(1, 2);
    expect(trimmed.length).toBeGreaterThan(0);
  });

  it('applies fade envelope without throwing', () => {
    const buffer = createTestBuffer(1);
    expect(() => applyFadeEnvelope(buffer, 0.2, 0.2)).not.toThrow();
  });

  it('encodes wav blob', () => {
    const blob = audioBufferToWavBlob(createTestBuffer(0.5));
    expect(blob.type).toBe('audio/wav');
    expect(blob.size).toBeGreaterThan(44);
  });

  it('parses timestamp inputs', () => {
    expect(parseTrimTimestampInput('1.5')).toBe(1.5);
    expect(parseTrimTimestampInput('1:05.500')).toBe(65.5);
    expect(parseTrimTimestampInput('1:01:01.001')).toBe(3661.001);
    expect(parseTrimTimestampInput('bad')).toBeNull();
  });

  it('detects nearest trim handle', () => {
    expect(nearestTrimHandle(0.1, 0.1, 0.9)).toBe('start');
    expect(nearestTrimHandle(0.9, 0.1, 0.9)).toBe('end');
    expect(nearestTrimHandle(0.5, 0.1, 0.9)).toBeNull();
  });

  it('builds trimmed file names', () => {
    expect(buildTrimmedFileName('song.mp3', '.wav')).toBe('song-trimmed.wav');
  });
});
