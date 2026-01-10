import { isPlatformBrowser } from '@angular/common';
import { Component, Inject, OnInit, OnDestroy } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { PLATFORM_ID } from '@angular/core';
import { filter } from 'rxjs/operators';
import { Subject, interval } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { FooterComponent, ToastContainerComponent } from '@tools-workspace/features-home';
import { GoogleAnalyticsService } from './services/google-analytics.service';
import { AutoGATrackerService } from './services/auto-ga-tracker.service';
import { SeoService } from './services/seo.service';
import { getSeoMetadataForRoute } from './config/route-seo.config';
import { GaScrollDirective } from './directives/ga-scroll.directive';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, FooterComponent, GaScrollDirective, ToastContainerComponent],
  template: `
    <div class="app-shell" gaScroll>
      <main class="app-shell__main">
        <router-outlet></router-outlet>
      </main>
      <lib-footer></lib-footer>
      <lib-toast-container></lib-toast-container>
    </div>
  `,
  styleUrls: ['./app.scss'],
})
export class App implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  private pageStartTime = Date.now();
  private currentPath = '';

  constructor(
    private readonly router: Router,
    @Inject(PLATFORM_ID) private readonly platformId: Object,
    private readonly gaService: GoogleAnalyticsService,
    private readonly autoTracker: AutoGATrackerService,
    private readonly seoService: SeoService
  ) {
    if (isPlatformBrowser(this.platformId)) {
      // Track route changes and scroll to top
      this.router.events
        .pipe(
          filter((event): event is NavigationEnd => event instanceof NavigationEnd),
          takeUntilDestroyed()
        )
        .subscribe((event: NavigationEnd) => {
          // Track time on previous page before navigation
          if (this.currentPath) {
            const timeSpent = Math.round((Date.now() - this.pageStartTime) / 1000);
            this.gaService.trackTimeOnPage(timeSpent, this.currentPath);
          }

          // Update current path and start time
          this.currentPath = event.urlAfterRedirects;
          this.pageStartTime = Date.now();

          // Update SEO metadata for the new route
          this.updateSeoForRoute(event.urlAfterRedirects);

          // Scroll to top
          window.scrollTo({ top: 0, behavior: 'smooth' });
        });

      // Track time on page periodically (every 30 seconds)
      interval(30000)
        .pipe(takeUntil(this.destroy$))
        .subscribe(() => {
          if (this.currentPath) {
            const timeSpent = Math.round((Date.now() - this.pageStartTime) / 1000);
            this.gaService.trackTimeOnPage(timeSpent, this.currentPath);
          }
        });

      // Track global errors
      this.setupErrorTracking();
    }
  }

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      // Apply theme immediately on app load
      this.applyThemeOnInit();
      
      this.currentPath = this.router.url;
      this.pageStartTime = Date.now();

      // Update SEO metadata for initial route
      this.updateSeoForRoute(this.currentPath);

      // Track initial page load performance
      if ('performance' in window && window.performance.timing) {
        const perf = window.performance.timing;
        const pageLoadTime = perf.loadEventEnd - perf.navigationStart;
        const domContentLoaded = perf.domContentLoadedEventEnd - perf.navigationStart;
        const domInteractive = perf.domInteractive - perf.navigationStart;

        this.gaService.trackPerformance('page_load_time', pageLoadTime);
        this.gaService.trackPerformance('dom_content_loaded', domContentLoaded);
        this.gaService.trackPerformance('dom_interactive', domInteractive);
      }

      // Track Core Web Vitals if available
      this.trackCoreWebVitals();
    }
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
            this.gaService.trackPerformance('lcp', Math.round(lastEntry.renderTime || lastEntry.loadTime), 'ms');
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

    if (seoMetadata) {
      // Generate structured data for tool pages
      if (cleanUrl !== '/tools/home' && cleanUrl.startsWith('/')) {
        const toolName = seoMetadata.title?.split(' - ')[0] || 'Tool';
        seoMetadata.structuredData = this.seoService.generateToolStructuredData(
          toolName,
          seoMetadata.description || '',
          cleanUrl
        );
      } else {
        // Home page structured data
        seoMetadata.structuredData = this.seoService.generateWebsiteStructuredData();
      }

      this.seoService.updateMetadata(seoMetadata);
    }
  }
}
