import {
  ALL_PRESETS,
  convertCase,
  detectCase,
  isValidIdentifier,
  resolveTextCaseSuggestion,
} from './text-case-convertor.utils';

describe('text-case-convertor.utils', () => {
  describe('ALL_PRESETS', () => {
    it('should have unique ids', () => {
      const ids = ALL_PRESETS.map((p) => p.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('should cover every CaseId used in convertCase', () => {
      expect(ALL_PRESETS.length).toBeGreaterThanOrEqual(40);
    });
  });

  describe('convertCase — standard', () => {
    it('converts upper and lower', () => {
      expect(convertCase('upper', 'Hello World')).toBe('HELLO WORLD');
      expect(convertCase('lower', 'Hello World')).toBe('hello world');
    });

    it('converts title case', () => {
      expect(convertCase('title', 'hello world')).toBe('Hello World');
    });

    it('converts AP style title case', () => {
      expect(convertCase('apTitle', 'the lord of the rings')).toBe('The Lord of the Rings');
      expect(convertCase('apTitle', 'a story of the sea')).toBe('A Story of the Sea');
    });

    it('converts Chicago title case with capital I', () => {
      expect(convertCase('chicagoTitle', 'tales of i and the king')).toContain('I');
    });

    it('respects title exceptions', () => {
      const result = convertCase('apTitle', 'using javascript today', {
        titleExceptions: ['JavaScript'],
      });
      expect(result).toBe('Using JavaScript Today');
    });

    it('toggles case', () => {
      expect(convertCase('toggle', 'AbC')).toBe('aBc');
    });

    it('converts sentence case', () => {
      expect(convertCase('sentence', 'hello. world!')).toBe('Hello. World!');
    });
  });

  describe('convertCase — programming', () => {
    it('converts camel, pascal, snake, kebab', () => {
      expect(convertCase('camel', 'hello world')).toBe('helloWorld');
      expect(convertCase('pascal', 'hello world')).toBe('HelloWorld');
      expect(convertCase('snake', 'hello world')).toBe('hello_world');
      expect(convertCase('kebab', 'hello world')).toBe('hello-world');
    });

    it('converts upper snake and flat', () => {
      expect(convertCase('upperSnake', 'hello world')).toBe('HELLO_WORLD');
      expect(convertCase('flat', 'hello world')).toBe('helloworld');
    });

    it('converts slug case', () => {
      expect(convertCase('slug', 'Hello World 2024')).toBe('hello-world-2024');
    });

    it('converts hashtag case', () => {
      expect(convertCase('hashtag', 'hello world')).toBe('#HelloWorld');
    });

    it('uppercases SQL keywords only', () => {
      const sql = "select name from users where id = 1";
      const result = convertCase('sql', sql);
      expect(result).toContain('SELECT');
      expect(result).toContain('FROM');
      expect(result).toContain('WHERE');
      expect(result).toContain('name');
    });

    it('preserves quoted SQL identifiers', () => {
      const result = convertCase('sql', 'select "myColumn" from t');
      expect(result).toContain('"myColumn"');
    });

    it('converts hungarian notation', () => {
      expect(convertCase('hungarian', 'user name')).toBe('strUserName');
    });

    it('splits camelCase input for snake', () => {
      expect(convertCase('snake', 'myVariableName')).toBe('my_variable_name');
    });
  });

  describe('convertCase — fun', () => {
    it('converts mocking case with fixed alternation', () => {
      expect(convertCase('mocking', 'hello')).toBe('hElLo');
    });

    it('produces reproducible studly/random with seed', () => {
      const a = convertCase('studly', 'hello', { randomSeed: 99 });
      const b = convertCase('studly', 'hello', { randomSeed: 99 });
      expect(a).toBe(b);
      expect(a).not.toBe('hello');
    });

    it('converts pig latin', () => {
      expect(convertCase('pigLatin', 'hello')).toBe('ellohay');
      expect(convertCase('pigLatin', 'apple')).toBe('appleway');
    });

    it('encodes morse and nato', () => {
      expect(convertCase('morse', 'sos')).toContain('...');
      expect(convertCase('nato', 'abc')).toBe('Alpha Bravo Charlie');
    });

    it('encodes binary and hex', () => {
      expect(convertCase('binary', 'A')).toBe('01000001');
      expect(convertCase('hex', 'A')).toBe('41');
    });

    it('converts bubble text', () => {
      expect(convertCase('bubble', 'hi')).toContain('ⓗ');
    });

    it('adds emoji between words', () => {
      const result = convertCase('emojiSpaced', 'hello world');
      expect(result).toMatch(/hello .+ world/);
    });

    it('produces stable zalgo output with seed', () => {
      const a = convertCase('zalgo', 'hi', { randomSeed: 7 });
      const b = convertCase('zalgo', 'hi', { randomSeed: 7 });
      expect(a).toBe(b);
      expect(a.length).toBeGreaterThan(2);
    });

    it('brackets text', () => {
      expect(convertCase('bracketed', 'test')).toBe('[test]');
    });
  });

  describe('convertCase — options', () => {
    it('applies unicode normalization', () => {
      const nfd = 'é'.normalize('NFD');
      const result = convertCase('upper', nfd, { unicodeForm: 'NFC' });
      expect(result).toBe('É');
    });

    it('applies locale for Turkish', () => {
      expect(convertCase('upper', 'istanbul', { locale: 'tr' })).toBe('İSTANBUL');
    });

    it('escapes for JSON', () => {
      expect(convertCase('lower', 'Hello\nWorld', { escapeMode: 'json' })).toBe('"hello\\nworld"');
    });

    it('applies custom regex rules after conversion', () => {
      const result = convertCase('lower', 'foo BAR', {
        customRules: [{ pattern: 'bar', replacement: 'upper' }],
      });
      expect(result).toBe('foo BAR');
    });

    it('preserves whitespace in input (no trim)', () => {
      expect(convertCase('upper', '  hi  ')).toBe('  HI  ');
    });
  });

  describe('detectCase', () => {
    it('detects programming cases', () => {
      expect(detectCase('myVariable')).toBe('camelCase');
      expect(detectCase('MyVariable')).toBe('PascalCase');
      expect(detectCase('my_variable')).toBe('snake_case');
      expect(detectCase('MY_VARIABLE')).toBe('UPPER_SNAKE');
      expect(detectCase('my-variable')).toBe('kebab-case');
      expect(detectCase('helloworld')).toBe('flatcase');
    });

    it('returns unknown for empty', () => {
      expect(detectCase('')).toBe('unknown');
      expect(detectCase('   ')).toBe('unknown');
    });
  });

  describe('isValidIdentifier', () => {
    it('validates JS identifiers', () => {
      expect(isValidIdentifier('myVar', 'js')).toBe(true);
      expect(isValidIdentifier('2bad', 'js')).toBe(false);
      expect(isValidIdentifier('class', 'js')).toBe(false);
    });

    it('validates Python identifiers', () => {
      expect(isValidIdentifier('_private', 'python')).toBe(true);
      expect(isValidIdentifier('class', 'python')).toBe(false);
    });
  });

  describe('resolveTextCaseSuggestion', () => {
    it('suggests get-started when empty', () => {
      expect(
        resolveTextCaseSuggestion({
          hasInput: false,
          hasOutput: false,
          selectedCase: 'upper',
          detectedCase: 'unknown',
          identifierWarning: '',
          zalgoLengthWarning: '',
          inputLength: 0,
        })?.id
      ).toBe('tcc-get-started');
    });

    it('suggests slug generator for slug preset', () => {
      expect(
        resolveTextCaseSuggestion({
          hasInput: true,
          hasOutput: true,
          selectedCase: 'slug',
          detectedCase: 'lowercase',
          identifierWarning: '',
          zalgoLengthWarning: '',
          inputLength: 10,
        })?.id
      ).toBe('tcc-slug-preset');
    });

    it('suggests when programming case is detected', () => {
      expect(
        resolveTextCaseSuggestion({
          hasInput: true,
          hasOutput: true,
          selectedCase: 'upper',
          detectedCase: 'camelCase',
          identifierWarning: '',
          zalgoLengthWarning: '',
          inputLength: 12,
        })?.id
      ).toBe('tcc-detected-programming');
    });
  });
});
