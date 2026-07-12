export const AP_SMALL_WORDS = new Set([
  'a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'in', 'nor', 'of', 'on', 'or', 'per', 'the', 'to', 'vs', 'via',
]);

export const CHICAGO_SMALL_WORDS = new Set([
  'a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'in', 'nor', 'of', 'on', 'or', 'so', 'the', 'to', 'up', 'yet',
]);

export const DEFAULT_TITLE_EXCEPTIONS = [
  'iPhone', 'iPad', 'JavaScript', 'TypeScript', 'GitHub', 'macOS', 'iOS', 'API', 'URL', 'HTML', 'CSS', 'JSON',
];

export const SQL_KEYWORDS = new Set([
  'SELECT', 'FROM', 'WHERE', 'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE', 'JOIN', 'LEFT', 'RIGHT',
  'INNER', 'OUTER', 'ON', 'AND', 'OR', 'NOT', 'NULL', 'IS', 'IN', 'AS', 'ORDER', 'BY', 'GROUP', 'HAVING',
  'LIMIT', 'OFFSET', 'CREATE', 'TABLE', 'ALTER', 'DROP', 'INDEX', 'VIEW', 'PRIMARY', 'KEY', 'FOREIGN',
  'REFERENCES', 'UNIQUE', 'DEFAULT', 'CHECK', 'CONSTRAINT', 'DISTINCT', 'UNION', 'ALL', 'CASE', 'WHEN',
  'THEN', 'ELSE', 'END', 'EXISTS', 'BETWEEN', 'LIKE', 'ASC', 'DESC', 'WITH', 'RETURNING', 'TRUE', 'FALSE',
]);

export const NATO_ALPHABET: Record<string, string> = {
  a: 'Alpha', b: 'Bravo', c: 'Charlie', d: 'Delta', e: 'Echo', f: 'Foxtrot', g: 'Golf', h: 'Hotel',
  i: 'India', j: 'Juliet', k: 'Kilo', l: 'Lima', m: 'Mike', n: 'November', o: 'Oscar', p: 'Papa',
  q: 'Quebec', r: 'Romeo', s: 'Sierra', t: 'Tango', u: 'Uniform', v: 'Victor', w: 'Whiskey', x: 'X-ray',
  y: 'Yankee', z: 'Zulu', '0': 'Zero', '1': 'One', '2': 'Two', '3': 'Three', '4': 'Four',
  '5': 'Five', '6': 'Six', '7': 'Seven', '8': 'Eight', '9': 'Niner',
};

export const MORSE_CODE: Record<string, string> = {
  a: '.-', b: '-...', c: '-.-.', d: '-..', e: '.', f: '..-.', g: '--.', h: '....', i: '..', j: '.---',
  k: '-.-', l: '.-..', m: '--', n: '-.', o: '---', p: '.--.', q: '--.-', r: '.-.', s: '...', t: '-',
  u: '..-', v: '...-', w: '.--', x: '-..-', y: '-.--', z: '--..', '0': '-----', '1': '.----', '2': '..---',
  '3': '...--', '4': '....-', '5': '.....', '6': '-....', '7': '--...', '8': '---..', '9': '----.',
  '.': '.-.-.-', ',': '--..--', '?': '..--..', "'": '.----.', '!': '-.-.--', '/': '-..-.', '(': '-.--.',
  ')': '-.--.-', '&': '.-...', ':': '---...', ';': '-.-.-.', '=': '-...-', '+': '.-.-.', '-': '-....-',
  '_': '..--.-', '"': '.-..-.', '$': '...-..-', '@': '.--.-.', ' ': '/',
};

export const BUBBLE_MAP: Record<string, string> = {
  a: 'ⓐ', b: 'ⓑ', c: 'ⓒ', d: 'ⓓ', e: 'ⓔ', f: 'ⓕ', g: 'ⓖ', h: 'ⓗ', i: 'ⓘ', j: 'ⓙ', k: 'ⓚ', l: 'ⓛ',
  m: 'ⓜ', n: 'ⓝ', o: 'ⓞ', p: 'ⓟ', q: 'ⓠ', r: 'ⓡ', s: 'ⓢ', t: 'ⓣ', u: 'ⓤ', v: 'ⓥ', w: 'ⓦ', x: 'ⓧ', y: 'ⓨ', z: 'ⓩ',
  '0': '⓪', '1': '①', '2': '②', '3': '③', '4': '④', '5': '⑤', '6': '⑥', '7': '⑦', '8': '⑧', '9': '⑨',
};

export const WINGDINGS_MAP: Record<string, string> = {
  a: '♋', b: '♌', c: '♍', d: '♎', e: '♏', f: '♐', g: '♑', h: '♒', i: '♓', j: '♔', k: '♕', l: '♖',
  m: '♗', n: '♘', o: '♙', p: '♚', q: '♛', r: '♜', s: '♝', t: '♞', u: '♟', v: '♠', w: '♡', x: '♢', y: '♣', z: '♤',
};

export const ZALGO_MARKS = ['\u0300', '\u0301', '\u0302', '\u0303', '\u0304', '\u0306', '\u0307', '\u0308', '\u0310'];

export const PROGRAMMING_CYCLE: readonly string[] = ['camel', 'snake', 'kebab', 'pascal'];

export const DEFAULT_FAVORITES = ['camel', 'snake', 'kebab', 'upper', 'lower'] as const;
