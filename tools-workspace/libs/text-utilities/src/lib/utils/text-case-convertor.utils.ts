import {
  AP_SMALL_WORDS,
  CHICAGO_SMALL_WORDS,
  SQL_KEYWORDS,
  NATO_ALPHABET,
  MORSE_CODE,
  BUBBLE_MAP,
  WINGDINGS_MAP,
  ZALGO_MARKS,
} from '../constants/text-case-convertor.constants';
import type {
  CaseId,
  CasePreset,
  ConvertOptions,
  CustomRule,
  DetectedCase,
  EscapeMode,
  TextCaseSuggestionContext,
  UnicodeForm,
} from '../types/text-case-convertor.types';
import type { TuToolSuggestion } from '../shared/tu-tool-suggestion.model';

export type {
  CaseId,
  CasePreset,
  CasePresetCategory,
  ConvertOptions,
  CustomRule,
  DetectedCase,
  EscapeMode,
  TextCaseSuggestionContext,
  UnicodeForm,
} from '../types/text-case-convertor.types';

export const ALL_PRESETS: CasePreset[] = [
  { id: 'lower', label: 'lowercase', category: 'standard' },
  { id: 'upper', label: 'UPPERCASE', category: 'standard' },
  { id: 'sentence', label: 'Sentence case', category: 'standard' },
  { id: 'title', label: 'Title Case', category: 'standard' },
  { id: 'apTitle', label: 'AP Style title', category: 'standard' },
  { id: 'chicagoTitle', label: 'Chicago title', category: 'standard' },
  { id: 'toggle', label: 'Toggle Case', category: 'standard' },
  { id: 'camel', label: 'camelCase', category: 'programming' },
  { id: 'pascal', label: 'PascalCase', category: 'programming' },
  { id: 'snake', label: 'snake_case', category: 'programming' },
  { id: 'upperSnake', label: 'UPPER_SNAKE', category: 'programming' },
  { id: 'flat', label: 'flatcase', category: 'programming' },
  { id: 'kebab', label: 'kebab-case', category: 'programming' },
  { id: 'slug', label: 'slug-case', category: 'programming' },
  { id: 'train', label: 'Train-Case', category: 'programming' },
  { id: 'dot', label: 'dot.case', category: 'programming' },
  { id: 'path', label: 'path/case', category: 'programming' },
  { id: 'constant', label: 'CONSTANT', category: 'programming' },
  { id: 'macro', label: 'MACRO_CASE', category: 'programming' },
  { id: 'camelSnake', label: 'camel_Snake', category: 'programming' },
  { id: 'pascalSnake', label: 'Pascal_Snake', category: 'programming' },
  { id: 'dotPascal', label: 'Dot.Pascal', category: 'programming' },
  { id: 'sql', label: 'SQL case', category: 'programming' },
  { id: 'hungarian', label: 'Hungarian', category: 'programming' },
  { id: 'hashtag', label: 'Hashtag', category: 'programming' },
  { id: 'alternating', label: 'aLtErNaTiNg', category: 'fun' },
  { id: 'mocking', label: 'mOcKiNg', category: 'fun' },
  { id: 'studly', label: 'StUdLy CaPs', category: 'fun' },
  { id: 'randomCase', label: 'Random (seeded)', category: 'fun' },
  { id: 'reversed', label: 'Reversed', category: 'fun' },
  { id: 'vowelUpper', label: 'vOwEl UppEr', category: 'fun' },
  { id: 'consonantUpper', label: 'CoNSoNaNT', category: 'fun' },
  { id: 'leet', label: '1337 5P34K', category: 'fun' },
  { id: 'fullwidth', label: 'Ｆｕｌｌｗｉｄｔｈ', category: 'fun' },
  { id: 'smallCaps', label: 'sᴍᴀʟʟ ᴄᴀᴘs', category: 'fun' },
  { id: 'upsideDown', label: 'uʍop ǝpᴉsd∩', category: 'fun' },
  { id: 'mixed', label: 'MiXeD cAsE', category: 'fun' },
  { id: 'bracketed', label: '[bracketed]', category: 'fun' },
  { id: 'bubble', label: 'Bubble text', category: 'fun' },
  { id: 'zalgo', label: 'Zalgo glitch', category: 'fun' },
  { id: 'wingdings', label: 'Wingdings-style', category: 'fun' },
  { id: 'emojiSpaced', label: 'Emoji spaced', category: 'fun' },
  { id: 'pigLatin', label: 'Pig Latin', category: 'fun' },
  { id: 'morse', label: 'Morse code', category: 'fun' },
  { id: 'nato', label: 'NATO alphabet', category: 'fun' },
  { id: 'binary', label: 'Binary encode', category: 'fun' },
  { id: 'hex', label: 'Hex encode', category: 'fun' },
];

