import type { FtToolSuggestion } from '../shared/ft-tool-suggestion.model';
import {
  CTDR_HISTORY_LIMIT,
  CTDR_MAX_DICE_COUNT,
  CTDR_MIN_DICE_COUNT,
  CTDR_STATS_SAMPLE_THRESHOLD
} from '../constants/coin-toss-dice-roller.constants';
import type {
  CoinDiceTab,
  CoinFace,
  CoinResult,
  CoinStats,
  DiceResult,
  DiceStats
} from '../types/coin-toss-dice-roller.types';

export function flipCoinFace(random: (() => number) = Math.random): CoinFace {
  return random() < 0.5 ? 'heads' : 'tails';
}

export function createCoinResult(
  random: (() => number) = Math.random,
  now: (() => number) = Date.now
): CoinResult {
  return {
    result: flipCoinFace(random),
    timestamp: now()
  };
}

export function rollDie(sides: number, random: (() => number) = Math.random): number {
  return Math.floor(random() * sides) + 1;
}

export function createDiceResults(
  sides: number,
  count: number,
  random: (() => number) = Math.random,
  now: (() => number) = Date.now
): DiceResult[] {
  const timestamp = now();
  const results: DiceResult[] = [];
  for (let i = 0; i < count; i++) {
    results.push({ sides, result: rollDie(sides, random), timestamp });
  }
  return results;
}

export function prependHistory<T>(current: readonly T[], incoming: readonly T[], limit = CTDR_HISTORY_LIMIT): T[] {
  return [...incoming, ...current].slice(0, limit);
}

export function clampDiceCount(count: number): number | null {
  if (count < CTDR_MIN_DICE_COUNT || count > CTDR_MAX_DICE_COUNT) {
    return null;
  }
  return count;
}

export function computeCoinStats(results: readonly CoinResult[]): CoinStats {
  const heads = results.filter((r) => r.result === 'heads').length;
  const tails = results.filter((r) => r.result === 'tails').length;
  const total = results.length;
  return {
    heads,
    tails,
    total,
    headsPercent: total > 0 ? Math.round((heads / total) * 100) : 0,
    tailsPercent: total > 0 ? Math.round((tails / total) * 100) : 0
  };
}

export function computeDiceStats(results: readonly DiceResult[]): DiceStats {
  if (results.length === 0) {
    return { total: 0, average: 0, min: 0, max: 0 };
  }
  const values = results.map((r) => r.result);
  const sum = values.reduce((acc, val) => acc + val, 0);
  return {
    total: results.length,
    average: Math.round((sum / values.length) * 10) / 10,
    min: Math.min(...values),
    max: Math.max(...values)
  };
}

export function formatLastResultText(
  tab: CoinDiceTab,
  lastCoin: CoinResult | null,
  lastDice: readonly DiceResult[]
): string {
  if (tab === 'coin' && lastCoin) {
    return lastCoin.result === 'heads' ? 'Heads' : 'Tails';
  }
  if (lastDice.length > 0) {
    return lastDice.map((d) => d.result).join(', ');
  }
  return '';
}

export function formatResultTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString();
}

export function resolveCoinTossDiceSuggestion(options: {
  tab: CoinDiceTab;
  coinTotal: number;
  diceTotal: number;
  numberOfDice: number;
  diceSides: number;
}): FtToolSuggestion | null {
  const { tab, coinTotal, diceTotal, numberOfDice, diceSides } = options;

  if (tab === 'coin' && coinTotal === 0 && diceTotal === 0) {
    return {
      id: 'ctdr-rng-intro',
      title: 'Need a number in a custom range?',
      reason:
        'Coin flips are great for binary choices. Random Number Generator covers min/max ranges and bulk picks.',
      actionLabel: 'Open Random Number Generator',
      path: '/fun-tools/random-number-generator'
    };
  }

  if (tab === 'dice' && numberOfDice >= 5) {
    return {
      id: 'ctdr-rng-multi',
      title: 'Rolling many dice at once?',
      reason:
        'For large batches or custom ranges, Random Number Generator can emit lists without the dice UI.',
      actionLabel: 'Open Random Number Generator',
      path: '/fun-tools/random-number-generator'
    };
  }

  if (tab === 'dice' && diceSides >= 100) {
    return {
      id: 'ctdr-rng-d100',
      title: 'd100 and beyond?',
      reason:
        'Percentile and wide ranges are often easier in Random Number Generator with an explicit min and max.',
      actionLabel: 'Open Random Number Generator',
      path: '/fun-tools/random-number-generator'
    };
  }

  const samples = tab === 'coin' ? coinTotal : diceTotal;
  if (samples >= CTDR_STATS_SAMPLE_THRESHOLD) {
    return {
      id: 'ctdr-security',
      title: 'Using this for passwords or tokens?',
      reason:
        'Entertainment randomness is fine for games. For secrets, use Random Password Generator or UUID Generator.',
      actionLabel: 'Open Random Password Generator',
      path: '/security-tools/random-password-generator'
    };
  }

  if (tab === 'coin' && coinTotal > 0) {
    return {
      id: 'ctdr-dice-switch',
      title: 'Try dice for multi-outcome picks',
      reason:
        'Switch to the Dice tab for d4–d100 rolls, or use Random Number Generator for arbitrary ranges.',
      actionLabel: 'Open Random Number Generator',
      path: '/fun-tools/random-number-generator'
    };
  }

  if (tab === 'dice' && diceTotal > 0) {
    return {
      id: 'ctdr-timer',
      title: 'Timing turns or rounds?',
      reason:
        'Pair rolls with Stopwatch & Timer when house rules need a clock as well as a die.',
      actionLabel: 'Open Stopwatch & Timer',
      path: '/fun-tools/stopwatch-timer'
    };
  }

  return {
    id: 'ctdr-rng-discover',
    title: 'Explore more random tools',
    reason:
      'Random Number Generator sits beside this tool for ranges, lists, and non-game randomness.',
    actionLabel: 'Open Random Number Generator',
    path: '/fun-tools/random-number-generator'
  };
}
