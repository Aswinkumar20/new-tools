export type UrlEncodeMode = 'component' | 'uri';
export type SortMode = 'az' | 'za' | 'length-asc' | 'length-desc' | 'numeric';
export type TrimOptions = {
  trimLines: boolean;
  collapseSpaces: boolean;
  removeEmptyLines: boolean;
  normalizeLineEndings: boolean;
};
export type FindReplaceOptions = {
  useRegex: boolean;
  caseSensitive: boolean;
  replaceAll: boolean;
};
export type RegexTestResult = {
  matches: RegExpMatchArray[];
  groups: string[][];
  error: string;
};
export type InvisibleCharHit = {
  index: number;
  char: string;
  codePoint: number;
  name: string;
};
export type ReadabilityResult = {
  words: number;
  sentences: number;
  syllables: number;
  fleschReadingEase: number;
  fleschKincaidGrade: number;
  avgWordsPerSentence: number;
  avgSyllablesPerWord: number;
  readingLevel: string;
};
export type KeywordEntry = {
  word: string;
  count: number;
  density: number;
};

const INVISIBLE_CHARS: Record<number, string> = {
  0x00: 'NULL',
  0x09: 'TAB',
  0x0a: 'LF',
  0x0d: 'CR',
  0xa0: 'NO-BREAK SPACE',
  0xad: 'SOFT HYPHEN',
  0x200b: 'ZERO WIDTH SPACE',
  0x200c: 'ZERO WIDTH NON-JOINER',
  0x200d: 'ZERO WIDTH JOINER',
  0x200e: 'LEFT-TO-RIGHT MARK',
  0x200f: 'RIGHT-TO-LEFT MARK',
  0x2028: 'LINE SEPARATOR',
  0x2029: 'PARAGRAPH SEPARATOR',
  0x202a: 'LEFT-TO-RIGHT EMBEDDING',
  0x202c: 'POP DIRECTIONAL FORMATTING',
  0x202d: 'LEFT-TO-RIGHT OVERRIDE',
  0x202e: 'RIGHT-TO-LEFT OVERRIDE',
  0x2060: 'WORD JOINER',
  0xfeff: 'BOM / ZERO WIDTH NO-BREAK SPACE',
};

const MORSE_MAP: Record<string, string> = {
  A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....',
  I: '..', J: '.---', K: '-.-', L: '.-..', M: '--', N: '-.', O: '---', P: '.--.',
  Q: '--.-', R: '.-.', S: '...', T: '-', U: '..-', V: '...-', W: '.--', X: '-..-',
  Y: '-.--', Z: '--..', '0': '-----', '1': '.----', '2': '..---', '3': '...--',
  '4': '....-', '5': '.....', '6': '-....', '7': '--...', '8': '---..', '9': '----.',
  '.': '.-.-.-', ',': '--..--', '?': '..--..', "'": '.----.', '!': '-.-.--', '/': '-..-.',
  '(': '-.--.', ')': '-.--.-', '&': '.-...', ':': '---...', ';': '-.-.-.', '=': '-...-',
  '+': '.-.-.', '-': '-....-', '_': '..--.-', '"': '.-..-.', '$': '...-..-', '@': '.--.-.',
  ' ': '/',
};
const MORSE_REVERSE = Object.fromEntries(Object.entries(MORSE_MAP).map(([k, v]) => [v, k]));

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
  'by', 'from', 'as', 'is', 'was', 'are', 'were', 'be', 'been', 'being', 'have', 'has',
  'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must',
  'it', 'its', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'we', 'they',
]);

export function urlEncode(text: string, mode: UrlEncodeMode, spaceAsPlus: boolean): string {
  const encoded = mode === 'component' ? encodeURIComponent(text) : encodeURI(text);
  return spaceAsPlus ? encoded.replace(/%20/g, '+') : encoded;
}

export function urlDecode(text: string, plusAsSpace: boolean): string {
  const normalized = plusAsSpace ? text.replace(/\+/g, '%20') : text;
  try {
    return decodeURIComponent(normalized);
  } catch {
    throw new Error('Invalid percent-encoding sequence.');
  }
}

export function unicodeEscape(text: string): string {
  return [...text]
    .map((ch) => {
      const cp = ch.codePointAt(0)!;
      if (cp > 0xffff) {
        return `\\u{${cp.toString(16).toUpperCase()}}`;
      }
      if (cp > 0x7f || ch === '\\') {
        return `\\u${cp.toString(16).toUpperCase().padStart(4, '0')}`;
      }
      return ch;
    })
    .join('');
}

