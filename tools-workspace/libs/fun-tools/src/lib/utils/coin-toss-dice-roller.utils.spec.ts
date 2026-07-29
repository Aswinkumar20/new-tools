import {
  clampDiceCount,
  computeCoinStats,
  computeDiceStats,
  createCoinResult,
  createDiceResults,
  flipCoinFace,
  formatLastResultText,
  prependHistory,
  resolveCoinTossDiceSuggestion,
  rollDie
} from './coin-toss-dice-roller.utils';

describe('coin-toss-dice-roller.utils', () => {
  describe('flipCoinFace / rollDie', () => {
    it('maps random thresholds to faces and die faces', () => {
      expect(flipCoinFace(() => 0.49)).toBe('heads');
      expect(flipCoinFace(() => 0.5)).toBe('tails');
      expect(rollDie(6, () => 0)).toBe(1);
      expect(rollDie(6, () => 0.999)).toBe(6);
    });
  });

  describe('history and stats', () => {
    it('prepends and caps history', () => {
      expect(prependHistory([3, 2], [1], 3)).toEqual([1, 3, 2]);
      expect(prependHistory([2, 1], [4, 3], 3)).toEqual([4, 3, 2]);
    });

    it('computes coin and dice stats', () => {
      const coin = computeCoinStats([
        { result: 'heads', timestamp: 1 },
        { result: 'tails', timestamp: 2 },
        { result: 'heads', timestamp: 3 }
      ]);
      expect(coin).toEqual({
        heads: 2,
        tails: 1,
        total: 3,
        headsPercent: 67,
        tailsPercent: 33
      });

      expect(computeDiceStats([])).toEqual({ total: 0, average: 0, min: 0, max: 0 });
      expect(
        computeDiceStats([
          { sides: 6, result: 2, timestamp: 1 },
          { sides: 6, result: 4, timestamp: 2 }
        ])
      ).toEqual({ total: 2, average: 3, min: 2, max: 4 });
    });
  });

  describe('create results', () => {
    it('creates coin and dice batches with injectable clocks', () => {
      expect(createCoinResult(() => 0.1, () => 42)).toEqual({ result: 'heads', timestamp: 42 });
      expect(createDiceResults(6, 2, () => 0, () => 99)).toEqual([
        { sides: 6, result: 1, timestamp: 99 },
        { sides: 6, result: 1, timestamp: 99 }
      ]);
    });
  });

  describe('clamp and format', () => {
    it('clamps dice count and formats last result text', () => {
      expect(clampDiceCount(0)).toBeNull();
      expect(clampDiceCount(11)).toBeNull();
      expect(clampDiceCount(3)).toBe(3);
      expect(
        formatLastResultText('coin', { result: 'tails', timestamp: 1 }, [])
      ).toBe('Tails');
      expect(
        formatLastResultText('dice', null, [
          { sides: 6, result: 3, timestamp: 1 },
          { sides: 6, result: 5, timestamp: 1 }
        ])
      ).toBe('3, 5');
    });
  });

  describe('resolveCoinTossDiceSuggestion', () => {
    it('suggests RNG when idle on coin tab', () => {
      expect(
        resolveCoinTossDiceSuggestion({
          tab: 'coin',
          coinTotal: 0,
          diceTotal: 0,
          numberOfDice: 1,
          diceSides: 6
        })?.id
      ).toBe('ctdr-rng-intro');
    });

    it('suggests RNG for multi-dice and d100', () => {
      expect(
        resolveCoinTossDiceSuggestion({
          tab: 'dice',
          coinTotal: 0,
          diceTotal: 0,
          numberOfDice: 5,
          diceSides: 6
        })?.id
      ).toBe('ctdr-rng-multi');
      expect(
        resolveCoinTossDiceSuggestion({
          tab: 'dice',
          coinTotal: 0,
          diceTotal: 0,
          numberOfDice: 1,
          diceSides: 100
        })?.id
      ).toBe('ctdr-rng-d100');
    });

    it('suggests security tools after enough samples', () => {
      expect(
        resolveCoinTossDiceSuggestion({
          tab: 'coin',
          coinTotal: 20,
          diceTotal: 0,
          numberOfDice: 1,
          diceSides: 6
        })?.id
      ).toBe('ctdr-security');
    });
  });
});
