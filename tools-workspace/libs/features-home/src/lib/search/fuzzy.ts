/** Bounded Levenshtein distance for fuzzy / typo-tolerant matching. */

export function levenshtein(a: string, b: string): number {
  if (a === b) {
    return 0;
  }
  if (!a.length) {
    return b.length;
  }
  if (!b.length) {
    return a.length;
  }
  if (Math.abs(a.length - b.length) > 3) {
    return Math.max(a.length, b.length);
  }

  const prev = new Array<number>(b.length + 1);
  const curr = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) {
    prev[j] = j;
  }

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j++) {
      prev[j] = curr[j];
    }
  }
  return prev[b.length];
}

/** Fuzzy token similarity in [0, 1]. */
export function fuzzyTokenScore(queryToken: string, candidateToken: string): number {
  if (!queryToken || !candidateToken) {
    return 0;
  }
  if (queryToken === candidateToken) {
    return 1;
  }
  if (candidateToken.includes(queryToken) || queryToken.includes(candidateToken)) {
    const shorter = Math.min(queryToken.length, candidateToken.length);
    const longer = Math.max(queryToken.length, candidateToken.length);
    return shorter / longer;
  }
  if (queryToken.length < 3 || candidateToken.length < 3) {
    return 0;
  }

  // Shared prefix helps with typos like "comprssor" → "compress"
  const prefixLen = sharedPrefixLength(queryToken, candidateToken);
  if (prefixLen >= 4 && Math.abs(queryToken.length - candidateToken.length) <= 3) {
    const prefixScore = prefixLen / Math.max(queryToken.length, candidateToken.length);
    if (prefixScore >= 0.55) {
      return Math.max(prefixScore, 0.78);
    }
  }

  const distance = levenshtein(queryToken, candidateToken);
  const maxLen = Math.max(queryToken.length, candidateToken.length);
  const similarity = 1 - distance / maxLen;
  const threshold = queryToken.length >= 6 ? 0.64 : 0.72;
  return similarity >= threshold ? similarity : 0;
}

function sharedPrefixLength(a: string, b: string): number {
  const limit = Math.min(a.length, b.length);
  let i = 0;
  while (i < limit && a[i] === b[i]) {
    i += 1;
  }
  return i;
}

export function bestFuzzyScore(queryTokens: string[], candidateTokens: string[]): number {
  if (!queryTokens.length || !candidateTokens.length) {
    return 0;
  }
  let total = 0;
  for (const q of queryTokens) {
    let best = 0;
    for (const c of candidateTokens) {
      best = Math.max(best, fuzzyTokenScore(q, c));
    }
    total += best;
  }
  return total / queryTokens.length;
}