export function unicodeUnescape(text: string): string {
  return text.replace(/\\u\{([0-9a-fA-F]+)\}|\\u([0-9a-fA-F]{4})/g, (_, braced, four) => {
    const hex = braced ?? four;
    return String.fromCodePoint(parseInt(hex, 16));
  });
}

export function stripHtmlTags(html: string, preserveLineBreaks: boolean): string {
  let result = html;
  if (preserveLineBreaks) {
    result = result.replace(/<br\s*\/?>/gi, '\n');
    result = result.replace(/<\/p>/gi, '\n');
    result = result.replace(/<\/div>/gi, '\n');
    result = result.replace(/<\/li>/gi, '\n');
  }
  result = result.replace(/<script[\s\S]*?<\/script>/gi, '');
  result = result.replace(/<style[\s\S]*?<\/style>/gi, '');
  result = result.replace(/<[^>]+>/g, '');
  result = decodeHtmlEntities(result);
  if (preserveLineBreaks) {
    result = result.replace(/\n{3,}/g, '\n\n');
  }
  return result.trim();
}

function decodeHtmlEntities(text: string): string {
  const textarea = typeof document !== 'undefined' ? document.createElement('textarea') : null;
  if (textarea) {
    textarea.innerHTML = text;
    return textarea.value;
  }
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

export function sortLines(text: string, mode: SortMode, caseSensitive: boolean): string {
  const lines = text.split('\n');
  const compare = (a: string, b: string): number => {
    const left = caseSensitive ? a : a.toLowerCase();
    const right = caseSensitive ? b : b.toLowerCase();
    switch (mode) {
      case 'az':
        return left.localeCompare(right);
      case 'za':
        return right.localeCompare(left);
      case 'length-asc':
        return a.length - b.length || left.localeCompare(right);
      case 'length-desc':
        return b.length - a.length || left.localeCompare(right);
      case 'numeric': {
        const na = parseFloat(a.trim());
        const nb = parseFloat(b.trim());
        if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
        return left.localeCompare(right);
      }
      default:
        return 0;
    }
  };
  return [...lines].sort(compare).join('\n');
}

export function trimNormalize(text: string, options: TrimOptions): string {
  let result = text;
  if (options.normalizeLineEndings) {
    result = result.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  }
  const lines = result.split('\n');
  let processed = lines.map((line) => {
    let l = line;
    if (options.trimLines) l = l.trim();
    if (options.collapseSpaces) l = l.replace(/\s+/g, ' ');
    return l;
  });
  if (options.removeEmptyLines) {
    processed = processed.filter((line) => line.length > 0);
  }
  return processed.join('\n');
}

export function findReplace(
  text: string,
  find: string,
  replace: string,
  options: FindReplaceOptions,
): string {
  if (!find) return text;
  const flags = `${options.replaceAll ? 'g' : ''}${options.caseSensitive ? '' : 'i'}`;
  if (options.useRegex) {
    try {
      const regex = new RegExp(find, flags);
      return text.replace(regex, replace);
    } catch (e) {
      throw new Error(`Invalid regex: ${(e as Error).message}`);
    }
  }
  if (options.replaceAll) {
    if (options.caseSensitive) {
      return text.split(find).join(replace);
    }
    const regex = new RegExp(escapeRegex(find), 'gi');
    return text.replace(regex, replace);
  }
  const index = options.caseSensitive
    ? text.indexOf(find)
    : text.toLowerCase().indexOf(find.toLowerCase());
  if (index === -1) return text;
  return text.slice(0, index) + replace + text.slice(index + find.length);
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function addLineNumbers(text: string, start: number, separator: string): string {
  const lines = text.split('\n');
  return lines
    .map((line, i) => `${start + i}${separator}${line}`)
    .join('\n');
}

export function removeLineNumbers(text: string): string {
  return text
    .split('\n')
    .map((line) => line.replace(/^\s*\d+[\s.:)\-–—|]+\s*/, ''))
    .join('\n');
}

export function splitText(text: string, delimiter: string): string {
  if (!delimiter) return text;
  return text.split(delimiter).join('\n');
}

export function joinText(text: string, delimiter: string): string {
  return text.split('\n').join(delimiter);
}

export function testRegex(text: string, pattern: string, flags: string): RegexTestResult {
  try {
    const regex = new RegExp(pattern, flags);
    const matches: RegExpMatchArray[] = [];
    const groups: string[][] = [];
    if (flags.includes('g')) {
      let match: RegExpExecArray | null;
      while ((match = regex.exec(text)) !== null) {
        matches.push(match);
        groups.push(match.slice(1));
        if (match[0].length === 0) regex.lastIndex++;
      }
    } else {
      const match = text.match(regex);
      if (match) {
        matches.push(match);
        groups.push(match.slice(1));
      }
    }
    return { matches, groups, error: '' };
  } catch (e) {
    return { matches: [], groups: [], error: (e as Error).message };
  }
}

export function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      const cost = a[j - 1] === b[i - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }
  return matrix[b.length][a.length];
}

