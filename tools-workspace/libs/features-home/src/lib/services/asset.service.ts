import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';

/**
 * AssetService - Core service for resolving asset paths correctly
 * 
 * This service ensures assets are loaded correctly in both:
 * - Localhost (dev server): /assets/icons/copy.svg
 * - Production (SSR/deployed): Handles base href and ensures proper path resolution
 * 
 * Why this is needed:
 * 1. In production, if the app is served from a subdirectory, absolute paths break
 * 2. SSR may not properly resolve asset paths without considering base href
 * 3. Different servers/configurations require different path resolution strategies
 * 4. Some servers (nginx, Apache, etc.) may not serve static files correctly, causing
 *    requests to return index.html (text/html) instead of the actual asset file
 * 
 * Usage:
 * ```typescript
 * import { AssetService } from '@tools-workspace/features-home';
 * 
 * constructor(private assetService: AssetService) {}
 * 
 * iconPath = this.assetService.getAssetPath('icons/copy.svg');
 * ```
 * 
 * In template:
 * ```html
 * <img [src]="assetService.getAssetPath('icons/copy.svg')" alt="" />
 * ```
 * 
 * How it works:
 * - In localhost: Angular dev server serves assets from /assets/ directly
 * - In production: Express/Nginx needs to serve static files BEFORE Angular routing
 *   catches them. If routing catches asset requests, it returns index.html (text/html)
 *   instead of the actual asset, causing 200 OK responses with wrong content type.
 * 
 * The solution:
 * 1. Server must serve static files BEFORE the catch-all Angular route (server.ts)
 * 2. Service properly resolves paths considering base href
 * 3. Always use this service instead of hardcoded '/assets/...' paths
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
    // Get base href from the document, fallback to '/' if not found
    // In SSR, document might not have a base tag, so we handle that
    if (isPlatformBrowser(this.platformId)) {
      const baseTag = this.document.querySelector('base');
      this.baseHref = baseTag?.getAttribute('href') || '/';
    } else {
      // For SSR, use default base href
      // This will be properly set by Angular SSR when rendering
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

