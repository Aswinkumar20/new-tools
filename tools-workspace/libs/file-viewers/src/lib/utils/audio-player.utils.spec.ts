import {
  clampVolumePercent,
  cycleRepeatMode,
  filterValidAudioFiles,
  formatAudioFileSize,
  formatAudioTime,
  generateShuffledIndices,
  isIgnorablePlaybackError,
  isSupportedAudioFile,
  resolveAudioSuggestion,
  resolveNextTrackIndex,
  resolvePreviousTrackIndex,
  shouldStopAtPlaylistEnd
} from './audio-player.utils';

describe('audio-player utils', () => {
  it('validates audio files and formats time/size', () => {
    expect(isSupportedAudioFile({ name: 'a.mp3', type: '' })).toBe(true);
    expect(isSupportedAudioFile({ name: 'a.txt', type: 'audio/mpeg' })).toBe(true);
    expect(isSupportedAudioFile({ name: 'a.txt', type: 'text/plain' })).toBe(false);
    expect(
      filterValidAudioFiles([new File([''], 'a.wav'), new File([''], 'b.txt')])
    ).toHaveLength(1);
    expect(formatAudioTime(65)).toBe('1:05');
    expect(formatAudioTime(3661)).toBe('1:01:01');
    expect(formatAudioTime(Number.NaN)).toBe('0:00');
    expect(formatAudioFileSize(0)).toBe('0 Bytes');
    expect(formatAudioFileSize(2048)).toBe('2 KB');
  });

  it('clamps volume and cycles repeat modes', () => {
    expect(clampVolumePercent(-5)).toBe(0);
    expect(clampVolumePercent(150)).toBe(100);
    expect(cycleRepeatMode('none')).toBe('all');
    expect(cycleRepeatMode('all')).toBe('one');
    expect(cycleRepeatMode('one')).toBe('none');
  });

  it('resolves shuffle/sequential navigation and playlist end', () => {
    expect(
      resolvePreviousTrackIndex({
        trackCount: 3,
        currentIndex: 0,
        shuffleMode: false,
        shuffledIndices: []
      })
    ).toBe(2);
    expect(
      resolveNextTrackIndex({
        trackCount: 3,
        currentIndex: 2,
        shuffleMode: false,
        shuffledIndices: []
      })
    ).toBe(0);
    expect(
      shouldStopAtPlaylistEnd({
        repeatMode: 'none',
        currentIndex: 2,
        nextIndex: 0,
        trackCount: 3
      })
    ).toBe(true);
    expect(generateShuffledIndices(3, () => 0)).toHaveLength(3);
  });

  it('detects ignorable playback errors and suggestions', () => {
    expect(isIgnorablePlaybackError({ name: 'AbortError' })).toBe(true);
    expect(isIgnorablePlaybackError({ name: 'TypeError' })).toBe(false);

    expect(
      resolveAudioSuggestion({
        hasTracks: false,
        hasError: false,
        isPlaying: false,
        trackCount: 0
      })?.id
    ).toBe('ap-archive');

    expect(
      resolveAudioSuggestion({
        hasTracks: true,
        hasError: true,
        isPlaying: false,
        trackCount: 1
      })?.id
    ).toBe('ap-meta');

    expect(
      resolveAudioSuggestion({
        hasTracks: true,
        hasError: false,
        isPlaying: true,
        trackCount: 3
      })?.id
    ).toBe('ap-video');
  });
});