export function similarityPercent(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 100;
  const dist = levenshteinDistance(a, b);
  return Math.round((1 - dist / maxLen) * 10000) / 100;
}

export function detectInvisibleChars(text: string): InvisibleCharHit[] {
  const hits: InvisibleCharHit[] = [];
  for (let i = 0; i < text.length; i++) {
    const cp = text.codePointAt(i)!;
    const name = INVISIBLE_CHARS[cp];
    const isInvisible =
      name !== undefined ||
      (cp < 0x20 && cp !== 0x09 && cp !== 0x0a && cp !== 0x0d) ||
      cp === 0x7f ||
      (cp >= 0x200b && cp <= 0x200f) ||
      (cp >= 0x202a && cp <= 0x202e) ||
      cp === 0x2060 ||
      cp === 0xfeff;
    if (isInvisible) {
      hits.push({
        index: i,
        char: String.fromCodePoint(cp),
        codePoint: cp,
        name: name ?? `U+${cp.toString(16).toUpperCase().padStart(4, '0')}`,
      });
      if (cp > 0xffff) i++;
    }
  }
  return hits;
}

export function annotateInvisibleChars(text: string, hits: InvisibleCharHit[]): string {
  if (!hits.length) return text;
  let result = '';
  let hitIdx = 0;
  for (let i = 0; i < text.length; i++) {
    const hit = hits[hitIdx];
    if (hit && hit.index === i) {
      result += `[${hit.name}]`;
      hitIdx++;
      if (hit.codePoint > 0xffff) i++;
    } else {
      result += text[i];
    }
  }
  return result;
}

export function wordWrap(text: string, width: number): string {
  const colWidth = Math.max(1, Math.min(500, Math.round(width) || 80));
  const lines = text.split('\n');
  return lines
    .map((line) => {
      if (line.length <= colWidth) return line;
      const words = line.split(/\s+/);
      const wrapped: string[] = [];
      let current = '';
      for (const word of words) {
        if (!current) {
          current = word;
        } else if ((current + ' ' + word).length <= colWidth) {
          current += ' ' + word;
        } else {
          wrapped.push(current);
          current = word;
        }
      }
      if (current) wrapped.push(current);
      return wrapped.join('\n');
    })
    .join('\n');
}

export function wordUnwrap(text: string): string {
  return text.replace(/(?<!\n)\n(?!\n)/g, ' ');
}

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const URL_RE = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi;

export function extractEmails(text: string): string[] {
  return [...new Set(text.match(EMAIL_RE) ?? [])];
}

export function extractUrls(text: string): string[] {
  return [...new Set(text.match(URL_RE) ?? [])];
}

export function jsonEscape(text: string): string {
  return JSON.stringify(text).slice(1, -1);
}

export function jsonUnescape(text: string): string {
  let result = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '\\' && i + 1 < text.length) {
      const next = text[++i];
      switch (next) {
        case 'n':
          result += '\n';
          break;
        case 'r':
          result += '\r';
          break;
        case 't':
          result += '\t';
          break;
        case 'b':
          result += '\b';
          break;
        case 'f':
          result += '\f';
          break;
        case '"':
          result += '"';
          break;
        case '\\':
          result += '\\';
          break;
        case '/':
          result += '/';
          break;
        case 'u': {
          const hex = text.slice(i + 1, i + 5);
          if (!/^[0-9a-fA-F]{4}$/.test(hex)) {
            throw new Error('Invalid JSON escape sequence.');
          }
          result += String.fromCharCode(parseInt(hex, 16));
          i += 4;
          break;
        }
        default:
          throw new Error('Invalid JSON escape sequence.');
      }
    } else if (ch === '"') {
      throw new Error('Invalid JSON escape sequence.');
    } else {
      result += ch;
    }
  }
  return result;
}

export function hexEncode(text: string, separator: string): string {
  const bytes = new TextEncoder().encode(text);
  return [...bytes]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join(separator);
}

export function hexDecode(hex: string): string {
  const cleaned = hex.replace(/[^0-9a-fA-F]/g, '');
  if (cleaned.length % 2 !== 0) throw new Error('Invalid hex string length.');
  const bytes = new Uint8Array(cleaned.length / 2);
  for (let i = 0; i < cleaned.length; i += 2) {
    bytes[i / 2] = parseInt(cleaned.slice(i, i + 2), 16);
  }
  return new TextDecoder().decode(bytes);
}

export function rot13(text: string): string {
  return caesarCipher(text, 13);
}

