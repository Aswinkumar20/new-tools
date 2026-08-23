/**
 * Shared Leaflet helpers for GIS viewers.
 * Leaflet is loaded only from the `leaflet` package in node_modules
 * (declared in the workspace package.json).
 */

type LeafletModule = typeof import('leaflet');

let leafletModulePromise: Promise<LeafletModule> | null = null;

/** Dynamic import keeps Leaflet out of SSR bundles. */
export async function loadLeaflet(): Promise<LeafletModule> {
  if (!leafletModulePromise) {
    leafletModulePromise = import('leaflet');
  }
  return leafletModulePromise;
}

export function ensureLeafletStylesheet(href: string, dataAttr = 'leafletCss'): void {
  if (typeof document === 'undefined') {
    return;
  }
  const selector = `link[data-${camelToKebab(dataAttr)}="${href}"]`;
  const existing = document.querySelector(selector);
  if (existing) {
    return;
  }
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  link.dataset[dataAttr] = href;
  document.head.appendChild(link);
}

function camelToKebab(value: string): string {
  return value.replace(/[A-Z]/g, (ch) => `-${ch.toLowerCase()}`);
}

export function configureLeafletDefaultIcons(
  L: LeafletModule,
  assetBase: string
): void {
  const base = assetBase.replace(/\/$/, '');
  // Leaflet's default icon URLs break when CSS is loaded from /assets.
  const DefaultIcon = L.Icon.Default as unknown as {
    prototype: { _getIconUrl?: unknown };
    mergeOptions: (options: Record<string, string>) => void;
  };
  delete DefaultIcon.prototype._getIconUrl;
  DefaultIcon.mergeOptions({
    iconRetinaUrl: `${base}/marker-icon-2x.png`,
    iconUrl: `${base}/marker-icon.png`,
    shadowUrl: `${base}/marker-shadow.png`
  });
}

export function downloadTextFile(content: string, fileName: string, mime: string): void {
  if (typeof document === 'undefined') {
    throw new Error('Download is only available in the browser');
  }
  if (!content) {
    throw new Error('Nothing to download');
  }
  const safeName = fileName.trim() || 'download.txt';
  const blob = new Blob([content], { type: mime || 'text/plain' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = safeName;
  anchor.click();
  URL.revokeObjectURL(url);
}