function capitalize(word: string, locale = 'en'): string {
  if (!word) return word;
  return word.charAt(0).toLocaleUpperCase(locale) + word.slice(1).toLocaleLowerCase(locale);
}

function splitWords(text: string, locale = 'en'): string[] {
  return text
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLocaleLowerCase(locale)
    .split(/[\s_\-\.\/]+/)
    .filter(Boolean);
}

function applyUnicodeForm(text: string, form: UnicodeForm): string {
  if (form === 'none' || !text) return text;
  return text.normalize(form);
}

function applyLocaleCase(text: string, mode: 'upper' | 'lower', locale = 'en'): string {
  return mode === 'upper' ? text.toLocaleUpperCase(locale) : text.toLocaleLowerCase(locale);
}

function buildExceptionMap(exceptions: string[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const ex of exceptions) {
    map.set(ex.toLowerCase(), ex);
  }
  return map;
}

function applyTitleExceptions(word: string, exceptions: Map<string, string>): string {
  return exceptions.get(word.toLowerCase()) ?? word;
}

function toTitleWords(
  text: string,
  smallWords: Set<string>,
  options: ConvertOptions,
  style: 'ap' | 'chicago' | 'simple'
): string {
  const locale = options.locale ?? 'en';
  const exceptions = buildExceptionMap(options.titleExceptions ?? []);
  const words = text.split(/(\s+)/);

  const contentWords: string[] = [];
  for (const w of words) {
    if (!/\s/.test(w) && w.length > 0) contentWords.push(w);
  }

  let contentIndex = 0;
  return words
    .map((token) => {
      if (/^\s+$/.test(token)) return token;
      const isFirst = contentIndex === 0;
      const isLast = contentIndex === contentWords.length - 1;
      contentIndex++;

      const bare = token.replace(/[^\w'-]/g, '');
      const lower = bare.toLocaleLowerCase(locale);
      const preserved = applyTitleExceptions(lower, exceptions);
      if (preserved !== lower) {
        return token.replace(bare, preserved);
      }

      const keepLower =
        style !== 'simple' &&
        !isFirst &&
        !isLast &&
        smallWords.has(lower) &&
        bare.length > 0;

      if (keepLower) {
        return token.replace(bare, applyLocaleCase(bare, 'lower', locale));
      }

      const cased =
        style === 'chicago' && lower === 'i'
          ? 'I'
          : capitalize(bare, locale);
      return token.replace(bare, cased);
    })
    .join('');
}

function seededRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

function toCamelCase(text: string, locale = 'en'): string {
  const words = splitWords(text, locale);
  if (!words.length) return '';
  return words[0] + words.slice(1).map((w) => capitalize(w, locale)).join('');
}

function toPascalCase(text: string, locale = 'en'): string {
  return splitWords(text, locale).map((w) => capitalize(w, locale)).join('');
}

function toSnakeCase(text: string, locale = 'en'): string {
  return splitWords(text, locale).join('_');
}

function toKebabCase(text: string, locale = 'en'): string {
  return splitWords(text, locale).join('-');
}

function toSlugCase(text: string, locale = 'en'): string {
  return splitWords(text, locale)
    .map((w) => w.replace(/[^a-z0-9]/gi, ''))
    .filter(Boolean)
    .join('-');
}

function toFlatCase(text: string, locale = 'en'): string {
  return splitWords(text, locale).join('');
}

function toHungarianCase(text: string, locale = 'en'): string {
  const pascal = toPascalCase(text, locale);
  if (!pascal) return '';
  const lower = pascal.charAt(0).toLowerCase() + pascal.slice(1);
  return `str${pascal.charAt(0).toUpperCase() + lower.slice(1)}`;
}

function toHashtagCase(text: string, locale = 'en'): string {
  const pascal = toPascalCase(text, locale);
  return pascal ? `#${pascal}` : '';
}

function toSqlCase(text: string): string {
  return text.replace(/('[^']*'|"[^"]*")|\b([a-zA-Z_][\w]*)\b/g, (match, quoted, word) => {
    if (quoted) return quoted;
    if (!word) return match;
    const upper = word.toUpperCase();
    return SQL_KEYWORDS.has(upper) ? upper : word;
  });
}

function toMockingCase(text: string): string {
  let upper = false;
  return text
    .split('')
    .map((char) => {
      if (/[a-zA-Z]/.test(char)) {
        const out = upper ? char.toUpperCase() : char.toLowerCase();
        upper = !upper;
        return out;
      }
      return char;
    })
    .join('');
}

function toRandomCase(text: string, seed: number): string {
  const rand = seededRandom(seed);
  return text
    .split('')
    .map((char) => {
      if (!/[a-zA-Z]/.test(char)) return char;
      return rand() > 0.5 ? char.toUpperCase() : char.toLowerCase();
    })
    .join('');
}

function toPigLatinWord(word: string): string {
  const match = word.match(/^([^a-zA-Z]*)([a-zA-Z]+)([^a-zA-Z]*)$/);
  if (!match) return word;
  const [, pre, core, post] = match;
  const lower = core.toLowerCase();
  if (!lower) return word;
  const startsVowel = /^[aeiou]/.test(lower);
  const translated = startsVowel
    ? `${core}way`
    : `${core.slice(1)}${core.charAt(0)}ay`;
  return `${pre}${translated}${post}`;
}

function toPigLatin(text: string): string {
  return text.split(/(\s+)/).map((t) => (/\s/.test(t) ? t : toPigLatinWord(t))).join('');
}

function toMorse(text: string): string {
  return text
    .toLowerCase()
    .split('')
    .map((c) => MORSE_CODE[c] ?? c)
    .join(' ');
}

function toNato(text: string): string {
  return text
    .toLowerCase()
    .split('')
    .filter((c) => c.trim())
    .map((c) => NATO_ALPHABET[c] ?? c.toUpperCase())
    .join(' ');
}

function toBinary(text: string): string {
  return Array.from(text)
    .map((c) => c.charCodeAt(0).toString(2).padStart(8, '0'))
    .join(' ');
}

function toHex(text: string): string {
  return Array.from(text)
    .map((c) => c.charCodeAt(0).toString(16).padStart(2, '0'))
    .join(' ');
}

function toBubble(text: string): string {
  return text
    .toLowerCase()
    .split('')
    .map((c) => BUBBLE_MAP[c] ?? c)
    .join('');
}

function toWingdings(text: string): string {
  return text
    .toLowerCase()
    .split('')
    .map((c) => WINGDINGS_MAP[c] ?? c)
    .join('');
}

function toZalgo(text: string, seed = 42, maxLen = 500): string {
  const input = text.slice(0, maxLen);
  const rand = seededRandom(seed);
  return input
    .split('')
    .map((char) => {
      if (!/[a-zA-Z]/.test(char)) return char;
      const count = 1 + Math.floor(rand() * 3);
      let out = char;
      for (let i = 0; i < count; i++) {
        out += ZALGO_MARKS[Math.floor(rand() * ZALGO_MARKS.length)];
      }
      return out;
    })
    .join('');
}

function toEmojiSpaced(text: string): string {
  const emojis = ['👋', '✨', '🔥', '💡', '🎯', '⭐', '🚀', '💬'];
  const words = text.trim().split(/\s+/);
  if (words.length <= 1) return text;
  return words
    .map((w, i) => (i < words.length - 1 ? `${w} ${emojis[i % emojis.length]}` : w))
    .join(' ');
}

function applyCustomRules(text: string, rules: CustomRule[], options: ConvertOptions): string {
  let result = text;
  for (const rule of rules) {
    if (!rule.pattern.trim()) continue;
    try {
      const regex = new RegExp(rule.pattern, 'g');
      result = result.replace(regex, (match) =>
        convertCase(rule.replacement as CaseId, match, {
          ...options,
          customRules: [],
          escapeMode: 'none',
        })
      );
    } catch {
      // skip invalid regex
    }
  }
  return result;
}

function escapeForCode(text: string, mode: EscapeMode): string {
  switch (mode) {
    case 'json':
      return JSON.stringify(text);
    case 'js':
      return `'${text.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t')}'`;
    case 'python':
      return `'${text.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t')}'`;
    default:
      return text;
  }
}

const LEET_MAP: Record<string, string> = {
  a: '4', e: '3', i: '1', o: '0', l: '1', s: '5', t: '7', b: '8', g: '6', z: '2',
};

const SMALL_CAPS_MAP: Record<string, string> = {
  a: 'ᴀ', b: 'ʙ', c: 'ᴄ', d: 'ᴅ', e: 'ᴇ', f: 'ғ', g: 'ɢ', h: 'ʜ', i: 'ɪ', j: 'ᴊ', k: 'ᴋ',
  l: 'ʟ', m: 'ᴍ', n: 'ɴ', o: 'ᴏ', p: 'ᴘ', q: 'ǫ', r: 'ʀ', s: 's', t: 'ᴛ', u: 'ᴜ', v: 'ᴠ',
  w: 'ᴡ', x: 'x', y: 'ʏ', z: 'ᴢ',
};

const UPSIDE_DOWN_MAP: Record<string, string> = {
  a: 'ɐ', b: 'q', c: 'ɔ', d: 'p', e: 'ǝ', f: 'ɟ', g: 'ƃ', h: 'ɥ', i: 'ᴉ', j: 'ɾ', k: 'ʞ',
  l: 'l', m: 'ɯ', n: 'u', o: 'o', p: 'd', q: 'b', r: 'ɹ', s: 's', t: 'ʇ', u: 'n', v: 'ʌ',
  w: 'ʍ', x: 'x', y: 'ʎ', z: 'z', '.': '˙', '[': ']', '(': ')', '{': '}', '?': '¿', '!': '¡',
  "'": ',', '<': '>', '_': '‾',
};

export function convertCase(caseId: CaseId, text: string, options: ConvertOptions = {}): string {
  const locale = options.locale ?? 'en';
  const unicodeForm = options.unicodeForm ?? 'none';
  let normalized = applyUnicodeForm(text, unicodeForm);
  const working = normalized;

  let result: string;

  switch (caseId) {
    case 'upper':
      result = applyLocaleCase(working, 'upper', locale);
      break;
    case 'lower':
      result = applyLocaleCase(working, 'lower', locale);
      break;
    case 'title':
      result = working.replace(/\S+/g, (word) => capitalize(word, locale));
      break;
    case 'apTitle':
      result = toTitleWords(working, options.smallWords ?? AP_SMALL_WORDS, options, 'ap');
      break;
    case 'chicagoTitle':
      result = toTitleWords(working, options.smallWords ?? CHICAGO_SMALL_WORDS, options, 'chicago');
      break;
    case 'sentence': {
      const sentences = applyLocaleCase(working, 'lower', locale).match(/[^.!?]+[.!?]*\s*/g) || [];
      result = sentences
        .map((s) => s.trim())
        .map((s) => (s ? capitalize(s, locale) : s))
        .join(' ');
      break;
    }
    case 'toggle':
      result = working
        .split('')
        .map((char) =>
          char === char.toLocaleUpperCase(locale) ? char.toLocaleLowerCase(locale) : char.toLocaleUpperCase(locale)
        )
        .join('');
      break;
    case 'camel':
      result = toCamelCase(working, locale);
      break;
    case 'pascal':
      result = toPascalCase(working, locale);
      break;
    case 'snake':
      result = toSnakeCase(working, locale);
      break;
    case 'upperSnake':
      result = applyLocaleCase(toSnakeCase(working, locale), 'upper', locale);
      break;
    case 'flat':
      result = toFlatCase(working, locale);
      break;
    case 'kebab':
      result = toKebabCase(working, locale);
      break;
    case 'slug':
      result = toSlugCase(working, locale);
      break;
    case 'train':
      result = splitWords(working, locale).map((w) => capitalize(w, locale)).join('-');
      break;
    case 'dot':
      result = splitWords(working, locale).join('.');
      break;
    case 'path':
      result = splitWords(working, locale).join('/');
      break;
    case 'constant':
    case 'macro':
      result = applyLocaleCase(toSnakeCase(working, locale), 'upper', locale);
      break;
    case 'camelSnake':
      result = splitWords(working, locale)
        .map((word, index) => (index === 0 ? word : capitalize(word, locale)))
        .join('_');
      break;
    case 'pascalSnake':
      result = splitWords(working, locale).map((w) => capitalize(w, locale)).join('_');
      break;
    case 'dotPascal':
      result = splitWords(working, locale).map((w) => capitalize(w, locale)).join('.');
      break;
    case 'sql':
      result = toSqlCase(working);
      break;
    case 'hungarian':
      result = toHungarianCase(working, locale);
      break;
    case 'hashtag':
      result = toHashtagCase(working, locale);
      break;
    case 'alternating':
      result = working
        .split('')
        .map((char, i) => (i % 2 === 0 ? char.toLowerCase() : char.toUpperCase()))
        .join('');
      break;
    case 'mocking':
      result = toMockingCase(working);
      break;
    case 'studly':
      result = toRandomCase(working, options.randomSeed ?? 42);
      break;
    case 'randomCase':
      result = toRandomCase(working, options.randomSeed ?? Date.now());
      break;
    case 'reversed':
      result = working.split('').reverse().join('');
      break;
    case 'vowelUpper':
      result = working
        .split('')
        .map((char) => (/[aeiou]/i.test(char) ? char.toUpperCase() : char.toLowerCase()))
        .join('');
      break;
    case 'consonantUpper':
      result = working
        .split('')
        .map((char) => (/[a-z]/i.test(char) && !/[aeiou]/i.test(char) ? char.toUpperCase() : char.toLowerCase()))
        .join('');
      break;
    case 'leet':
      result = working
        .toLowerCase()
        .split('')
        .map((char) => LEET_MAP[char] ?? char)
        .join('');
      break;
    case 'fullwidth':
      result = working
        .split('')
        .map((char) => {
          const code = char.charCodeAt(0);
          if (code >= 33 && code <= 126) return String.fromCharCode(code + 0xfee0);
          return char;
        })
        .join('');
      break;
    case 'smallCaps':
      result = working
        .toLowerCase()
        .split('')
        .map((char) => SMALL_CAPS_MAP[char] ?? char)
        .join('');
      break;
    case 'upsideDown':
      result = working
        .toLowerCase()
        .split('')
        .reverse()
        .map((char) => UPSIDE_DOWN_MAP[char] ?? char)
        .join('');
      break;
    case 'mixed': {
      let out = '';
      let cap = true;
      for (const char of working) {
        if (/[a-zA-Z]/.test(char)) {
          out += cap ? char.toUpperCase() : char.toLowerCase();
          cap = !cap;
        } else {
          out += char;
        }
      }
      result = out;
      break;
    }
    case 'bracketed':
      result = `[${working}]`;
      break;
    case 'bubble':
      result = toBubble(working);
      break;
    case 'zalgo':
      result = toZalgo(working, options.randomSeed ?? 42);
      break;
    case 'wingdings':
      result = toWingdings(working);
      break;
    case 'emojiSpaced':
      result = toEmojiSpaced(working);
      break;
    case 'pigLatin':
      result = toPigLatin(working);
      break;
    case 'morse':
      result = toMorse(working);
      break;
    case 'nato':
      result = toNato(working);
      break;
    case 'binary':
      result = toBinary(working);
      break;
    case 'hex':
      result = toHex(working);
      break;
    default:
      result = working;
  }

  if (options.customRules?.length) {
    result = applyCustomRules(result, options.customRules, options);
  }

  if (options.escapeMode && options.escapeMode !== 'none') {
    result = escapeForCode(result, options.escapeMode);
  }

  return result;
}

export function detectCase(text: string): DetectedCase {
  const trimmed = text.trim();
  if (!trimmed) return 'unknown';

  if (/^[a-z][a-zA-Z0-9]*$/.test(trimmed) && /[A-Z]/.test(trimmed)) return 'camelCase';
  if (/^[A-Z][a-zA-Z0-9]*$/.test(trimmed)) return 'PascalCase';
  if (/^[a-z][a-z0-9]*(_[a-z][a-z0-9]*)+$/.test(trimmed)) return 'snake_case';
  if (/^[A-Z][A-Z0-9]*(_[A-Z][A-Z0-9]*)+$/.test(trimmed)) return 'UPPER_SNAKE';
  if (/^[a-z][a-z0-9]*(-[a-z][a-z0-9]*)+$/.test(trimmed)) return 'kebab-case';
  if (/^[a-z0-9]+$/.test(trimmed) && trimmed.length > 1) return 'flatcase';
  if (trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed)) return 'UPPERCASE';
  if (trimmed === trimmed.toLowerCase()) return 'lowercase';
  if (/^[A-Z][a-z]*(\s+[A-Za-z]+)*$/.test(trimmed)) return 'Title Case';
  if (/^[A-Z]/.test(trimmed) && !/[A-Z]{2,}/.test(trimmed.slice(1))) return 'Sentence case';

  return 'mixed';
}

