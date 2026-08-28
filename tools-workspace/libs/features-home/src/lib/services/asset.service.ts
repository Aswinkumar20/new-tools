import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';

/**
 * AssetService - resolves `/assets/...` paths with optional base href.
 *
 * Use in both CSR dev and static SSG deploys (`dist/apps/tools-site/browser`).
 * CDN/Apache/Netlify/Vercel must serve hashed assets and `/assets/*` as static
 * files — never SPA-fallback asset URLs to `index.html`.
 *
 * Usage:
 * ```typescript
 * iconPath = this.assetService.getAssetPath('icons/copy.svg');
 * ```
 */
@Injectable({
  providedIn: 'root',
})
export class AssetService {
  private readonly baseHref: string;

  constructor(
    @Inject(DOCUMENT) private document: Document,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    if (isPlatformBrowser(this.platformId)) {
      const baseTag = this.document.querySelector('base');
      this.baseHref = baseTag?.getAttribute('href') || '/';
    } else {
      // Build-time prerender: default base href
      this.baseHref = '/';
    }
  }

  /**
   * Get the full path to an asset
   * 
   * @param assetPath - Relative path from assets folder (e.g., 'icons/copy.svg')
   * @returns Full path to the asset (e.g., '/assets/icons/copy.svg' or '/app/assets/icons/copy.svg' if base href is '/app/')
   * 
   * Examples:
   * - getAssetPath('icons/copy.svg') -> '/assets/icons/copy.svg'
   * - getAssetPath('images/logo.png') -> '/assets/images/logo.png'
   * 
   * This method ensures:
   * 1. Base href is properly considered
   * 2. Assets always resolve to the correct path regardless of deployment location
   * 3. Works in both browser and SSR environments
   */
  getAssetPath(assetPath: string): string {
    // Normalize the asset path (remove leading slash if present, ensure no double slashes)
    const normalizedPath = assetPath.startsWith('/') ? assetPath.slice(1) : assetPath;
    
    // Normalize base href (ensure it ends with / and starts with /)
    let normalizedBaseHref = this.baseHref;
    if (!normalizedBaseHref.startsWith('/')) {
      normalizedBaseHref = '/' + normalizedBaseHref;
    }
    if (normalizedBaseHref !== '/' && !normalizedBaseHref.endsWith('/')) {
      normalizedBaseHref = normalizedBaseHref + '/';
    }
    
    // Construct the full path
    // If base href is '/', result is '/assets/...'
    // If base href is '/app/', result is '/app/assets/...'
    const fullPath = `${normalizedBaseHref}assets/${normalizedPath}`.replace(/\/+/g, '/');
    
    return fullPath;
  }

  /**
   * Get the base href used by the application
   * Useful for debugging or other services that need to know the base path
   */
  getBaseHref(): string {
    return this.baseHref;
  }

  /**
   * Check if we're running in the browser
   * Useful for conditional asset loading logic
   */
  isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }
}

