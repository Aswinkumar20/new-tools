import { bestFuzzyScore, fuzzyTokenScore } from './fuzzy';
import { DetectedIntent, SearchMatchType, SearchRankingWeights, ToolSearchDocument } from './types';
import { ACTION_SYNONYMS, expandQueryTokens, resolveAction } from './synonyms';
import { tokenize } from './normalize';

export interface ScoreBreakdown {
  semantic: number;
  keyword: number;
  intent: number;
  action: number;
  object: number;
  format: number;
  fuzzy: number;
  quality: number;
  total: number;
  matchType: SearchMatchType;
}

function overlapRatio(queryTokens: string[], haystackTokens: Set<string>): number {
  if (!queryTokens.length) {
    return 0;
  }
  let hits = 0;
  for (const token of queryTokens) {
    if (haystackTokens.has(token)) {
      hits += 1;
    }
  }
  return hits / queryTokens.length;
}

function phraseBonus(query: string, phrases: string[]): number {
  if (!query || !phrases.length) {
    return 0;
  }
  let best = 0;
  for (const phrase of phrases) {
    if (!phrase) {
      continue;
    }
    if (query.includes(phrase) || phrase.includes(query)) {
      best = Math.max(best, phrase.length >= query.length ? 1 : phrase.length / Math.max(query.length, 1));
    }
  }
  return best;
}

/** Resolve mistyped action tokens (e.g. comprssor → compress). */
function fuzzyResolveActions(queryTokens: string[]): string[] {
  const actions = new Set<string>();
  const actionVocabulary = Object.entries(ACTION_SYNONYMS).flatMap(([action, synonyms]) => [
    action,
    ...synonyms.filter((item) => !item.includes(' ')),
  ]);

  for (const token of queryTokens) {
    const exact = resolveAction(token);
    if (exact) {
      actions.add(exact);
      continue;
    }
    let bestAction: string | null = null;
    let bestScore = 0;
    for (const candidate of actionVocabulary) {
      const score = fuzzyTokenScore(token, candidate);
      if (score > bestScore) {
        bestScore = score;
        bestAction = resolveAction(candidate) ?? candidate;
      }
    }
    if (bestAction && bestScore >= 0.72) {
      actions.add(bestAction);
    }
  }
  return [...actions];
}

function scoreIntent(doc: ToolSearchDocument, intent: DetectedIntent, fuzzyActions: string[]): number {
  const actions = intent.actions.length ? intent.actions : fuzzyActions;
  if (!actions.length && !intent.object && !intent.inputFormat) {
    return 0;
  }
  let score = 0;
  let checks = 0;

  if (actions.length) {
    checks += 1;
    const actionHit = actions.some((action) => doc.actions.includes(action));
    score += actionHit ? 1 : 0;
  }
  if (intent.objects.length) {
    checks += 1;
    const objectHit = intent.objects.some((object) => doc.objects.includes(object));
    score += objectHit ? 1 : -0.35;
  }
  if (intent.inputFormat) {
    checks += 1;
    score += doc.inputFormats.includes(intent.inputFormat) ? 1 : 0;
  }
  if (intent.outputFormat) {
    checks += 1;
    score += doc.outputFormats.includes(intent.outputFormat) ? 1 : 0;
  }

  if (!checks) {
    return 0;
  }
  return Math.max(0, Math.min(1, score / checks));
}

