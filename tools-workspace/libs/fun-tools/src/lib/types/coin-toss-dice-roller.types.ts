export type CoinFace = 'heads' | 'tails';

export type CoinDiceTab = 'coin' | 'dice';

export interface CoinResult {
  result: CoinFace;
  timestamp: number;
}

export interface DiceResult {
  sides: number;
  result: number;
  timestamp: number;
}

export interface CoinStats {
  heads: number;
  tails: number;
  total: number;
  headsPercent: number;
  tailsPercent: number;
}

export interface DiceStats {
  total: number;
  average: number;
  min: number;
  max: number;
}
