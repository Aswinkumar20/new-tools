import {
  clampCaesarShift,
  caesarDecodeShift,
  convertRot13CipherText,
  inputHasAlphabeticCharacters,
  resolveRot13Suggestion,
} from './rot13-cipher.utils';

describe('rot13-cipher.utils', () => {
  it('applies ROT13', () => {
    expect(convertRot13CipherText({ mode: 'rot13', inputText: 'Hello', caesarShift: 3 }).output).toBe(
      'Uryyb'
    );
  });

  it('ROT13 is self-inverse', () => {
    const once = convertRot13CipherText({ mode: 'rot13', inputText: 'Hello', caesarShift: 3 }).output;
    expect(convertRot13CipherText({ mode: 'rot13', inputText: once, caesarShift: 3 }).output).toBe(
      'Hello'
    );
  });

  it('applies Caesar with custom shift', () => {
    expect(convertRot13CipherText({ mode: 'caesar', inputText: 'ABC', caesarShift: 1 }).output).toBe(
      'BCD'
    );
  });

  it('leaves non-letters unchanged', () => {
    expect(convertRot13CipherText({ mode: 'rot13', inputText: 'Hi 42!', caesarShift: 3 }).output).toBe(
      'Uv 42!'
    );
  });

  it('clamps caesar shift to 1–25', () => {
    expect(clampCaesarShift(0)).toBe(1);
    expect(clampCaesarShift(26)).toBe(25);
    expect(clampCaesarShift(13)).toBe(13);
  });

  it('preserves non-finite shift values', () => {
    expect(Number.isNaN(clampCaesarShift(Number.NaN))).toBe(true);
  });

  it('computes decode shift', () => {
    expect(caesarDecodeShift(3)).toBe(23);
    expect(caesarDecodeShift(13)).toBe(13);
  });

  it('detects alphabetic characters', () => {
    expect(inputHasAlphabeticCharacters('123!')).toBe(false);
    expect(inputHasAlphabeticCharacters('a1')).toBe(true);
  });

  it('suggests get-started with empty input', () => {
    expect(
      resolveRot13Suggestion({
        mode: 'rot13',
        hasInput: false,
        hasOutput: false,
        caesarShift: 3,
        decodeShift: 23,
        inputHasLetters: false,
      })?.id
    ).toBe('rot13-get-started');
  });

  it('suggests when input has no letters', () => {
    expect(
      resolveRot13Suggestion({
        mode: 'rot13',
        hasInput: true,
        hasOutput: true,
        caesarShift: 3,
        decodeShift: 23,
        inputHasLetters: false,
      })?.id
    ).toBe('rot13-no-letters');
  });

  it('suggests ROT13 when Caesar shift is 13', () => {
    expect(
      resolveRot13Suggestion({
        mode: 'caesar',
        hasInput: true,
        hasOutput: true,
        caesarShift: 13,
        decodeShift: 13,
        inputHasLetters: true,
      })?.id
    ).toBe('rot13-caesar-13');
  });

  it('suggests after ROT13 output', () => {
    expect(
      resolveRot13Suggestion({
        mode: 'rot13',
        hasInput: true,
        hasOutput: true,
        caesarShift: 3,
        decodeShift: 23,
        inputHasLetters: true,
      })?.id
    ).toBe('rot13-encoded');
  });
});
