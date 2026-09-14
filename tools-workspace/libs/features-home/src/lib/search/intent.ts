import { normalizeText, tokenize } from './normalize';
import {
  ACTION_SYNONYMS,
  FORMAT_TOKENS,
  OBJECT_SYNONYMS,
  resolveAction,
  resolveObject,
} from './synonyms';
import { DetectedIntent } from './types';

const GOAL_PATTERNS: Array<{ pattern: RegExp; action: string; goal: string }> = [
  {
    pattern: /\b(too\s+(large|big|huge)|file\s+size|email|upload|send)\b/,
    action: 'compress',
    goal: 'reduce_file_size',
  },
  {
    pattern: /\b(make|get).{0,24}(smaller|lighter|tinier)\b/,
    action: 'compress',
    goal: 'reduce_file_size',
  },
  {
    pattern: /\b(reduce|lower|decrease|shrink).{0,24}(size|filesize|file size)\b/,
    action: 'compress',
    goal: 'reduce_file_size',
  },
  {
    pattern: /\b(join|combine|put together|concatenate)\b/,
    action: 'merge',
    goal: 'combine_files',
  },
  {
    pattern: /\b(turn|convert|change|transform).{0,40}\bto\b/,
    action: 'convert',
    goal: 'change_format',
  },
  {
    pattern: /\b(remove|delete|erase|get rid of).{0,24}background\b/,
    action: 'remove',
    goal: 'remove_background',
  },
  {
    pattern: /\b(how many|count).{0,16}words?\b/,
    action: 'count',
    goal: 'count_words',
  },
  {
    pattern: /\b(pretty|readable|beautify|prettify|indent)\b/,
    action: 'format',
    goal: 'format_data',
  },
  {
    pattern: /\b(qr(\s*code)?|barcode)\b/,
    action: 'generate',
    goal: 'generate_code',
  },
];

const MULTI_INTENT_SPLIT = /\b(?:and|then|also|plus)\b/i;

export function detectIntent(rawQuery: string): DetectedIntent {
  const query = normalizeText(rawQuery);
  const contentTokens = tokenize(query);

  const actions = new Set<string>();
  const objects = new Set<string>();
  let inputFormat: string | null = null;
  let outputFormat: string | null = null;
  let goal: string | null = null;

  for (const rule of GOAL_PATTERNS) {
    if (rule.pattern.test(query)) {
      actions.add(rule.action);
      goal = rule.goal;
    }
  }

  for (const token of contentTokens) {
    const action = resolveAction(token);
    if (action) {
      actions.add(action);
    }
    const object = resolveObject(token);
    if (object) {
      objects.add(object);
    }
    if (FORMAT_TOKENS.has(token)) {
      if (!inputFormat) {
        inputFormat = token === 'jpeg' ? 'jpg' : token;
      } else if (!outputFormat && token !== inputFormat) {
        outputFormat = token === 'jpeg' ? 'jpg' : token;
      }
      const formatObject = resolveObject(token);
      if (formatObject) {
        objects.add(formatObject);
      }
    }
  }

  // Phrase-level action synonyms (multi-word)
  for (const [action, synonyms] of Object.entries(ACTION_SYNONYMS)) {
    for (const synonym of synonyms) {
      if (synonym.includes(' ') && query.includes(synonym)) {
        actions.add(action);
      }
    }
  }
  for (const [object, synonyms] of Object.entries(OBJECT_SYNONYMS)) {
    for (const synonym of synonyms) {
      if (synonym.includes(' ') && query.includes(synonym)) {
        objects.add(object);
      }
    }
  }

  // "X to Y" format conversion
  const toMatch = query.match(/\b([a-z0-9]{2,8})\s+to\s+([a-z0-9]{2,8})\b/);
  if (toMatch) {
    const left = toMatch[1];
    const right = toMatch[2];
    if (FORMAT_TOKENS.has(left) || FORMAT_TOKENS.has(right)) {
      actions.add('convert');
      inputFormat = FORMAT_TOKENS.has(left) ? left : inputFormat;
      outputFormat = FORMAT_TOKENS.has(right) ? right : outputFormat;
      const leftObj = resolveObject(left);
      const rightObj = resolveObject(right);
      if (leftObj) {
        objects.add(leftObj);
      }
      if (rightObj) {
        objects.add(rightObj);
      }
    }
  }

  const actionList = [...actions];
  const objectList = [...objects];
  const isAmbiguousAction =
    actionList.length === 1 &&
    objectList.length === 0 &&
    !inputFormat &&
    contentTokens.length <= 2 &&
    ['compress', 'convert', 'merge', 'split', 'edit', 'resize'].includes(actionList[0]);

  return {
    action: actionList[0] ?? null,
    object: objectList[0] ?? null,
    inputFormat,
    outputFormat,
    goal,
    isAmbiguousAction,
    isMultiIntent: MULTI_INTENT_SPLIT.test(rawQuery) && actionList.length > 1,
    actions: actionList,
    objects: objectList,
  };
}

export function intentExplanation(intent: DetectedIntent): string | undefined {
  if (intent.goal === 'reduce_file_size' && intent.object === 'image') {
    return 'Matches your request to reduce image file size.';
  }
  if (intent.goal === 'reduce_file_size' && intent.object === 'pdf') {
    return 'Matches your request to reduce PDF file size.';
  }
  if (intent.action === 'merge' && intent.object === 'pdf') {
    return 'Matches your request to combine PDF files.';
  }
  if (intent.action === 'convert' && intent.inputFormat && intent.outputFormat) {
    return `Matches converting ${intent.inputFormat.toUpperCase()} to ${intent.outputFormat.toUpperCase()}.`;
  }
  if (intent.action === 'generate' && intent.object === 'qr') {
    return 'Matches generating a QR code.';
  }
  if (intent.action === 'format' && intent.object === 'json') {
    return 'Matches making JSON easier to read.';
  }
  if (intent.action === 'count' && intent.object === 'text') {
    return 'Matches counting words in text.';
  }
  if (intent.action && intent.object) {
    return `Matches ${intent.action} + ${intent.object}.`;
  }
  return undefined;
}
