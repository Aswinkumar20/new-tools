import {
  Directive,
  ElementRef,
  Inject,
  Input,
  OnInit,
  OnDestroy,
  OnChanges,
  SimpleChanges,
  PLATFORM_ID,
  Renderer2,
  HostListener,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/**
 * Lightweight body-level tooltip. Hides immediately when the pointer leaves the host,
 * on click/blur/scroll, and never sticks after the cursor moves away.
 */
@Directive({
  selector: '[appTooltip]',
  standalone: true,
})
export class TooltipDirective implements OnInit, OnDestroy, OnChanges {
  @Input('appTooltip') tooltipText = '';
  @Input() tooltipPosition: 'top' | 'bottom' | 'left' | 'right' = 'top';
  /** Delay before show (ms). Default 280 avoids flicker while moving across controls. */
  @Input() tooltipDelay = 280;
  @Input() tooltipMultiline = false;

  private tooltipElement: HTMLElement | null = null;
  private showTimeout: ReturnType<typeof setTimeout> | null = null;
  private isVisible = false;
  private isPointerInside = false;
  private readonly isBrowser: boolean;
  private static active: TooltipDirective | null = null;

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

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.isBrowser || !changes['tooltipText']) return;
    if (this.tooltipElement) {
      this.renderer.setProperty(this.tooltipElement, 'textContent', this.tooltipText || '');
      if (!this.tooltipText) this.hideTooltip();
    } else if (this.tooltipText) {
      this.createTooltip();
    }
  }

  ngOnDestroy(): void {
    if (TooltipDirective.active === this) {
      TooltipDirective.active = null;
    }
    this.clearTimeouts();
    this.removeTooltip();
  }

  @HostListener('pointerenter')
  onPointerEnter(): void {
    if (!this.isBrowser || !this.tooltipText) return;
    this.isPointerInside = true;
    this.clearTimeouts();
    if (!this.tooltipElement) this.createTooltip();
    this.showTimeout = setTimeout(() => {
      // Only show if the pointer is still over the host
      if (!this.isPointerInside || !this.tooltipText) return;
      this.showTooltip();
    }, Math.max(0, this.tooltipDelay));
  }

  @HostListener('pointerleave')
  onPointerLeave(): void {
    if (!this.isBrowser) return;
    this.isPointerInside = false;
    this.hideTooltip();
  }

  @HostListener('focus')
  onFocus(): void {
    if (!this.isBrowser || !this.tooltipText) return;
    this.isPointerInside = true;
    this.clearTimeouts();
    if (!this.tooltipElement) this.createTooltip();
    this.showTimeout = setTimeout(() => {
      if (!this.isPointerInside || !this.tooltipText) return;
      this.showTooltip();
    }, Math.max(0, this.tooltipDelay));
  }

  @HostListener('blur')
  onBlur(): void {
    if (!this.isBrowser) return;
    this.isPointerInside = false;
    this.hideTooltip();
  }

  /** Dismiss on activate so tooltips never stick after click / file dialog. */
  @HostListener('click')
  @HostListener('pointerdown')
  onActivate(): void {
    if (!this.isBrowser) return;
    this.hideTooltip();
  }

  @HostListener('keydown.escape')
  onEscape(): void {
    if (!this.isBrowser) return;
    this.isPointerInside = false;
    this.hideTooltip();
  }

  @HostListener('window:blur')
  @HostListener('document:visibilitychange')
  @HostListener('window:scroll')
  @HostListener('window:wheel')
  onViewportChange(): void {
    if (!this.isBrowser) return;
    this.hideTooltip();
  }

  private createTooltip(): void {
    if (!this.isBrowser || !this.tooltipText || this.tooltipElement) return;

    this.tooltipElement = this.renderer.createElement('span');
    this.renderer.addClass(this.tooltipElement, 'app-tooltip');
    this.renderer.setAttribute(this.tooltipElement, 'role', 'tooltip');
    this.renderer.setProperty(this.tooltipElement, 'textContent', this.tooltipText);
    this.applyTooltipStyles();
    this.renderer.addClass(this.tooltipElement, `tooltip-${this.tooltipPosition}`);
    this.renderer.appendChild(document.body, this.tooltipElement);
  }

  private applyTooltipStyles(): void {
    if (!this.isBrowser || !this.tooltipElement) return;

    const isDark = document.documentElement.dataset['theme'] === 'dark';
    const bgColor = isDark ? 'rgba(241, 245, 249, 0.96)' : 'rgba(15, 23, 42, 0.94)';
    const textColor = isDark ? '#0f172a' : '#ffffff';

    this.renderer.setStyle(this.tooltipElement, 'position', 'fixed');
    this.renderer.setStyle(this.tooltipElement, 'z-index', '99999');
    this.renderer.setStyle(this.tooltipElement, 'pointer-events', 'none');
    this.renderer.setStyle(this.tooltipElement, 'opacity', '0');
    this.renderer.setStyle(this.tooltipElement, 'visibility', 'hidden');
    this.renderer.setStyle(this.tooltipElement, 'transition', 'opacity 0.12s ease, visibility 0.12s ease');
    this.renderer.setStyle(this.tooltipElement, 'padding', '0.4rem 0.65rem');
    this.renderer.setStyle(this.tooltipElement, 'background', bgColor);
    this.renderer.setStyle(this.tooltipElement, 'color', textColor);
    this.renderer.setStyle(this.tooltipElement, 'font-size', '0.75rem');
    this.renderer.setStyle(this.tooltipElement, 'font-weight', '500');
    this.renderer.setStyle(this.tooltipElement, 'line-height', '1.35');
    this.renderer.setStyle(this.tooltipElement, 'border-radius', '6px');
    this.renderer.setStyle(this.tooltipElement, 'box-shadow', '0 4px 12px rgba(0, 0, 0, 0.22)');
    this.renderer.setStyle(this.tooltipElement, 'letter-spacing', '0.01em');
    if (this.tooltipMultiline) {
      this.renderer.setStyle(this.tooltipElement, 'white-space', 'normal');
      this.renderer.setStyle(this.tooltipElement, 'max-width', '260px');
      this.renderer.setStyle(this.tooltipElement, 'text-align', 'left');
    } else {
      this.renderer.setStyle(this.tooltipElement, 'white-space', 'nowrap');
      this.renderer.setStyle(this.tooltipElement, 'max-width', 'min(90vw, 320px)');
      this.renderer.setStyle(this.tooltipElement, 'overflow', 'hidden');
      this.renderer.setStyle(this.tooltipElement, 'text-overflow', 'ellipsis');
    }
  }

  private showTooltip(): void {
    if (!this.tooltipElement || !this.isPointerInside) return;

    if (TooltipDirective.active && TooltipDirective.active !== this) {
      TooltipDirective.active.hideTooltip();
    }
    TooltipDirective.active = this;

    this.updateTooltipPosition();
    this.renderer.setStyle(this.tooltipElement, 'opacity', '1');
    this.renderer.setStyle(this.tooltipElement, 'visibility', 'visible');
    this.isVisible = true;
  }

  private hideTooltip(): void {
    this.clearTimeouts();
    if (TooltipDirective.active === this) {
      TooltipDirective.active = null;
    }
    if (!this.tooltipElement) {
      this.isVisible = false;
      return;
    }
    this.renderer.setStyle(this.tooltipElement, 'opacity', '0');
    this.renderer.setStyle(this.tooltipElement, 'visibility', 'hidden');
    this.isVisible = false;
  }

  private updateTooltipPosition(): void {
    if (!this.tooltipElement) return;

    // Measure while hidden but in DOM
    this.renderer.setStyle(this.tooltipElement, 'visibility', 'hidden');
    this.renderer.setStyle(this.tooltipElement, 'opacity', '0');
    const rect = this.el.nativeElement.getBoundingClientRect();
    const tooltipRect = this.tooltipElement.getBoundingClientRect();

    let left = 0;
    let top = 0;
    const gap = 6;

    switch (this.tooltipPosition) {
      case 'top':
        left = rect.left + rect.width / 2 - tooltipRect.width / 2;
        top = rect.top - tooltipRect.height - gap;
        break;
      case 'bottom':
        left = rect.left + rect.width / 2 - tooltipRect.width / 2;
        top = rect.top + rect.height + gap;
        break;
      case 'left':
        left = rect.left - tooltipRect.width - gap;
        top = rect.top + rect.height / 2 - tooltipRect.height / 2;
        break;
      case 'right':
        left = rect.left + rect.width + gap;
        top = rect.top + rect.height / 2 - tooltipRect.height / 2;
        break;
    }

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    left = Math.max(8, Math.min(left, vw - tooltipRect.width - 8));
    top = Math.max(8, Math.min(top, vh - tooltipRect.height - 8));

    this.renderer.setStyle(this.tooltipElement, 'left', `${left}px`);
    this.renderer.setStyle(this.tooltipElement, 'top', `${top}px`);
  }

  private clearTimeouts(): void {
    if (this.showTimeout) {
      clearTimeout(this.showTimeout);
      this.showTimeout = null;
    }
  }

  private removeTooltip(): void {
    if (this.tooltipElement && this.isBrowser) {
      this.renderer.removeChild(document.body, this.tooltipElement);
      this.tooltipElement = null;
    }
  }
}
