const LOADER_ICON_FALLBACK = 'pdf-tools';

/**
 * Warm the browser cache for loader forge icons before they appear in the DOM.
 */
export function preloadLoaderIcons(urls: readonly string[]): Promise<void> {
  const unique = [...new Set(urls.filter(Boolean))];

  if (!unique.length || typeof Image === 'undefined') {
    return Promise.resolve();
  }

  return Promise.all(
    unique.map(
      (url) =>
        new Promise<void>((resolve) => {
          const img = new Image();
          img.onload = () => resolve();
          img.onerror = () => resolve();
          img.src = url;
        })
    )
  ).then(() => undefined);
}

export function loaderIconAssetPath(slug: string): string {
  return `icons/categories/${slug || LOADER_ICON_FALLBACK}.svg`;
}

export const LOADER_ICON_FALLBACK_SLUG = LOADER_ICON_FALLBACK;
