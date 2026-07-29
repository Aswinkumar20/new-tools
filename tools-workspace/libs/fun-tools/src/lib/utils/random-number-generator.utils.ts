import type { FtToolSuggestion } from '../shared/ft-tool-suggestion.model';
import {
  RNG_COUNT_MAX,
  RNG_COUNT_MIN,
  RNG_DECIMALS_MAX,
  RNG_DECIMALS_MIN,
  RNG_ERROR_COUNT,
  RNG_ERROR_DECIMALS,
  RNG_ERROR_MIN_MAX,
  RNG_HISTORY_LIMIT,
  RNG_SECURITY_BATCH_THRESHOLD
} from '../constants/random-number-generator.constants';
import type {
  GeneratedNumber,
  RandomNumberOptions,
  RandomNumberStats
} from '../types/random-number-generator.types';

export function validateRandomNumberOptions(options: RandomNumberOptions): string | null {
  const { min, max, count, integerOnly, decimals } = options;
  if (min >= max) {
    return RNG_ERROR_MIN_MAX;
  }
  if (count < RNG_COUNT_MIN || count > RNG_COUNT_MAX) {
    return RNG_ERROR_COUNT;
  }
  if (!integerOnly && (decimals < RNG_DECIMALS_MIN || decimals > RNG_DECIMALS_MAX)) {
    return RNG_ERROR_DECIMALS;
  }
  return null;
}

export function generateRandomInteger(
  min: number,
  max: number,
  random: (() => number) = Math.random
): number {
  return Math.floor(random() * (max - min + 1)) + min;
}

export function generateRandomDecimal(
  min: number,
  max: number,
  decimals: number,
  random: (() => number) = Math.random
): number {
  const value = random() * (max - min) + min;
  const multiplier = Math.pow(10, decimals);
  return Math.round(value * multiplier) / multiplier;
}

export function generateRandomNumbers(
  options: RandomNumberOptions,
  random: (() => number) = Math.random,
  now: (() => number) = Date.now
): GeneratedNumber[] {
  const { min, max, count, integerOnly, decimals } = options;
  const numbers: GeneratedNumber[] = [];
  const timestamp = now();
  for (let i = 0; i < count; i++) {
    const value = integerOnly
      ? generateRandomInteger(min, max, random)
      : generateRandomDecimal(min, max, decimals, random);
    numbers.push({ value, timestamp: timestamp + i });
  }
  return numbers;
}

export function prependGeneratedHistory(
  current: readonly GeneratedNumber[],
  incoming: readonly GeneratedNumber[],
  limit = RNG_HISTORY_LIMIT
): GeneratedNumber[] {
  return [...incoming, ...current].slice(0, limit);
}

export function computeRandomNumberStats(numbers: readonly GeneratedNumber[]): RandomNumberStats {
  if (numbers.length === 0) {
    return { count: 0, min: 0, max: 0, average: 0, sum: 0 };
  }
  const values = numbers.map((n) => n.value);
  const sum = values.reduce((acc, val) => acc + val, 0);
  return {
    count: numbers.length,
    min: Math.min(...values),
    max: Math.max(...values),
    average: sum / values.length,
    sum
  };
}

export function formatRandomNumber(
  value: number,
  integerOnly: boolean,
  decimals: number
): string {
  return integerOnly ? value.toString() : value.toFixed(decimals);
}

export function formatResultsText(
  numbers: readonly GeneratedNumber[],
  integerOnly: boolean,
  decimals: number
): string {
  return numbers.map((n) => formatRandomNumber(n.value, integerOnly, decimals)).join(', ');
}

export function looksLikeDiceRange(min: number, max: number, integerOnly: boolean): boolean {
  if (!integerOnly) {
    return false;
  }
  // Common polyhedral dice — exclude 100 so the default 1–100 range stays on this tool.
  const diceSides = [4, 6, 8, 10, 12, 20];
  return min === 1 && diceSides.includes(max);
}

export function resolveRandomNumberSuggestion(options: {
  hasResults: boolean;
  hasError: boolean;
  min: number;
  max: number;
  count: number;
  integerOnly: boolean;
}): FtToolSuggestion | null {
  const { hasResults, hasError, min, max, count, integerOnly } = options;

  if (hasError) {
    return {
      id: 'rng-fix',
      title: 'Check your range settings',
      reason:
        'Min must be less than max, count 1–1000, and decimals 0–10 when not using integers. Adjust Options and generate again.',
      actionLabel: 'Open Coin Toss & Dice Roller',
      path: '/fun-tools/coin-toss-dice-roller'
    };
  }

  if (!hasResults) {
    if (looksLikeDiceRange(min, max, integerOnly)) {
      return {
        id: 'rng-dice',
        title: 'Looks like a dice roll?',
        reason: `A 1–${max} integer range matches common dice. Coin Toss & Dice Roller adds visuals and roll history.`,
        actionLabel: 'Open Coin Toss & Dice Roller',
        path: '/fun-tools/coin-toss-dice-roller'
      };
    }
    return {
      id: 'rng-intro',
      title: 'Need game-style randomness?',
      reason:
        'This tool is great for ranges and batches. For flips and dice faces, try Coin Toss & Dice Roller.',
      actionLabel: 'Open Coin Toss & Dice Roller',
      path: '/fun-tools/coin-toss-dice-roller'
    };
  }

  if (count >= RNG_SECURITY_BATCH_THRESHOLD) {
    return {
      id: 'rng-security',
      title: 'Generating secrets or IDs?',
      reason:
        'Math.random is fine for games and mock data. For passwords or unique IDs, use Random Password Generator or UUID Generator.',
      actionLabel: 'Open UUID Generator',
      path: '/security-tools/uuid-generator'
    };
  }

  if (looksLikeDiceRange(min, max, integerOnly) && count === 1) {
    return {
      id: 'rng-dice-ready',
      title: 'Prefer a dice UI?',
      reason:
        'Same 1–N integer pick with animated dice and history lives in Coin Toss & Dice Roller.',
      actionLabel: 'Open Coin Toss & Dice Roller',
      path: '/fun-tools/coin-toss-dice-roller'
    };
  }

  return {
    id: 'rng-barcode',
    title: 'Encode a number as a barcode?',
    reason:
      'Copy a generated value into Barcode Generator for labels, tickets, or inventory tags.',
    actionLabel: 'Open Barcode Generator',
    path: '/fun-tools/barcode-generator'
  };
}
