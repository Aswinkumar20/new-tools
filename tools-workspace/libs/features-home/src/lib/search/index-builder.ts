import { ToolCategoryCatalog } from '../config/tools-catalog.generated';
import { normalizeToolPath, popularityRank } from '../config/tools-popularity.config';
import { CATEGORY_OBJECT_HINTS, TOOL_METADATA_OVERRIDES } from './metadata';
import { normalizeText, pathToToolId, tokenize, uniqueStrings } from './normalize';
import { ACTION_SYNONYMS, resolveAction, resolveObject } from './synonyms';
import { ToolSearchDocument } from './types';

const ACTION_NAME_HINTS: Array<{ pattern: RegExp; action: string }> = [
  { pattern: /\bcompress|\boptimis|\bshrink|\bminif/i, action: 'compress' },
  { pattern: /\bresize|\bscale|\bcrop/i, action: 'resize' },
  { pattern: /\bconvert|\bto\b|\bfrom\b|↔|→/i, action: 'convert' },
  { pattern: /\bmerge|\bcombine|\bjoin/i, action: 'merge' },
  { pattern: /\bsplit|\bextract|\bseparate/i, action: 'split' },
  { pattern: /\bgenerat|\bcreat|\bbuild/i, action: 'generate' },
  { pattern: /\bformat|\bbeautif|\bpretty|\bvalidat|\blint/i, action: 'format' },
  { pattern: /\bcount|\bcounter/i, action: 'count' },
  { pattern: /\bedit|\bannotat|\bhighlight|\bsignature/i, action: 'edit' },
  { pattern: /\bpassword|\bprotect|\bencrypt/i, action: 'protect' },
  { pattern: /\bviewer|\bpreview|\binspect/i, action: 'view' },
  { pattern: /\bencode|\bdecode|\bescape/i, action: 'encode' },
  { pattern: /\bremov|\bdelet|\berase/i, action: 'remove' },
];

function deriveActions(name: string, description: string): string[] {
  const blob = `${name} ${description}`;
  const actions = new Set<string>();
  for (const hint of ACTION_NAME_HINTS) {
    if (hint.pattern.test(blob)) {
      actions.add(hint.action);
    }
  }
  for (const token of tokenize(blob)) {
    const action = resolveAction(token);
    if (action) {
      actions.add(action);
    }
  }
  return [...actions];
}

function deriveObjects(name: string, description: string, categoryPath: string): string[] {
  const objects = new Set<string>(CATEGORY_OBJECT_HINTS[categoryPath] ?? []);
  const blob = `${name} ${description} ${categoryPath.replace(/-/g, ' ')}`;
  for (const token of tokenize(blob)) {
    const object = resolveObject(token);
    if (object) {
      objects.add(object);
    }
  }
  return [...objects];
}

function deriveFormats(name: string, description: string, path: string): string[] {
  const blob = normalizeText(`${name} ${description} ${path}`);
  const formats: string[] = [];
  for (const token of blob.split(' ')) {
    if (
      ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'pdf', 'json', 'csv', 'yaml', 'yml', 'xml', 'html', 'base64'].includes(
        token
      )
    ) {
      formats.push(token === 'jpeg' ? 'jpg' : token === 'yml' ? 'yaml' : token);
    }
  }
  return uniqueStrings(formats);
}

function buildSearchText(parts: string[]): string {
  return uniqueStrings(parts.flatMap((part) => tokenize(part, { keepStopWords: true }))).join(' ');
}

export function buildToolSearchDocument(
  tool: { name: string; description: string; path: string },
  category: { name: string; path: string },
  options?: { popularityBoost?: number }
): ToolSearchDocument {
  const path = tool.path.startsWith('/') ? tool.path : `/${tool.path}`;
  const normalizedPath = normalizeToolPath(path);
  const override =
    TOOL_METADATA_OVERRIDES[path] ?? TOOL_METADATA_OVERRIDES[`/${normalizedPath}`] ?? {};
  const actions = uniqueStrings([...(override.actions ?? []), ...deriveActions(tool.name, tool.description)]);
  const objects = uniqueStrings([
    ...(override.objects ?? []),
    ...deriveObjects(tool.name, tool.description, category.path),
  ]);
  const formats = uniqueStrings([
    ...(override.inputFormats ?? []),
    ...(override.outputFormats ?? []),
    ...deriveFormats(tool.name, tool.description, path),
  ]);

  const synonymExtras: string[] = [];
  for (const action of actions) {
    synonymExtras.push(...(ACTION_SYNONYMS[action] ?? []).slice(0, 6));
  }

  const keywords = uniqueStrings([
    ...(override.keywords ?? []),
    tool.name,
    ...tokenize(tool.name),
  ]);
  const synonyms = uniqueStrings([...(override.synonyms ?? []), ...synonymExtras]);
  const useCases = uniqueStrings(override.useCases ?? []);
  const tags = uniqueStrings([...(override.tags ?? []), ...actions, ...objects, category.path]);

  const searchText = buildSearchText([
    tool.name,
    tool.description,
    category.name,
    ...keywords,
    ...synonyms,
    ...useCases,
    ...actions,
    ...objects,
    ...formats,
    ...tags,
  ]);

  const popularity = Math.max(
    0,
    1000 - popularityRank(category.path, path) + (options?.popularityBoost ?? 0)
  );

  return {
    id: pathToToolId(path),
    path,
    name: tool.name,
    description: tool.description,
    category: category.name,
    categoryPath: category.path,
    actions,
    objects,
    inputFormats: uniqueStrings(override.inputFormats ?? formats),
    outputFormats: uniqueStrings(override.outputFormats ?? formats),
    keywords,
    synonyms,
    useCases,
    tags,
    searchText,
    tokens: tokenize(searchText),
    popularity,
    qualityScore: override.qualityScore ?? 0.55,
  };
}

export function buildSearchIndex(catalog: ToolCategoryCatalog[]): ToolSearchDocument[] {
  const docs: ToolSearchDocument[] = [];
  for (const category of catalog) {
    for (const tool of category.subCategories ?? []) {
      docs.push(buildToolSearchDocument(tool, category));
    }
  }
  return docs;
}
