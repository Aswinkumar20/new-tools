import { midiPitchLabel } from './midi-viewer.utils';

describe('midi-viewer.utils', () => {
  it('labels MIDI pitches', () => {
    expect(midiPitchLabel(60)).toBe('C4');
    expect(midiPitchLabel(61)).toBe('C#4');
  });
});
