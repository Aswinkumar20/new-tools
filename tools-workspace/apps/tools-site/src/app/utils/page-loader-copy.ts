import { getToolSeoEntry } from '../config/route-seo.config';
import {
  AVAILABLE_TOOL_ICON_SLUGS,
  TOOL_ICON_CATEGORY,
} from './tool-icon-slugs.generated';

/** Visual motif for the first-load forge animation. */
export type LoaderMotif =
  | 'home'
  | 'pdf'
  | 'image'
  | 'text'
  | 'data'
  | 'security'
  | 'media'
  | 'code'
  | 'math'
  | 'fun'
  | 'viewer'
  | 'browser'
  | 'default';

export interface PageLoaderCopy {
  kicker: string;
  hints: string[];
  readyHint: string;
  motif: LoaderMotif;
  /** Center glyph — current tool / category / random. */
  centerIconSlug: string;
  /** Four orbiting tool icons (random, biased to destination category). */
  orbitIconSlugs: string[];
}

const HOME_HINTS = [
  'Sharpening the digital screwdrivers…',
  'Lining up free tools in neat little piles…',
  'Calibrating browser-side magic…',
  'No signup. No uploads. Just a moment…',
  'Polishing the last wrench…',
];

const SHARED_HINTS = [
  'Running privately in your browser…',
  'No account needed — hang tight…',
  'Keeping your files on this device…',
];

const CATEGORY_FLAVOR: Record<string, string[]> = {
  'pdf-tools': [
    'Warming up the PDF workshop…',
    'Stacking pages in the right order…',
    'Tuning compression dials…',
  ],
  'image-color-tools': [
    'Tuning pixels and palettes…',
    'Sharpening the image bench…',
    'Mixing the color swatches…',
  ],
  'text-utilities': [
    'Stretching the text muscles…',
    'Counting characters in advance…',
    'Warming up the case converters…',
  ],
  'data-converters': [
    'Straightening curly braces…',
    'Mapping rows to objects…',
    'Validating the data pipes…',
  ],
  'security-tools': [
    'Spinning up secure randomness…',
    'Checking the crypto toolkit…',
    'Locking the vault door…',
  ],
  'testing-tools': [
    'Preparing the debug console…',
    'Lining up payloads for inspection…',
    'Warming the decoder…',
  ],
  'math-date-utils': [
    'Zeroing the calculators…',
    'Syncing unit tables…',
    'Checking calendar gears…',
  ],
  'fun-tools': [
    'Drawing QR dots into place…',
    'Shuffling the fun drawer…',
    'Charging the creative spark…',
  ],
  'browser-utils': [
    'Reading device vitals…',
    'Checking browser capabilities…',
    'Probing local storage shelves…',
  ],
  'file-viewers': [
    'Opening the file preview stage…',
    'Preparing a safe local viewer…',
    'Lining up document pages…',
  ],
  'media-tools': [
    'Cueing media buffers…',
    'Tuning the playback deck…',
    'Warming audio/video helpers…',
  ],
  'code-file-tools': [
    'Indenting the code workbench…',
    'Highlighting syntax lanes…',
    'Prepping file transforms…',
  ],
  'dev-design-tools': [
    'Laying out the design grid…',
    'Mixing developer pigments…',
    'Snapping guides into place…',
  ],
  'cad-viewers': [
    'Unrolling CAD layers…',
    'Warming geometry buffers…',
    'Aligning drawing coordinates…',
  ],
  'gis-viewers': [
    'Unfolding the map layers…',
    'Calibrating geospatial lenses…',
    'Pinning coordinates…',
  ],
  'medical-viewers': [
    'Preparing the clinical viewer…',
    'Loading study frames safely…',
    'Keeping scans on-device…',
  ],
  'science-viewers': [
    'Setting up science viewers…',
    'Aligning measurement scales…',
    'Warming analysis panels…',
  ],
  'network-viewers': [
    'Tracing network paths…',
    'Mapping packet lanes…',
    'Warming protocol decoders…',
  ],
  'process-viewers': [
    'Charting process flows…',
    'Connecting workflow nodes…',
    'Warming the process canvas…',
  ],
  'diagram-viewers': [
    'Sketching diagram rails…',
    'Snapping shapes into place…',
    'Warming the diagram stage…',
  ],
  'data-explorers': [
    'Exploring data shelves…',
    'Indexing columns quietly…',
    'Warming the explorer grid…',
  ],
  'ml-viewers': [
    'Warming model viewers…',
    'Loading inference previews…',
    'Keeping tensors local…',
  ],
};

const MOTIF_BY_CATEGORY: Record<string, LoaderMotif> = {
  'pdf-tools': 'pdf',
  'file-viewers': 'pdf',
  'image-color-tools': 'image',
  'text-utilities': 'text',
  'data-converters': 'data',
  'data-explorers': 'data',
  'security-tools': 'security',
  'testing-tools': 'security',
  'media-tools': 'media',
  'code-file-tools': 'code',
  'dev-design-tools': 'code',
  'math-date-utils': 'math',
  'fun-tools': 'fun',
  'browser-utils': 'browser',
  'cad-viewers': 'viewer',
  'gis-viewers': 'viewer',
  'medical-viewers': 'viewer',
  'science-viewers': 'viewer',
  'network-viewers': 'viewer',
  'process-viewers': 'viewer',
  'diagram-viewers': 'viewer',
  'ml-viewers': 'viewer',
};

function cleanPath(url: string): string {
  const path = (url || '').split('?')[0].split('#')[0] || '';
  if (!path || path === '/') {
    return '/tools/home';
  }
  return path.replace(/\/$/, '') || '/tools/home';
}

function uniqueHints(hints: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const hint of hints) {
    const key = hint.trim();
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(key);
  }
  return out;
}

