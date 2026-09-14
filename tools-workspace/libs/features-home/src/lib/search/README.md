# Client-side semantic tool search

UI-only hybrid search for EasyToolHub. No backend API, embeddings service, or database required.

## Architecture

```
Search input
  → normalize + clamp
  → intent / entity detection (rules + synonyms)
  → score all catalog tools (keyword + semantic overlap + intent + fuzzy + quality)
  → rank, confidence, related tools, clarification
  → render in home / nav
```

Searchable documents are built once from `TOOL_CATEGORIES` plus curated overrides in `metadata.ts`.

## Adding / improving a tool in search

1. Ensure the tool is in the generated catalog (`tools-catalog.generated.ts`).
2. Optionally add an entry to `TOOL_METADATA_OVERRIDES` keyed by path:

```ts
'/image-color-tools/image-compressor': {
  actions: ['compress', 'optimize'],
  objects: ['image', 'photo'],
  synonyms: ['make photo smaller', 'shrink image'],
  useCases: ['reduce image file size for email'],
}
```

3. Rebuild is not required for metadata-only edits beyond the normal app build.
4. Add a regression case in `engine.spec.ts`.

## Ranking weights

Tunable in `ranking.config.ts` (`DEFAULT_RANKING_WEIGHTS`).

## Limits vs true vector embeddings

This implementation uses enriched metadata + synonym expansion + intent scoring as a lightweight semantic layer.

True neural embeddings (transformers.js / OpenAI) were intentionally skipped to keep the static SSG bundle small and avoid API keys. The module boundaries allow swapping in precomputed vectors later without changing the UI.

## Analytics (future)

Wire click / query events in the UI layer when product analytics is ready. Do not store PII.
