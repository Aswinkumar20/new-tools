export interface TypingTestResult {
  wpm: number;
  accuracy: number;
  time: number;
  characters: number;
  correct: number;
  incorrect: number;
  timestamp: number;
}

export interface TypingLiveStats {
  wpm: number;
  accuracy: number;
  characters: number;
  correct: number;
  incorrect: number;
}

export type TypingCharState = 'pending' | 'current' | 'correct' | 'incorrect';