export function isValidIdentifier(text: string, lang: 'js' | 'python' = 'js'): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (lang === 'js') {
    try {
      return /^[$A-Z_a-z][$\w]*$/.test(trimmed) && !['break', 'class', 'const', 'continue'].includes(trimmed);
    } catch {
      return false;
    }
  }
  return /^[_a-zA-Z][_a-zA-Z0-9]*$/.test(trimmed) && !['class', 'def', 'import', 'from'].includes(trimmed);
}

export function getPresetById(id: CaseId): CasePreset | undefined {
  return ALL_PRESETS.find((p) => p.id === id);
}

export function getPresetsByCategory(category: 'standard' | 'programming' | 'fun'): CasePreset[] {
  return ALL_PRESETS.filter((p) => p.category === category);
}

const DETECTED_TO_CASE_ID: Partial<Record<DetectedCase, CaseId>> = {
  camelCase: 'camel',
  PascalCase: 'pascal',
  snake_case: 'snake',
  UPPER_SNAKE: 'upperSnake',
  'kebab-case': 'kebab',
  flatcase: 'flat',
  UPPERCASE: 'upper',
  lowercase: 'lower',
  'Title Case': 'title',
  'Sentence case': 'sentence',
};

export function detectedCaseToCaseId(detected: DetectedCase): CaseId | null {
  return DETECTED_TO_CASE_ID[detected] ?? null;
}

