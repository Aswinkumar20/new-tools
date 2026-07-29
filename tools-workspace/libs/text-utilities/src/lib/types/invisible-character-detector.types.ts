import type { InvisibleCharHit } from '../shared/text-transform.utils';

export type { InvisibleCharHit };

export interface InvisibleCharacterDetectionResult {
  hits: InvisibleCharHit[];
  output: string;
}

export interface InvisibleHitSummary {
  hitCount: number;
  hasZeroWidth: boolean;
  hasBom: boolean;
  hasNbspOrSoftHyphen: boolean;
}

export interface InvisibleCharacterSuggestionContext {
  hasInput: boolean;
  hitCount: number;
  hasZeroWidth: boolean;
  hasBom: boolean;
  hasNbspOrSoftHyphen: boolean;
}
