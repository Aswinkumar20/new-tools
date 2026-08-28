import { isPlatformBrowser } from '@angular/common';
import { Component, Inject, OnInit, OnDestroy } from '@angular/core';
import {
  NavigationEnd,
  Router,
  RouterOutlet,
} from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { PLATFORM_ID } from '@angular/core';
import { filter } from 'rxjs/operators';
import { Subject, interval } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import {
  AssetService,
  FooterComponent,
  Navigation,
  StatValueTooltipHostDirective,
  ToastContainerComponent,
  TOOL_CATEGORIES,
} from '@tools-workspace/features-home';
import { GoogleAnalyticsService } from './services/google-analytics.service';
import { AutoGATrackerService } from './services/auto-ga-tracker.service';
import { SeoService } from './services/seo.service';
import {
  getSeoMetadataForRoute,
  getToolSeoEntry,
  isComingSoonRoute,
} from './config/route-seo.config';
import { GaScrollDirective } from './directives/ga-scroll.directive';
import { getPageLoaderCopy, type LoaderMotif } from './utils/page-loader-copy';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    Navigation,
    FooterComponent,
    GaScrollDirective,
    ToastContainerComponent,
    StatValueTooltipHostDirective,
  ],
  template: `
    <div class="app-shell" gaScroll appStatValueTooltipHost>
      <lib-navigation [reserveSpace]="!isHomeRoute"></lib-navigation>
      <main class="app-shell__main">
        @if (isPageLoading) {
          <div
            class="app-shell__loader"
            role="status"
            aria-live="polite"
            [attr.aria-label]="loadingKicker"
            [attr.data-motif]="loadingMotif"
          >
            <div class="app-shell__loader-stage">
              <div class="app-shell__forge" aria-hidden="true">
                <span class="app-shell__forge-bloom"></span>
                <span class="app-shell__forge-mesh"></span>
                <span class="app-shell__forge-pulse p-a"></span>
                <span class="app-shell__forge-pulse p-b"></span>
                <svg class="app-shell__forge-ring app-shell__forge-ring--outer" viewBox="0 0 96 96">
                  <circle class="app-shell__forge-ring-track" cx="48" cy="48" r="44" />
                  <circle class="app-shell__forge-ring-progress" cx="48" cy="48" r="44" />
                </svg>
                <svg class="app-shell__forge-ring app-shell__forge-ring--inner" viewBox="0 0 96 96">
                  <circle class="app-shell__forge-ring-track" cx="48" cy="48" r="34" />
                  <circle class="app-shell__forge-ring-progress app-shell__forge-ring-progress--inner" cx="48" cy="48" r="34" />
                </svg>
                <span class="app-shell__forge-glow"></span>
                <span class="app-shell__forge-core">
                  <span class="app-shell__forge-core-shine"></span>
                  @if (loaderCenterIcon) {
                    <img
                      class="app-shell__forge-glyph-img"
                      [src]="loaderCenterIcon"
                      alt=""
                      width="28"
                      height="28"
                    />
                  }
                </span>
                <span class="app-shell__forge-orbit app-shell__forge-orbit--a">
                  @for (icon of loaderOrbitIcons; track icon; let i = $index) {
                    <i [class]="'app-shell__forge-tile t' + (i + 1)">
                      <img [src]="icon" alt="" width="18" height="18" />
                    </i>
                  }
                </span>
                <span class="app-shell__forge-orbit app-shell__forge-orbit--b">
                  <i class="app-shell__forge-spark s1"></i>
                  <i class="app-shell__forge-spark s2"></i>
                  <i class="app-shell__forge-spark s3"></i>
                </span>
                <span class="app-shell__forge-particle p1"></span>
                <span class="app-shell__forge-particle p2"></span>
                <span class="app-shell__forge-particle p3"></span>
                <span class="app-shell__forge-particle p4"></span>
                <span class="app-shell__forge-particle p5"></span>
              </div>
              <div class="app-shell__loader-copy">
                <p class="app-shell__loader-kicker">
                  <span>{{ loadingKicker }}</span>
                </p>
                @for (hint of [loadingHint]; track hint) {
                  <p class="app-shell__loader-hint">{{ hint }}</p>
                }
                <div class="app-shell__loader-bar" aria-hidden="true">
                  <span></span>
                </div>
                <div class="app-shell__loader-dots" aria-hidden="true">
                  <i></i><i></i><i></i>
                </div>
              </div>
            </div>
          </div>
        }
        <div
          class="app-shell__page"
          [class.app-shell__page--loading]="isPageLoading"
          [class.app-shell__page--visible]="pageVisible && !isPageLoading"
        >
          <router-outlet (activate)="onOutletActivate()"></router-outlet>
        </div>
      </main>
      @if (contentReady && !isPageLoading) {
        <lib-footer></lib-footer>
      }
      <lib-toast-container></lib-toast-container>
    </div>
  `,
  styleUrls: ['./app.scss'],
})
export class App implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  private pageStartTime = Date.now();
  private currentPath = '';
  private hasActivatedOnce = false;
  private hintTimer: ReturnType<typeof setInterval> | null = null;
  private hintIndex = 0;
  private loaderShownAt = 0;
  private loaderRevealTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly minLoaderMs = 2000;
  private readonly hintRotateMs = 850;
  private activeHints: string[] = [];
  private readyHint = '';

  /** Home uses full-bleed hero under fixed nav (no spacer). */
  isHomeRoute = false;
  /** Footer only after page content mounts — avoids footer-first flash. */
  contentReady = false;
  /**
   * Forge loader only on first load / hard reload.
   * SPA route clicks skip it so navigation stays instant.
   */
  isPageLoading = true;
  /** Fade/slide the page body in after each activation. */
  pageVisible = false;
  loadingKicker = 'Assembling your workspace';
  loadingHint = '';
  loadingMotif: LoaderMotif = 'home';
  loaderCenterIcon = '';
  loaderOrbitIcons: string[] = [];

  constructor(
    private readonly router: Router,
    @Inject(PLATFORM_ID) private readonly platformId: Object,
    private readonly gaService: GoogleAnalyticsService,
    private readonly autoTracker: AutoGATrackerService,
    private readonly seoService: SeoService,
    private readonly assetService: AssetService
  ) {
    // SEO runs on server and client so crawlers/SSR receive per-page metadata
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed()
      )
      .subscribe((event: NavigationEnd) => {
        this.syncShellForUrl(event.urlAfterRedirects);
        this.updateSeoForRoute(event.urlAfterRedirects);
      });

    if (isPlatformBrowser(this.platformId)) {
      // Track route changes and scroll to top (no forge loader on SPA navigations)
      this.router.events
        .pipe(
          filter((event): event is NavigationEnd => event instanceof NavigationEnd),
          takeUntilDestroyed()
        )
        .subscribe((event: NavigationEnd) => {
          if (this.currentPath) {
            const timeSpent = Math.round((Date.now() - this.pageStartTime) / 1000);
            this.gaService.trackTimeOnPage(timeSpent, this.currentPath);
          }

          this.currentPath = event.urlAfterRedirects;
          this.pageStartTime = Date.now();
          window.scrollTo({ top: 0, behavior: 'smooth' });
        });

      interval(30000)
        .pipe(takeUntil(this.destroy$))
        .subscribe(() => {
          if (this.currentPath) {
            const timeSpent = Math.round((Date.now() - this.pageStartTime) / 1000);
            this.gaService.trackTimeOnPage(timeSpent, this.currentPath);
          }
        });

      this.setupErrorTracking();
    }
  }

  ngOnInit(): void {
    this.syncShellForUrl(this.router.url);
    this.updateSeoForRoute(this.router.url);

    if (!isPlatformBrowser(this.platformId)) {
      this.isPageLoading = false;
      this.contentReady = true;
      this.pageVisible = true;
      return;
    }

    this.applyThemeOnInit();
    this.applyInitialLoader(this.router.url);

    this.currentPath = this.router.url;
    this.pageStartTime = Date.now();

    if ('performance' in window && window.performance.timing) {
      const perf = window.performance.timing;
      const pageLoadTime = perf.loadEventEnd - perf.navigationStart;
      const domContentLoaded = perf.domContentLoadedEventEnd - perf.navigationStart;
      const domInteractive = perf.domInteractive - perf.navigationStart;

      this.gaService.trackPerformance('page_load_time', pageLoadTime);
      this.gaService.trackPerformance('dom_content_loaded', domContentLoaded);
      this.gaService.trackPerformance('dom_interactive', domInteractive);
    }

    this.trackCoreWebVitals();
  }

  /**
   * Page component mounted.
   * First load: keep forge for min 2s. SPA navigations: soft fade only.
   */
  onOutletActivate(): void {
    this.contentReady = true;
    this.hasActivatedOnce = true;

    if (!isPlatformBrowser(this.platformId)) {
      this.revealLoadedPage();
      return;
    }

    if (!this.isPageLoading) {
      this.softRevealPage();
      return;
    }

    this.stopHintRotation();
    this.loadingHint = this.readyHint || 'Almost ready…';

    const startedAt = this.loaderShownAt || Date.now();
    const elapsed = Date.now() - startedAt;
    const waitMs = Math.max(0, this.minLoaderMs - elapsed);

    this.clearLoaderRevealTimer();
    this.loaderRevealTimer = setTimeout(() => this.revealLoadedPage(), waitMs);
  }

  private applyInitialLoader(url: string): void {
    const copy = getPageLoaderCopy(url);
    this.loadingKicker = copy.kicker;
    this.activeHints = copy.hints;
    this.readyHint = copy.readyHint;
    this.loadingMotif = copy.motif;
    this.loadingHint = copy.hints[0] || 'Loading…';
    this.loaderCenterIcon = this.assetService.getAssetPath(
      `icons/categories/${copy.centerIconSlug}.svg`
    );
    this.loaderOrbitIcons = copy.orbitIconSlugs.map((slug) =>
      this.assetService.getAssetPath(`icons/categories/${slug}.svg`)
    );
    this.isPageLoading = true;
    this.pageVisible = false;
    this.loaderShownAt = Date.now();
    this.startHintRotation();
  }

  private softRevealPage(): void {
    this.pageVisible = false;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        this.pageVisible = true;
      });
    });
  }

  private revealLoadedPage(): void {
    this.clearLoaderRevealTimer();
    this.isPageLoading = false;
    this.stopHintRotation();

    if (!isPlatformBrowser(this.platformId)) {
      this.pageVisible = true;
      return;
    }

    this.softRevealPage();
  }

  private clearLoaderRevealTimer(): void {
    if (this.loaderRevealTimer != null) {
      clearTimeout(this.loaderRevealTimer);
      this.loaderRevealTimer = null;
    }
  }

  private startHintRotation(): void {
    if (!isPlatformBrowser(this.platformId) || this.activeHints.length < 2) {
      return;
    }
    this.stopHintRotation();
    this.hintIndex = 0;
    this.loadingHint = this.activeHints[0];
    this.hintTimer = setInterval(() => {
      this.hintIndex = (this.hintIndex + 1) % this.activeHints.length;
      this.loadingHint = this.activeHints[this.hintIndex];
    }, this.hintRotateMs);
  }

  private stopHintRotation(): void {
    if (this.hintTimer != null) {
      clearInterval(this.hintTimer);
      this.hintTimer = null;
    }
  }

  private syncShellForUrl(url: string): void {
    const clearUrl = url.split('?')[0].split('#')[0] || '';
    this.isHomeRoute = clearUrl === '/tools/home' || clearUrl.endsWith('/tools/home');
  }

  private applyThemeOnInit(): void {
    // Load theme preference and apply immediately
    const savedTheme = localStorage.getItem('theme');
    const root = document.documentElement;

    if (savedTheme) {
      root.setAttribute('data-theme', savedTheme);
    } else {
      // Check system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    }
  }

  ngOnDestroy(): void {
    this.stopHintRotation();
    this.clearLoaderRevealTimer();

    // Track final time on page
    if (this.currentPath && isPlatformBrowser(this.platformId)) {
      const timeSpent = Math.round((Date.now() - this.pageStartTime) / 1000);
      this.gaService.trackTimeOnPage(timeSpent, this.currentPath);
    }

    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Setup global error tracking
   */
  private setupErrorTracking(): void {
    // Track JavaScript errors
    window.addEventListener('error', (event) => {
      this.gaService.trackException(
        event.message || 'JavaScript Error',
        false,
        this.extractToolNameFromPath(this.currentPath)
      );
    });

    // Track unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      const reason = event.reason?.message || event.reason || 'Unhandled Promise Rejection';
      this.gaService.trackException(
        typeof reason === 'string' ? reason : 'Unhandled Promise Rejection',
        false,
        this.extractToolNameFromPath(this.currentPath)
      );
    });
  }

  /**
   * Track Core Web Vitals
   */
  private trackCoreWebVitals(): void {
    // Largest Contentful Paint (LCP)
    if ('PerformanceObserver' in window) {
      try {
        const lcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1] as any;
          if (lastEntry) {
            this.gaService.trackPerformance(
              'lcp',
              Math.round(lastEntry.renderTime || lastEntry.loadTime),
              'ms'
            );
          }
        });
        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
      } catch (e) {
        // LCP not supported
      }

      // First Input Delay (FID)
      try {
        const fidObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach((entry: any) => {
            if (entry.processingStart && entry.startTime) {
              const fid = entry.processingStart - entry.startTime;
              this.gaService.trackPerformance('fid', Math.round(fid), 'ms');
            }
          });
        });
        fidObserver.observe({ entryTypes: ['first-input'] });
      } catch (e) {
        // FID not supported
      }

      // Cumulative Layout Shift (CLS)
      try {
        let clsValue = 0;
        const clsObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach((entry: any) => {
            if (!entry.hadRecentInput) {
              clsValue += entry.value;
            }
          });
          this.gaService.trackPerformance('cls', Math.round(clsValue * 1000) / 1000);
        });
        clsObserver.observe({ entryTypes: ['layout-shift'] });
      } catch (e) {
        // CLS not supported
      }
    }
  }

  /**
   * Extract tool name from path
   */
  private extractToolNameFromPath(path: string): string | undefined {
    const parts = path.split('/').filter(Boolean);
    if (parts.length >= 2) {
      return parts[parts.length - 1];
    }
    return undefined;
  }

  /**
   * Update SEO metadata for a route
   */
  private updateSeoForRoute(url: string): void {
    const cleanUrl = url.split('?')[0];
    const seoMetadata = getSeoMetadataForRoute(cleanUrl);

    if (!seoMetadata) {
      return;
    }

    if (cleanUrl === '/404' || cleanUrl.endsWith('/404')) {
      seoMetadata.title = 'Page not found';
      seoMetadata.description =
        'This page does not exist on EasyToolHub. Open the homepage or browse free online tools.';
      seoMetadata.robots = 'noindex, follow';
      this.seoService.updateMetadata(seoMetadata);
      return;
    }

    if (isComingSoonRoute(cleanUrl)) {
      seoMetadata.robots = 'noindex, follow';
    }

    const entry = getToolSeoEntry(cleanUrl);
    const pathParts = cleanUrl.split('/').filter(Boolean);
    const isKnownTool = !!entry && pathParts.length >= 2;
    const isCategoryIndex = !!entry && pathParts.length === 1;

    if (!entry && cleanUrl !== '/tools/home') {
      seoMetadata.title = 'Page not found';
      seoMetadata.description =
        'This page does not exist on EasyToolHub. Open the homepage or browse free online tools.';
      seoMetadata.robots = 'noindex, follow';
      this.seoService.updateMetadata(seoMetadata);
      return;
    }

    if (cleanUrl === '/tools/home') {
      seoMetadata.structuredData = this.seoService.generateWebsiteStructuredData();
    } else if (isCategoryIndex && entry) {
      const category = TOOL_CATEGORIES.find((c) => c.path === entry.categorySlug);
      const breadcrumbs = [
        { name: 'Home', url: '/tools/home' },
        { name: entry.name, url: cleanUrl },
      ];
      const itemList = (category?.subCategories ?? []).map((tool) => ({
        name: tool.name,
        url: tool.path.startsWith('/') ? tool.path : `/${tool.path}`,
      }));
      seoMetadata.structuredData = [
        this.seoService.generateToolStructuredData(entry.name, seoMetadata.description || '', cleanUrl),
        this.seoService.generateBreadcrumbStructuredData(breadcrumbs),
        this.seoService.generateItemListStructuredData(entry.name, itemList),
      ];
    } else if (isKnownTool && entry) {
      const toolName = entry.name || seoMetadata.title?.split(' - ')[0] || 'Tool';
      const breadcrumbs = [
        { name: 'Home', url: '/tools/home' },
        ...(entry.category
          ? [{ name: entry.category, url: `/${entry.categorySlug}` }]
          : []),
        { name: toolName, url: cleanUrl },
      ];

      seoMetadata.structuredData = [
        this.seoService.generateToolStructuredData(toolName, seoMetadata.description || '', cleanUrl),
        this.seoService.generateBreadcrumbStructuredData(breadcrumbs),
      ];
    }

    this.seoService.updateMetadata(seoMetadata);
  }
}