function humanizeSlug(slug: string): string {
  return slug
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function motifForSlug(categorySlug: string | undefined): LoaderMotif {
  if (!categorySlug) {
    return 'default';
  }
  return MOTIF_BY_CATEGORY[categorySlug] ?? 'default';
}

const ICON_SET = new Set(AVAILABLE_TOOL_ICON_SLUGS);

function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function iconsForCategory(categorySlug: string): string[] {
  return AVAILABLE_TOOL_ICON_SLUGS.filter(
    (slug) => TOOL_ICON_CATEGORY[slug] === categorySlug || slug === categorySlug
  );
}

/**
 * Pick real tool icons: prefer destination category, then fill with random catalog icons.
 */
function pickLoaderIcons(
  path: string,
  categorySlug: string | undefined,
  isHome: boolean
): { centerIconSlug: string; orbitIconSlugs: string[] } {
  const parts = path.split('/').filter(Boolean);
  const toolSlug = parts.length >= 2 ? parts[parts.length - 1] : '';
  const preferredPool = categorySlug ? iconsForCategory(categorySlug) : [];
  const globalPool = shuffle([...AVAILABLE_TOOL_ICON_SLUGS]);

  let centerIconSlug = 'pdf-tools';
  if (!isHome && toolSlug && ICON_SET.has(toolSlug)) {
    centerIconSlug = toolSlug;
  } else if (categorySlug && ICON_SET.has(categorySlug)) {
    centerIconSlug = categorySlug;
  } else if (preferredPool.length) {
    centerIconSlug = shuffle(preferredPool)[0];
  } else if (globalPool.length) {
    centerIconSlug = globalPool[0];
  }

  const used = new Set<string>([centerIconSlug]);
  const orbitIconSlugs: string[] = [];

  for (const slug of shuffle(preferredPool)) {
    if (orbitIconSlugs.length >= 4) {
      break;
    }
    if (used.has(slug)) {
      continue;
    }
    used.add(slug);
    orbitIconSlugs.push(slug);
  }

  for (const slug of globalPool) {
    if (orbitIconSlugs.length >= 4) {
      break;
    }
    if (used.has(slug)) {
      continue;
    }
    used.add(slug);
    orbitIconSlugs.push(slug);
  }

  while (orbitIconSlugs.length < 4 && AVAILABLE_TOOL_ICON_SLUGS.length) {
    orbitIconSlugs.push(
      AVAILABLE_TOOL_ICON_SLUGS[orbitIconSlugs.length % AVAILABLE_TOOL_ICON_SLUGS.length]
    );
  }

  return { centerIconSlug, orbitIconSlugs: orbitIconSlugs.slice(0, 4) };
}

function withIcons(
  copy: Omit<PageLoaderCopy, 'centerIconSlug' | 'orbitIconSlugs'>,
  path: string,
  categorySlug: string | undefined,
  isHome: boolean
): PageLoaderCopy {
  return { ...copy, ...pickLoaderIcons(path, categorySlug, isHome) };
}

/**
 * Build page-aware loader copy + visual motif from the destination URL.
 * Used on first load / hard reload only (not SPA navigations).
 */
export function getPageLoaderCopy(url: string): PageLoaderCopy {
  const path = cleanPath(url);
  const entry = getToolSeoEntry(path);
  const parts = path.split('/').filter(Boolean);
  const isHome = path === '/tools/home' || path === '/tools';
  const isCategoryOnly = !!entry && parts.length === 1;
  const isTool = !!entry && parts.length >= 2 && !isHome;
  const categorySlug = entry?.categorySlug || parts[0] || '';

  if (isHome) {
    return withIcons(
      {
        kicker: 'Assembling your workspace',
        hints: uniqueHints([...HOME_HINTS, ...SHARED_HINTS]),
        readyHint: 'Workspace ready — opening home…',
        motif: 'home',
      },
      path,
      undefined,
      true
    );
  }

  if (isTool && entry) {
    const flavor = CATEGORY_FLAVOR[entry.categorySlug] ?? [];
    return withIcons(
      {
        kicker: `Opening ${entry.name}`,
        hints: uniqueHints([
          `Warming up ${entry.name}…`,
          `Getting ${entry.category} ready…`,
          ...flavor,
          ...SHARED_HINTS,
          `Almost there — ${entry.name} is next…`,
        ]),
        readyHint: `${entry.name} is ready…`,
        motif: motifForSlug(entry.categorySlug),
      },
      path,
      entry.categorySlug,
      false
    );
  }

  if (isCategoryOnly && entry) {
    const flavor = CATEGORY_FLAVOR[entry.categorySlug] ?? [];
    return withIcons(
      {
        kicker: `Browsing ${entry.name}`,
        hints: uniqueHints([
          `Gathering ${entry.name}…`,
          ...flavor,
          ...SHARED_HINTS,
          'Sorting tools into neat shelves…',
        ]),
        readyHint: `${entry.name} shelf is ready…`,
        motif: motifForSlug(entry.categorySlug),
      },
      path,
      entry.categorySlug,
      false
    );
  }

  const toolSlug = parts[1];
  const flavor = CATEGORY_FLAVOR[categorySlug] ?? [];
  const label = toolSlug ? humanizeSlug(toolSlug) : humanizeSlug(categorySlug || 'tools');

  return withIcons(
    {
      kicker: toolSlug ? `Opening ${label}` : `Loading ${label}`,
      hints: uniqueHints([
        `Preparing ${label}…`,
        ...flavor,
        ...SHARED_HINTS,
        'Almost ready…',
      ]),
      readyHint: `${label} is ready…`,
      motif: motifForSlug(categorySlug),
    },
    path,
    categorySlug || undefined,
    false
  );
}
