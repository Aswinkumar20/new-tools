import {
  Directive,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  Renderer2,
} from '@angular/core';

/**
 * Watches stat value spans inside the host and shows a styled tooltip on hover
 * when the displayed value is truncated (ellipsis).
 */
@Directive({
  selector: '[appStatValueTooltipHost]',
  standalone: true,
})
export class StatValueTooltipHostDirective implements OnInit, OnDestroy {
  private mutationObserver?: MutationObserver;
  private readonly boundElements = new Map<HTMLElement, ResizeObserver>();
  private tooltipElement: HTMLElement | null = null;
  private activeElement: HTMLElement | null = null;
  private hideTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly host: ElementRef<HTMLElement>,
    private readonly renderer: Renderer2,
  ) {}

  ngOnInit(): void {
    this.scan(this.host.nativeElement);
    this.mutationObserver = new MutationObserver(() => {
      this.scan(this.host.nativeElement);
    });
    this.mutationObserver.observe(this.host.nativeElement, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }

  ngOnDestroy(): void {
    this.mutationObserver?.disconnect();
    for (const observer of this.boundElements.values()) {
      observer.disconnect();
    }
    this.boundElements.clear();
    this.removeTooltip();
  }

  @HostListener('mouseover', ['$event'])
  onMouseOver(event: MouseEvent): void {
    const target = (event.target as HTMLElement | null)?.closest?.(
      'span[class*="__stat-value"]',
    ) as HTMLElement | null;
    if (!target || !this.isTruncated(target)) {
      return;
    }
    this.showTooltip(target, event);
  }

  @HostListener('mouseout', ['$event'])
  onMouseOut(event: MouseEvent): void {
    const related = event.relatedTarget as HTMLElement | null;
    if (related?.closest?.('.app-stat-tooltip')) {
      return;
    }
    this.scheduleHide();
  }

  private scan(root: HTMLElement): void {
    root.querySelectorAll('span[class*="__stat-value"]').forEach(el => {
      this.bindElement(el as HTMLElement);
    });
  }

  private bindElement(el: HTMLElement): void {
    if (this.boundElements.has(el)) {
      return;
    }
    if (typeof ResizeObserver === 'undefined') {
      return;
    }
    const observer = new ResizeObserver(() => {
      if (!this.isTruncated(el) && this.activeElement === el) {
        this.hideTooltip();
      }
    });
    observer.observe(el);
    this.boundElements.set(el, observer);
  }

  private isTruncated(el: HTMLElement): boolean {
    return el.scrollWidth > el.clientWidth + 1;
  }

  private showTooltip(el: HTMLElement, event: MouseEvent): void {
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
      this.hideTimeout = null;
    }
    this.activeElement = el;
    const text = el.textContent?.trim() ?? '';
    if (!text) {
      return;
    }
    if (!this.tooltipElement) {
      this.tooltipElement = this.renderer.createElement('span');
      this.renderer.addClass(this.tooltipElement, 'app-stat-tooltip');
      this.renderer.appendChild(document.body, this.tooltipElement);
    }
    if (!this.tooltipElement) {
      return;
    }
    this.renderer.setProperty(this.tooltipElement, 'textContent', text);
    this.applyTooltipStyles(this.tooltipElement);
    this.positionTooltip(el);
    this.renderer.setStyle(this.tooltipElement, 'opacity', '1');
    this.renderer.setStyle(this.tooltipElement, 'visibility', 'visible');
  }

  private scheduleHide(): void {
    this.hideTimeout = setTimeout(() => this.hideTooltip(), 80);
  }

  private hideTooltip(): void {
    if (this.tooltipElement) {
      this.renderer.setStyle(this.tooltipElement, 'opacity', '0');
      this.renderer.setStyle(this.tooltipElement, 'visibility', 'hidden');
    }
    this.activeElement = null;
  }

  private removeTooltip(): void {
    if (this.tooltipElement) {
      this.renderer.removeChild(document.body, this.tooltipElement);
      this.tooltipElement = null;
    }
  }

  private positionTooltip(anchor: HTMLElement): void {
    if (!this.tooltipElement) {
      return;
    }
    const rect = anchor.getBoundingClientRect();
    const tooltipRect = this.tooltipElement.getBoundingClientRect();
    let left = rect.left + rect.width / 2 - tooltipRect.width / 2;
    let top = rect.top - tooltipRect.height - 8;
    const pad = 8;
    left = Math.max(pad, Math.min(left, window.innerWidth - tooltipRect.width - pad));
    top = Math.max(pad, top);
    this.renderer.setStyle(this.tooltipElement, 'left', `${left}px`);
    this.renderer.setStyle(this.tooltipElement, 'top', `${top}px`);
  }

  private applyTooltipStyles(el: HTMLElement): void {
    const isDark = document.documentElement.dataset['theme'] === 'dark';
    const bg = isDark ? 'rgba(241, 245, 249, 0.95)' : 'rgba(15, 23, 42, 0.95)';
    const color = isDark ? '#0f172a' : '#ffffff';
    const styles: Record<string, string> = {
      position: 'fixed',
      'z-index': '99999',
      'pointer-events': 'none',
      opacity: '0',
      visibility: 'hidden',
      transition: 'opacity 0.15s ease, visibility 0.15s ease',
      padding: '0.4rem 0.65rem',
      background: bg,
      color,
      'font-size': '0.75rem',
      'font-weight': '500',
      'max-width': 'min(90vw, 320px)',
      'word-break': 'break-all',
      'white-space': 'normal',
      'border-radius': '6px',
      'box-shadow': '0 4px 12px rgba(0, 0, 0, 0.25)',
    };
    for (const [key, value] of Object.entries(styles)) {
      this.renderer.setStyle(el, key, value);
    }
  }
}