export function caesarCipher(text: string, shift: number): string {
  const normalizedShift = ((shift % 26) + 26) % 26;
  return [...text]
    .map((ch) => {
      const code = ch.charCodeAt(0);
      if (code >= 65 && code <= 90) {
        return String.fromCharCode(((code - 65 + normalizedShift) % 26) + 65);
      }
      if (code >= 97 && code <= 122) {
        return String.fromCharCode(((code - 97 + normalizedShift) % 26) + 97);
      }
      return ch;
    })
    .join('');
}

export function textToBinary(text: string, separator: string, bits: 8 | 16): string {
  return [...text]
    .map((ch) => {
      const code = bits === 8 ? ch.charCodeAt(0) : ch.codePointAt(0)!;
      return code.toString(2).padStart(bits, '0');
    })
    .join(separator);
}

export function binaryToText(binary: string, bits: 8 | 16): string {
  const cleaned = binary.replace(/[^01]/g, '');
  if (cleaned.length % bits !== 0) throw new Error(`Binary length must be a multiple of ${bits}.`);
  const chars: string[] = [];
  for (let i = 0; i < cleaned.length; i += bits) {
    const byte = parseInt(cleaned.slice(i, i + bits), 2);
    chars.push(String.fromCodePoint(byte));
  }
  return chars.join('');
}

export function textToMorse(text: string): string {
  return text
    .toUpperCase()
    .split('')
    .map((ch) => MORSE_MAP[ch] ?? (ch === ' ' ? '/' : ''))
    .filter(Boolean)
    .join(' ');
}

export function morseToText(morse: string): string {
  return morse
    .trim()
    .split(/\s+/)
    .map((token) => {
      if (token === '/') return ' ';
      return MORSE_REVERSE[token] ?? '';
    })
    .join('');
}

function countSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return 0;
  if (w.length <= 3) return 1;
  const vowels = w.match(/[aeiouy]+/g);
  let count = vowels ? vowels.length : 1;
  if (w.endsWith('e') && !w.endsWith('le')) count--;
  if (w.endsWith('le') && w.length > 2) count++;
  return Math.max(1, count);
}

export function analyzeReadability(text: string): ReadabilityResult {
  const words = text.match(/\b[\w']+\b/g) ?? [];
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const wordCount = words.length;
  const sentenceCount = Math.max(sentences.length, 1);
  const syllables = words.reduce((sum, w) => sum + countSyllables(w), 0);
  const avgWordsPerSentence = wordCount / sentenceCount;
  const avgSyllablesPerWord = wordCount > 0 ? syllables / wordCount : 0;
  const fleschReadingEase =
    wordCount === 0
      ? 0
      : 206.835 - 1.015 * avgWordsPerSentence - 84.6 * avgSyllablesPerWord;
  const fleschKincaidGrade =
    wordCount === 0
      ? 0
      : 0.39 * avgWordsPerSentence + 11.8 * avgSyllablesPerWord - 15.59;
  let readingLevel = 'N/A';
  if (wordCount > 0) {
    if (fleschReadingEase >= 90) readingLevel = 'Very Easy (5th grade)';
    else if (fleschReadingEase >= 80) readingLevel = 'Easy (6th grade)';
    else if (fleschReadingEase >= 70) readingLevel = 'Fairly Easy (7th grade)';
    else if (fleschReadingEase >= 60) readingLevel = 'Standard (8th–9th grade)';
    else if (fleschReadingEase >= 50) readingLevel = 'Fairly Difficult (10th–12th grade)';
    else if (fleschReadingEase >= 30) readingLevel = 'Difficult (College)';
    else readingLevel = 'Very Difficult (College graduate)';
  }
  return {
    words: wordCount,
    sentences: sentenceCount,
    syllables,
    fleschReadingEase: Math.round(fleschReadingEase * 10) / 10,
    fleschKincaidGrade: Math.round(fleschKincaidGrade * 10) / 10,
    avgWordsPerSentence: Math.round(avgWordsPerSentence * 10) / 10,
    avgSyllablesPerWord: Math.round(avgSyllablesPerWord * 100) / 100,
    readingLevel,
  };
}

export function keywordDensity(text: string, topN: number, excludeStopWords: boolean): KeywordEntry[] {
  const words = text.toLowerCase().match(/\b[a-z][a-z0-9'-]{1,}\b/gi) ?? [];
  const filtered = excludeStopWords ? words.filter((w) => !STOP_WORDS.has(w.toLowerCase())) : words;
  const total = filtered.length || 1;
  const counts = new Map<string, number>();
  for (const word of filtered) {
    const key = word.toLowerCase();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([word, count]) => ({
      word,
      count,
      density: Math.round((count / total) * 10000) / 100,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, topN);
}
