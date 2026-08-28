import {
  Directive,
  ElementRef,
  Inject,
  Input,
  OnInit,
  OnDestroy,
  PLATFORM_ID,
  Renderer2,
  HostListener,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Directive({
  selector: '[appTooltip]',
  standalone: true,
})
export class TooltipDirective implements OnInit, OnDestroy {
  @Input('appTooltip') tooltipText: string = '';
  @Input() tooltipPosition: 'top' | 'bottom' | 'left' | 'right' = 'top';
  @Input() tooltipDelay: number = 0;
  @Input() tooltipMultiline = false;

  private tooltipElement: HTMLElement | null = null;
  private showTimeout: ReturnType<typeof setTimeout> | null = null;
  private hideTimeout: ReturnType<typeof setTimeout> | null = null;
  private isVisible = false;
  private readonly isBrowser: boolean;

  constructor(
    private readonly el: ElementRef<HTMLElement>,
    private readonly renderer: Renderer2,
    @Inject(PLATFORM_ID) platformId: object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  ngOnInit(): void {
    if (!this.isBrowser || !this.tooltipText) return;
    this.createTooltip();
  }

  ngOnDestroy(): void {
    this.clearTimeouts();
    this.removeTooltip();
  }

  @HostListener('mouseenter')
  onMouseEnter(): void {
    if (!this.isBrowser || !this.tooltipElement || !this.tooltipText) return;

    this.clearTimeouts();

    this.showTimeout = setTimeout(() => {
      this.showTooltip();
    }, this.tooltipDelay);
  }

  @HostListener('mouseleave')
  onMouseLeave(): void {
    if (!this.isBrowser) return;
    this.scheduleHide();
  }

  @HostListener('focus')
  onFocus(): void {
    if (!this.isBrowser || !this.tooltipElement || !this.tooltipText) return;
    this.clearTimeouts();
    this.showTimeout = setTimeout(() => {
      this.showTooltip();
    }, this.tooltipDelay);
  }

  @HostListener('blur')
  onBlur(): void {
    if (!this.isBrowser) return;
    this.scheduleHide();
  }

  @HostListener('mousemove')
  onMouseMove(): void {
    if (!this.isBrowser) return;
    if (this.isVisible && this.tooltipElement) {
      this.updateTooltipPosition();
    }
  }

  private createTooltip(): void {
    if (!this.isBrowser || !this.tooltipText) return;

    this.tooltipElement = this.renderer.createElement('span');
    this.renderer.addClass(this.tooltipElement, 'app-tooltip');
    this.renderer.setProperty(this.tooltipElement, 'textContent', this.tooltipText);

    // Apply all styles
    this.applyTooltipStyles();

    // Add position class
    this.renderer.addClass(this.tooltipElement, `tooltip-${this.tooltipPosition}`);

    this.renderer.appendChild(document.body, this.tooltipElement);
  }

  private applyTooltipStyles(): void {
    if (!this.isBrowser || !this.tooltipElement) return;

    const isDark = document.documentElement.dataset['theme'] === 'dark';
    const bgColor = isDark ? 'rgba(241, 245, 249, 0.95)' : 'rgba(15, 23, 42, 0.95)';
    const textColor = isDark ? '#0f172a' : '#ffffff';

    this.renderer.setStyle(this.tooltipElement, 'position', 'fixed');
    this.renderer.setStyle(this.tooltipElement, 'z-index', '99999');
    this.renderer.setStyle(this.tooltipElement, 'pointer-events', 'none');
    this.renderer.setStyle(this.tooltipElement, 'opacity', '0');
    this.renderer.setStyle(this.tooltipElement, 'visibility', 'hidden');
    this.renderer.setStyle(this.tooltipElement, 'transition', 'opacity 0.2s ease, visibility 0.2s ease, transform 0.2s ease');
    this.renderer.setStyle(this.tooltipElement, 'padding', '0.5rem 0.75rem');
    this.renderer.setStyle(this.tooltipElement, 'background', bgColor);
    this.renderer.setStyle(this.tooltipElement, 'color', textColor);
    this.renderer.setStyle(this.tooltipElement, 'font-size', '0.75rem');
    this.renderer.setStyle(this.tooltipElement, 'font-weight', '500');
    if (this.tooltipMultiline) {
      this.renderer.setStyle(this.tooltipElement, 'white-space', 'normal');
      this.renderer.setStyle(this.tooltipElement, 'max-width', '280px');
      this.renderer.setStyle(this.tooltipElement, 'line-height', '1.45');
      this.renderer.setStyle(this.tooltipElement, 'text-align', 'left');
    } else {
      this.renderer.setStyle(this.tooltipElement, 'white-space', 'nowrap');
    }
    this.renderer.setStyle(this.tooltipElement, 'border-radius', '6px');
    this.renderer.setStyle(this.tooltipElement, 'box-shadow', '0 4px 12px rgba(0, 0, 0, 0.25)');
    this.renderer.setStyle(this.tooltipElement, 'letter-spacing', '0.02em');
    this.renderer.setStyle(this.tooltipElement, 'backdrop-filter', 'blur(8px)');
    this.renderer.setStyle(this.tooltipElement, '-webkit-backdrop-filter', 'blur(8px)');

    // Set initial transform based on position
    this.renderer.setStyle(this.tooltipElement, 'transform', this.getInitialTransform());
  }

  private showTooltip(): void {
    if (!this.tooltipElement) return;

    this.updateTooltipPosition();

    // Force reflow to ensure position is set before showing
    const _ = this.tooltipElement.offsetHeight;

    this.renderer.setStyle(this.tooltipElement, 'opacity', '1');
    this.renderer.setStyle(this.tooltipElement, 'visibility', 'visible');

    // Reset transform based on position
    const resetTransform = this.tooltipPosition === 'top' || this.tooltipPosition === 'bottom'
      ? 'translateY(0)'
      : 'translateX(0)';
    this.renderer.setStyle(this.tooltipElement, 'transform', resetTransform);

    this.isVisible = true;
  }

  private hideTooltip(): void {
    if (!this.tooltipElement) return;

    this.renderer.setStyle(this.tooltipElement, 'opacity', '0');
    this.renderer.setStyle(this.tooltipElement, 'visibility', 'hidden');

    // Reset transform after transition
    setTimeout(() => {
      if (this.tooltipElement) {
        this.renderer.setStyle(this.tooltipElement, 'transform', this.getInitialTransform());
      }
    }, 200);

    this.isVisible = false;
  }

  private updateTooltipPosition(): void {
    if (!this.tooltipElement) return;

    const rect = this.el.nativeElement.getBoundingClientRect();
    const tooltipRect = this.tooltipElement.getBoundingClientRect();

    // Use getBoundingClientRect which already accounts for scroll position
    // No need to add scrollX/scrollY since we're using position: fixed
    let left = 0;
    let top = 0;

    switch (this.tooltipPosition) {
      case 'top':
        left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
        top = rect.top - tooltipRect.height - 8;
        break;
      case 'bottom':
        left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
        top = rect.top + rect.height + 8;
        break;
      case 'left':
        left = rect.left - tooltipRect.width - 8;
        top = rect.top + (rect.height / 2) - (tooltipRect.height / 2);
        break;
      case 'right':
        left = rect.left + rect.width + 8;
        top = rect.top + (rect.height / 2) - (tooltipRect.height / 2);
        break;
    }

    // Boundary checks to keep tooltip in viewport
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    if (left < 8) left = 8;
    if (left + tooltipRect.width > viewportWidth - 8) {
      left = viewportWidth - tooltipRect.width - 8;
    }
    if (top < 8) top = 8;
    if (top + tooltipRect.height > viewportHeight - 8) {
      top = viewportHeight - tooltipRect.height - 8;
    }

    this.renderer.setStyle(this.tooltipElement, 'left', `${left}px`);
    this.renderer.setStyle(this.tooltipElement, 'top', `${top}px`);
  }

  private getInitialTransform(): string {
    switch (this.tooltipPosition) {
      case 'top':
        return 'translateY(-4px)';
      case 'bottom':
        return 'translateY(4px)';
      case 'left':
        return 'translateX(-4px)';
      case 'right':
        return 'translateX(4px)';
      default:
        return 'translateY(-4px)';
    }
  }

  private scheduleHide(): void {
    this.clearTimeouts();

    this.hideTimeout = setTimeout(() => {
      this.hideTooltip();
    }, 100);
  }

  private clearTimeouts(): void {
    if (this.showTimeout) {
      clearTimeout(this.showTimeout);
      this.showTimeout = null;
    }
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
      this.hideTimeout = null;
    }
  }

  private removeTooltip(): void {
    if (this.tooltipElement && this.isBrowser) {
      this.renderer.removeChild(document.body, this.tooltipElement);
      this.tooltipElement = null;
    }
  }
}
