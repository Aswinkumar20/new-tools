import { Directive, HostListener, inject, OnDestroy } from '@angular/core';
import { GoogleAnalyticsService } from '../services/google-analytics.service';
import { Subject } from 'rxjs';
import { debounceTime, takeUntil } from 'rxjs/operators';

/**
 * Directive to track scroll depth
 * Usage: <div gaScroll>Content</div>
 */
@Directive({
  selector: '[gaScroll]',
  standalone: true,
})
export class GaScrollDirective implements OnDestroy {
  private readonly gaService = inject(GoogleAnalyticsService);
  private readonly destroy$ = new Subject<void>();
  private readonly scrollSubject = new Subject<number>();
  private readonly trackedDepths = new Set<number>();

  constructor() {
    // Debounce scroll events
    this.scrollSubject
      .pipe(debounceTime(100), takeUntil(this.destroy$))
      .subscribe((depth) => {
        this.trackScrollDepth(depth);
      });
  }

  @HostListener('scroll', ['$event'])
  onScroll(event: Event): void {
    const target = event.target as HTMLElement;
    if (!target) return;

    const scrollTop = target.scrollTop || window.scrollY;
    const scrollHeight = target.scrollHeight || document.documentElement.scrollHeight;
    const clientHeight = target.clientHeight || window.innerHeight;

    const scrollPercentage = Math.round(
      (scrollTop / (scrollHeight - clientHeight)) * 100
    );

    // Track milestones: 25%, 50%, 75%, 100%
    const milestones = [25, 50, 75, 100];
    const milestone = milestones.find((m) => scrollPercentage >= m && !this.trackedDepths.has(m));

    if (milestone) {
      this.trackedDepths.add(milestone);
      this.scrollSubject.next(milestone);
    }
  }

  private trackScrollDepth(depth: number): void {
    this.gaService.trackScrollDepth(depth);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}

