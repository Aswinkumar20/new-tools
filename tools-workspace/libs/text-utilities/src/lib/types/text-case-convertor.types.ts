export type CaseId =
  | 'upper'
  | 'lower'
  | 'title'
  | 'sentence'
  | 'toggle'
  | 'apTitle'
  | 'chicagoTitle'
  | 'camel'
  | 'pascal'
  | 'snake'
  | 'upperSnake'
  | 'kebab'
  | 'train'
  | 'dot'
  | 'path'
  | 'constant'
  | 'macro'
  | 'camelSnake'
  | 'pascalSnake'
  | 'dotPascal'
  | 'flat'
  | 'slug'
  | 'sql'
  | 'hungarian'
  | 'hashtag'
  | 'alternating'
  | 'studly'
  | 'mocking'
  | 'randomCase'
  | 'reversed'
  | 'vowelUpper'
  | 'consonantUpper'
  | 'leet'
  | 'fullwidth'
  | 'smallCaps'
  | 'upsideDown'
  | 'mixed'
  | 'bracketed'
  | 'bubble'
  | 'zalgo'
  | 'wingdings'
  | 'emojiSpaced'
  | 'pigLatin'
  | 'morse'
  | 'nato'
  | 'binary'
  | 'hex';

export type UnicodeForm = 'none' | 'NFC' | 'NFD' | 'NFKC' | 'NFKD';
export type EscapeMode = 'none' | 'json' | 'js' | 'python';
export type CasePresetCategory = 'standard' | 'programming' | 'fun';

export interface CustomRule {
  pattern: string;
  replacement: 'upper' | 'lower' | 'title' | 'camel' | 'snake' | 'kebab';
}

export interface ConvertOptions {
  locale?: string;
  smallWords?: Set<string>;
  titleExceptions?: string[];
  randomSeed?: number;
  unicodeForm?: UnicodeForm;
  customRules?: CustomRule[];
  escapeMode?: EscapeMode;
}

export interface CasePreset {
  id: CaseId;
  label: string;
  category: CasePresetCategory;
  shortcut?: number;
}

export type DetectedCase =
  | 'camelCase'
  | 'PascalCase'
  | 'snake_case'
  | 'UPPER_SNAKE'
  | 'kebab-case'
  | 'flatcase'
  | 'UPPERCASE'
  | 'lowercase'
  | 'Title Case'
  | 'Sentence case'
  | 'mixed'
  | 'unknown';

export interface TextCaseSuggestionContext {
  hasInput: boolean;
  hasOutput: boolean;
  selectedCase: CaseId;
  detectedCase: DetectedCase;
  identifierWarning: string;
  zalgoLengthWarning: string;
  inputLength: number;
}
