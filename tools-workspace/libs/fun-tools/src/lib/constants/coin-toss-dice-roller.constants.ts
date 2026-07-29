import type { FtRelatedToolLink } from '../shared/ft-tool-suggestion.model';

export const CTDR_DICE_OPTIONS: ReadonlyArray<number> = [4, 6, 8, 10, 12, 20, 100];

export const CTDR_DEFAULT_DICE_SIDES = 6;
export const CTDR_DEFAULT_DICE_COUNT = 1;
export const CTDR_MIN_DICE_COUNT = 1;
export const CTDR_MAX_DICE_COUNT = 10;

export const CTDR_HISTORY_LIMIT = 50;
export const CTDR_HISTORY_PREVIEW_LIMIT = 10;

export const CTDR_COIN_FLIP_MS = 1000;
export const CTDR_DICE_ROLL_MS = 800;

/** Suggest random-number tool after enough samples for “fairness” curiosity. */
export const CTDR_STATS_SAMPLE_THRESHOLD = 20;

export const CTDR_RELATED_TOOLS: ReadonlyArray<FtRelatedToolLink> = [
  {
    label: 'Random Number Generator',
    path: '/fun-tools/random-number-generator',
    description: 'Pick numbers in a custom range without coin or dice metaphors'
  },
  {
    label: 'Random Password Generator',
    path: '/security-tools/random-password-generator',
    description: 'Need cryptographic randomness for secrets? Use a password generator'
  },
  {
    label: 'UUID Generator',
    path: '/security-tools/uuid-generator',
    description: 'Generate unique IDs when games need durable identifiers'
  },
  {
    label: 'Stopwatch & Timer',
    path: '/fun-tools/stopwatch-timer',
    description: 'Time turns or rounds alongside your flips and rolls'
  }
];