export function resolveTextCaseSuggestion(
  context: TextCaseSuggestionContext
): TuToolSuggestion | null {
  const {
    hasInput,
    hasOutput,
    selectedCase,
    detectedCase,
    identifierWarning,
    zalgoLengthWarning,
  } = context;

  if (!hasInput) {
    return {
      id: 'tcc-get-started',
      title: 'Convert text case?',
      reason:
        'Paste a title, identifier, or sentence. Pick a preset (or Code cycle for camel → snake → kebab → pascal). Output updates live.',
      actionLabel: 'Open Slug Generator',
      path: '/text-utilities/slug-generator',
    };
  }

  if (zalgoLengthWarning) {
    return {
      id: 'tcc-zalgo-long',
      title: 'Zalgo on long text',
      reason: zalgoLengthWarning,
      actionLabel: 'Open Trim / Normalize Whitespace',
      path: '/text-utilities/trim-normalize-whitespace',
    };
  }

  if (selectedCase === 'slug') {
    return {
      id: 'tcc-slug-preset',
      title: 'Need URL-ready slugs?',
      reason:
        'This preset approximates slug-case. Slug Generator adds separators, history, and URL preview for headlines.',
      actionLabel: 'Open Slug Generator',
      path: '/text-utilities/slug-generator',
    };
  }

  if (selectedCase === 'morse' || selectedCase === 'nato') {
    return {
      id: 'tcc-morse-nato',
      title: selectedCase === 'morse' ? 'Dedicated Morse tool available' : 'Phonetic spelling tip',
      reason:
        selectedCase === 'morse'
          ? 'Morse Code Converter focuses on encode/decode with clearer token spacing. Use → In here to keep editing.'
          : 'NATO alphabet is great for spelling aloud. Morse Converter is nearby for radio-style encoding.',
      actionLabel: 'Open Morse Code Converter',
      path: '/text-utilities/morse-code-converter',
    };
  }

  if (selectedCase === 'binary' || selectedCase === 'hex') {
    return {
      id: 'tcc-binary-hex',
      title: 'Dedicated encoders available',
      reason:
        selectedCase === 'binary'
          ? 'Binary Text Converter supports bit-width options for fuller control.'
          : 'Hex Encoder & Decoder handles UTF-8 bytes with clearer round-trips.',
      actionLabel:
        selectedCase === 'binary' ? 'Open Binary Text Converter' : 'Open Hex Encoder & Decoder',
      path:
        selectedCase === 'binary'
          ? '/text-utilities/binary-text-converter'
          : '/text-utilities/hex-encode-decode',
    };
  }

  if (identifierWarning) {
    return {
      id: 'tcc-bad-identifier',
      title: 'Output may not be a valid identifier',
      reason: `${identifierWarning}. Try camel, snake, or kebab via Code cycle, or trim spaces first.`,
      actionLabel: 'Open Trim / Normalize Whitespace',
      path: '/text-utilities/trim-normalize-whitespace',
    };
  }

  const matchedId = detectedCaseToCaseId(detectedCase);
  if (
    matchedId &&
    matchedId !== selectedCase &&
    (detectedCase === 'camelCase' ||
      detectedCase === 'PascalCase' ||
      detectedCase === 'snake_case' ||
      detectedCase === 'UPPER_SNAKE' ||
      detectedCase === 'kebab-case')
  ) {
    return {
      id: 'tcc-detected-programming',
      title: `Input looks like ${detectedCase}`,
      reason: `You selected a different preset. Switch to ${matchedId} (or use Code cycle) if you want to transform from the detected programming style.`,
      actionLabel: 'Open Find and Replace',
      path: '/text-utilities/find-and-replace',
    };
  }

  if (hasOutput) {
    return {
      id: 'tcc-converted',
      title: 'Conversion ready',
      reason:
        'Copy, Share, or → In to keep editing. Star favorites and press 1–5 while the source editor is focused.',
      actionLabel: 'Open Slug Generator',
      path: '/text-utilities/slug-generator',
    };
  }

  return {
    id: 'tcc-ready',
    title: 'Ready to convert',
    reason:
      'Browse Standard, Programming, or Fun presets. Open Options for locale, Unicode normalize, and custom rules.',
    actionLabel: 'Open Trim / Normalize Whitespace',
    path: '/text-utilities/trim-normalize-whitespace',
  };
}