export function scoreDocument(
  doc: ToolSearchDocument,
  rawNormalizedQuery: string,
  queryTokens: string[],
  intent: DetectedIntent,
  weights: SearchRankingWeights
): ScoreBreakdown {
  const fuzzyActions = fuzzyResolveActions(queryTokens);
  const expandedTokens = expandQueryTokens([...queryTokens, ...fuzzyActions]);
  const haystack = new Set(doc.tokens);
  const nameTokens = [...tokenize(doc.name)];
  const nameTokenSet = new Set(nameTokens);

  const keyword =
    overlapRatio(queryTokens, nameTokenSet) * 0.65 +
    overlapRatio(queryTokens, haystack) * 0.35 +
    phraseBonus(rawNormalizedQuery, [normalizeLoose(doc.name), ...doc.keywords.map(normalizeLoose)]) * 0.4;

  const semantic =
    overlapRatio(expandedTokens, haystack) * 0.55 +
    phraseBonus(rawNormalizedQuery, [...doc.synonyms, ...doc.useCases].map(normalizeLoose)) * 0.45;

  const intentScore = scoreIntent(doc, intent, fuzzyActions);
  const effectiveActions = intent.actions.length ? intent.actions : fuzzyActions;

  const actionScore = effectiveActions.length
    ? effectiveActions.filter((a) => doc.actions.includes(a)).length / effectiveActions.length
    : overlapRatio(
        queryTokens.filter((t) => doc.actions.includes(t)),
        new Set(doc.actions)
      );

  const objectScore = intent.objects.length
    ? intent.objects.some((o) => doc.objects.includes(o))
      ? 1
      : 0
    : 0;

  let formatScore = 0;
  if (intent.inputFormat || intent.outputFormat) {
    const parts: number[] = [];
    if (intent.inputFormat) {
      parts.push(doc.inputFormats.includes(intent.inputFormat) ? 1 : 0);
    }
    if (intent.outputFormat) {
      parts.push(doc.outputFormats.includes(intent.outputFormat) ? 1 : 0);
    }
    formatScore = parts.reduce((a, b) => a + b, 0) / parts.length;
  }

  const fuzzy =
    bestFuzzyScore(queryTokens, nameTokens) * 0.6 +
    bestFuzzyScore(queryTokens, doc.tokens) * 0.25 +
    bestFuzzyScore(queryTokens, doc.actions) * 0.15;

  const quality = Math.min(1, doc.qualityScore * 0.7 + Math.min(doc.popularity, 1000) / 2000);

  let penalty = 0;
  if (intent.objects.length && objectScore === 0 && effectiveActions.length) {
    const actionOnlyHit = effectiveActions.some((a) => doc.actions.includes(a));
    if (actionOnlyHit) {
      penalty = 0.35;
    }
  }

  const total = Math.max(
    0,
    weights.semantic * clamp01(semantic) +
      weights.keyword * clamp01(keyword) +
      weights.intent * clamp01(intentScore) +
      weights.action * clamp01(actionScore) +
      weights.object * clamp01(objectScore) +
      weights.format * clamp01(formatScore) +
      weights.fuzzy * clamp01(fuzzy) +
      weights.quality * clamp01(quality) -
      penalty
  );

  const matchType = pickMatchType({
    keyword: clamp01(keyword),
    semantic: clamp01(semantic),
    intent: clamp01(intentScore),
    fuzzy: clamp01(fuzzy),
    nameExact: normalizeLoose(doc.name) === rawNormalizedQuery,
  });

  return {
    semantic: clamp01(semantic),
    keyword: clamp01(keyword),
    intent: clamp01(intentScore),
    action: clamp01(actionScore),
    object: clamp01(objectScore),
    format: clamp01(formatScore),
    fuzzy: clamp01(fuzzy),
    quality: clamp01(quality),
    total,
    matchType,
  };
}

function pickMatchType(parts: {
  keyword: number;
  semantic: number;
  intent: number;
  fuzzy: number;
  nameExact: boolean;
}): SearchMatchType {
  if (parts.nameExact) {
    return 'exact';
  }
  if (parts.intent >= 0.7 && parts.intent >= parts.keyword) {
    return 'intent';
  }
  if (parts.semantic >= 0.55 && parts.semantic >= parts.keyword) {
    return 'semantic';
  }
  if (parts.keyword >= 0.45) {
    return 'keyword';
  }
  if (parts.fuzzy >= 0.75) {
    return 'fuzzy';
  }
  if (parts.semantic > 0) {
    return 'semantic';
  }
  return 'keyword';
}

function clamp01(value: number): number {
  if (Number.isNaN(value) || !Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
}

function normalizeLoose(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}
