import type { FvToolSuggestion } from '../shared/fv-tool-suggestion.model';

export interface NftTrait {
  traitType: string;
  value: string;
}

export interface NftMetadata {
  name: string;
  description: string;
  imageUrl: string;
  externalUrl: string;
  traits: NftTrait[];
  raw: unknown;
}

export function isNftMetadataFile(file: Pick<File, 'name' | 'type'>): boolean {
  const name = file.name.toLowerCase();
  return name.endsWith('.json') || file.type === 'application/json';
}

export function parseNftMetadata(content: string): NftMetadata {
  const raw = JSON.parse(content) as Record<string, unknown>;
  const root = unwrapMetadataRoot(raw);

  const name = pickString(root, ['name', 'title']) ?? 'Untitled';
  const description = pickString(root, ['description']) ?? '';
  const imageUrl = normalizeMediaUrl(pickString(root, ['image', 'image_url', 'imageUrl']) ?? '');
  const externalUrl = pickString(root, ['external_url', 'externalUrl', 'url']) ?? '';

  const attributes = root['attributes'] ?? root['traits'] ?? root['properties'];
  const traits = normalizeTraits(attributes);

  return { name, description, imageUrl, externalUrl, traits, raw: root };
}

function unwrapMetadataRoot(raw: Record<string, unknown>): Record<string, unknown> {
  if (raw['metadata'] && typeof raw['metadata'] === 'object') {
    return raw['metadata'] as Record<string, unknown>;
  }
  return raw;
}

function pickString(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

function normalizeMediaUrl(url: string): string {
  if (!url) {
    return '';
  }
  if (url.startsWith('ipfs://')) {
    return `https://ipfs.io/ipfs/${url.slice(7)}`;
  }
  return url;
}

function normalizeTraits(value: unknown): NftTrait[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null;
      }
      const record = item as Record<string, unknown>;
      const traitType = String(record['trait_type'] ?? record['traitType'] ?? record['type'] ?? 'Trait');
      const rawValue = record['value'] ?? record['val'];
      const traitValue =
        typeof rawValue === 'string' || typeof rawValue === 'number'
          ? String(rawValue)
          : JSON.stringify(rawValue ?? '');
      return { traitType, value: traitValue };
    })
    .filter((item): item is NftTrait => item !== null);
}

export function filterNftTraits(traits: NftTrait[], query: string): NftTrait[] {
  const q = query.trim().toLowerCase();
  if (!q) {
    return traits;
  }
  return traits.filter(
    (trait) => trait.traitType.toLowerCase().includes(q) || trait.value.toLowerCase().includes(q)
  );
}

export function resolveNftSuggestion(options: {
  hasMetadata: boolean;
  hasError: boolean;
}): FvToolSuggestion | null {
  if (options.hasError) {
    return {
      id: 'nft-text',
      title: 'Plain JSON file?',
      reason: 'Text File Viewer shows raw JSON with syntax-friendly layout.',
      actionLabel: 'Open Text File Viewer',
      path: '/file-viewers/text-file-viewer'
    };
  }
  if (!options.hasMetadata) {
    return {
      id: 'nft-image',
      title: 'Inspect images directly?',
      reason: 'Image Viewer opens PNG, JPG, GIF, and WebP without metadata parsing.',
      actionLabel: 'Open Image Viewer',
      path: '/file-viewers/image-viewer'
    };
  }
  return null;
}
