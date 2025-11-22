import { Directive, ElementRef, HostListener, Input, inject } from '@angular/core';
import { GoogleAnalyticsService } from '../services/google-analytics.service';

/**
 * Directive to easily track clicks on elements
 * Usage: <button gaClick="button-name" [gaClickType]="'button'">Click me</button>
 */
@Directive({
  selector: '[gaClick]',
  standalone: true,
})
export class GaClickDirective {
  private readonly gaService = inject(GoogleAnalyticsService);
  private readonly el = inject(ElementRef);

  @Input() gaClick!: string; // Element name to track
  @Input() gaClickType: 'button' | 'link' | 'icon' | 'menu' = 'button';
  @Input() gaClickLocation?: string; // Optional location context

  @HostListener('click', ['$event'])
  onClick(event: Event): void {
    if (this.gaClick) {
      this.gaService.trackClick(
        this.gaClick,
        this.gaClickType,
        this.gaClickLocation
      );
    }
  }
}

