import type { FtRelatedToolLink } from '../shared/ft-tool-suggestion.model';
import type { RandomNumberOptions } from '../types/random-number-generator.types';

export const RNG_DEFAULT_OPTIONS: RandomNumberOptions = {
  min: 1,
  max: 100,
  count: 1,
  integerOnly: true,
  decimals: 2
};

export const RNG_HISTORY_LIMIT = 100;
export const RNG_COUNT_MIN = 1;
export const RNG_COUNT_MAX = 1000;
export const RNG_DECIMALS_MIN = 0;
export const RNG_DECIMALS_MAX = 10;

export const RNG_ERROR_MIN_MAX = 'Minimum value must be less than maximum value.';
export const RNG_ERROR_COUNT = 'Count must be between 1 and 1000.';
export const RNG_ERROR_DECIMALS = 'Decimal places must be between 0 and 10.';
export const RNG_ERROR_COPY = 'Failed to copy to clipboard.';

/** Suggest security tools for larger batch generation. */
export const RNG_SECURITY_BATCH_THRESHOLD = 20;

export const RNG_RELATED_TOOLS: ReadonlyArray<FtRelatedToolLink> = [
  {
    label: 'Coin Toss & Dice Roller',
    path: '/fun-tools/coin-toss-dice-roller',
    description: 'Binary flips and common dice sides with history and stats'
  },
  {
    label: 'UUID Generator',
    path: '/security-tools/uuid-generator',
    description: 'Need unique identifiers instead of random integers?'
  },
  {
    label: 'Random Password Generator',
    path: '/security-tools/random-password-generator',
    description: 'Generate cryptographic secrets — not entertainment randomness'
  },
  {
    label: 'Barcode Generator',
    path: '/fun-tools/barcode-generator',
    description: 'Encode generated numbers as scannable barcodes'
  },
  {
    label: 'Character Counter',
    path: '/text-utilities/character-counter',
    description: 'Inspect pasted numeric lists for length and formatting'
  }
];
