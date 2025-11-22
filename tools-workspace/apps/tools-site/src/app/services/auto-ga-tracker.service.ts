import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router, NavigationEnd, ActivatedRoute } from '@angular/router';
import { filter } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

/**
 * Automatic Google Analytics Tracker
 * Automatically tracks tool usage based on routes - no need to add tracking to each component!
 */
@Injectable({
  providedIn: 'root',
})
export class AutoGATrackerService {
  private readonly toolRouteMap = new Map<string, { name: string; category: string }>();
  private currentTool: { name: string; category: string } | null = null;

  constructor(
    @Inject(PLATFORM_ID) private readonly platformId: Object,
    private readonly router: Router
  ) {
    if (isPlatformBrowser(this.platformId)) {
      this.initializeRouteMap();
      this.setupRouteTracking();
    }
  }

  /**
   * Initialize route-to-tool mapping
   * Maps all routes to their tool names and categories
   */
  private initializeRouteMap(): void {
    // Text Utilities
    this.addToolRoute('text-utilities/character-counter', 'character-counter', 'text-utilities');
    this.addToolRoute('text-utilities/text-case-convertor', 'text-case-convertor', 'text-utilities');
    this.addToolRoute('text-utilities/text-to-ascii', 'text-to-ascii', 'text-utilities');
    this.addToolRoute('text-utilities/remove-duplicate-lines', 'remove-duplicate-lines', 'text-utilities');
    this.addToolRoute('text-utilities/text-reversal-and-palindrome-checker', 'text-reversal-and-palindrome-checker', 'text-utilities');
    this.addToolRoute('text-utilities/base64-encode-and-decode', 'base64-encode-and-decode', 'text-utilities');
    this.addToolRoute('text-utilities/slug-generator', 'slug-generator', 'text-utilities');
    this.addToolRoute('text-utilities/text-difference', 'text-difference', 'text-utilities');
    this.addToolRoute('text-utilities/code-merge', 'code-merge', 'text-utilities');

    // File Viewers
    this.addToolRoute('file-viewers/image-viewer', 'image-viewer', 'file-viewers');
    this.addToolRoute('file-viewers/pdf-viewer', 'pdf-viewer', 'file-viewers');
    this.addToolRoute('file-viewers/word-viewer', 'word-viewer', 'file-viewers');
    this.addToolRoute('file-viewers/powerpoint-viewer', 'powerpoint-viewer', 'file-viewers');
    this.addToolRoute('file-viewers/text-file-viewer', 'text-file-viewer', 'file-viewers');
    this.addToolRoute('file-viewers/markdown-previewer', 'markdown-previewer', 'file-viewers');
    this.addToolRoute('file-viewers/excel-viewer', 'excel-viewer', 'file-viewers');
    this.addToolRoute('file-viewers/log-viewer', 'log-viewer', 'file-viewers');
    this.addToolRoute('file-viewers/audio-player', 'audio-player', 'file-viewers');
    this.addToolRoute('file-viewers/video-player', 'video-player', 'file-viewers');
    this.addToolRoute('file-viewers/font-viewer', 'font-viewer', 'file-viewers');
    this.addToolRoute('file-viewers/3d-model-viewer', '3d-model-viewer', 'file-viewers');
    this.addToolRoute('file-viewers/archive-viewer', 'archive-viewer', 'file-viewers');

    // Data Converters
    this.addToolRoute('data-converters/json-formatter-beautifier-validator', 'json-formatter-beautifier-validator', 'data-converters');
    this.addToolRoute('data-converters/csv-to-json-json-to-csv', 'csv-to-json-json-to-csv', 'data-converters');
    this.addToolRoute('data-converters/yaml-to-json-json-to-yaml', 'yaml-to-json-json-to-yaml', 'data-converters');
    this.addToolRoute('data-converters/html-table-to-json', 'html-table-to-json', 'data-converters');
    this.addToolRoute('data-converters/markdown-to-html', 'markdown-to-html', 'data-converters');
    this.addToolRoute('data-converters/json-linter-viewer', 'json-linter-viewer', 'data-converters');
    this.addToolRoute('data-converters/excel-to-json', 'excel-to-json', 'data-converters');
    this.addToolRoute('data-converters/json-parser', 'json-parser', 'data-converters');

    // Math & Date Utils
    this.addToolRoute('math-date-utils/unit-converter', 'unit-converter', 'math-date-utils');
    this.addToolRoute('math-date-utils/number-to-words', 'number-to-words', 'math-date-utils');
    this.addToolRoute('math-date-utils/percentage-calculator', 'percentage-calculator', 'math-date-utils');
    this.addToolRoute('math-date-utils/age-calculator', 'age-calculator', 'math-date-utils');
    this.addToolRoute('math-date-utils/date-difference-calculator', 'date-difference-calculator', 'math-date-utils');
    this.addToolRoute('math-date-utils/simple-compound-interest-calculator', 'simple-compound-interest-calculator', 'math-date-utils');
    this.addToolRoute('math-date-utils/bmi-calculator', 'bmi-calculator', 'math-date-utils');
    this.addToolRoute('math-date-utils/loan-emi-calculator', 'loan-emi-calculator', 'math-date-utils');
    this.addToolRoute('math-date-utils/tip-calculator', 'tip-calculator', 'math-date-utils');
    this.addToolRoute('math-date-utils/currency-converter', 'currency-converter', 'math-date-utils');
    this.addToolRoute('math-date-utils/fraction-calculator', 'fraction-calculator', 'math-date-utils');
    this.addToolRoute('math-date-utils/date-to-day-of-week', 'date-to-day-of-week', 'math-date-utils');
    this.addToolRoute('math-date-utils/zodiac-finder', 'zodiac-finder', 'math-date-utils');

    // PDF Tools
    this.addToolRoute('pdf-tools/pdf-viewer', 'pdf-viewer', 'pdf-tools');
    this.addToolRoute('pdf-tools/merge-pdfs', 'merge-pdfs', 'pdf-tools');
    this.addToolRoute('pdf-tools/split-pdfs', 'split-pdfs', 'pdf-tools');
    this.addToolRoute('pdf-tools/delete-pages', 'delete-pages', 'pdf-tools');
    this.addToolRoute('pdf-tools/rotate-pages', 'rotate-pages', 'pdf-tools');
    this.addToolRoute('pdf-tools/reorder-pages', 'reorder-pages', 'pdf-tools');
    this.addToolRoute('pdf-tools/extract-pages', 'extract-pages', 'pdf-tools');
    this.addToolRoute('pdf-tools/compress-pdf', 'compress-pdf', 'pdf-tools');
    this.addToolRoute('pdf-tools/create-pdf-from-html', 'create-pdf-from-html', 'pdf-tools');
    this.addToolRoute('pdf-tools/tables-charts-to-pdf', 'tables-charts-to-pdf', 'pdf-tools');
    this.addToolRoute('pdf-tools/resume-invoice-generator', 'resume-invoice-generator', 'pdf-tools');
    this.addToolRoute('pdf-tools/text-to-pdf', 'text-to-pdf', 'pdf-tools');
    this.addToolRoute('pdf-tools/screenshot-to-pdf', 'screenshot-to-pdf', 'pdf-tools');
    this.addToolRoute('pdf-tools/annotate-pdf', 'annotate-pdf', 'pdf-tools');
    this.addToolRoute('pdf-tools/highlight-text', 'highlight-text', 'pdf-tools');
    this.addToolRoute('pdf-tools/add-signature', 'add-signature', 'pdf-tools');
    this.addToolRoute('pdf-tools/fill-pdf-forms', 'fill-pdf-forms', 'pdf-tools');
    this.addToolRoute('pdf-tools/pdf-metadata-editor', 'pdf-metadata-editor', 'pdf-tools');
    this.addToolRoute('pdf-tools/add-watermark', 'add-watermark', 'pdf-tools');
    this.addToolRoute('pdf-tools/pdf-to-base64', 'pdf-to-base64', 'pdf-tools');
    this.addToolRoute('pdf-tools/password-protect-pdf', 'password-protect-pdf', 'pdf-tools');
    this.addToolRoute('pdf-tools/flatten-pdf-forms', 'flatten-pdf-forms', 'pdf-tools');

    // Image & Color Tools
    this.addToolRoute('image-color-tools/image-to-base64', 'image-to-base64', 'image-color-tools');
    this.addToolRoute('image-color-tools/image-resizer', 'image-resizer', 'image-color-tools');
    this.addToolRoute('image-color-tools/image-compressor', 'image-compressor', 'image-color-tools');
    this.addToolRoute('image-color-tools/color-picker', 'color-picker', 'image-color-tools');
    this.addToolRoute('image-color-tools/hex-to-rgb', 'hex-to-rgb', 'image-color-tools');
    this.addToolRoute('image-color-tools/gradient-generator', 'gradient-generator', 'image-color-tools');
    this.addToolRoute('image-color-tools/palette-generator', 'palette-generator', 'image-color-tools');
    this.addToolRoute('image-color-tools/image-to-text', 'image-to-text', 'image-color-tools');
    this.addToolRoute('image-color-tools/favicon-generator', 'favicon-generator', 'image-color-tools');
    this.addToolRoute('image-color-tools/drawing-pad', 'drawing-pad', 'image-color-tools');

    // Code & File Tools
    this.addToolRoute('code-file-tools/html-minifier', 'html-minifier', 'code-file-tools');
    this.addToolRoute('code-file-tools/css-minifier', 'css-minifier', 'code-file-tools');
    this.addToolRoute('code-file-tools/javascript-minifier', 'javascript-minifier', 'code-file-tools');
    this.addToolRoute('code-file-tools/html-entity-encoder', 'html-entity-encoder', 'code-file-tools');
    this.addToolRoute('code-file-tools/clipboard-viewer', 'clipboard-viewer', 'code-file-tools');
    this.addToolRoute('code-file-tools/clipboard-history', 'clipboard-history', 'code-file-tools');
    this.addToolRoute('code-file-tools/file-metadata-viewer', 'file-metadata-viewer', 'code-file-tools');
    this.addToolRoute('code-file-tools/markdown-to-pdf', 'markdown-to-pdf', 'code-file-tools');
    this.addToolRoute('code-file-tools/html-table-exporter', 'html-table-exporter', 'code-file-tools');

    // Dev & Design Tools
    this.addToolRoute('dev-design-tools/css-gradient-generator', 'css-gradient-generator', 'dev-design-tools');
    this.addToolRoute('dev-design-tools/box-shadow-generator', 'box-shadow-generator', 'dev-design-tools');
    this.addToolRoute('dev-design-tools/border-radius-preview', 'border-radius-preview', 'dev-design-tools');
    this.addToolRoute('dev-design-tools/pixel-to-rem', 'pixel-to-rem', 'dev-design-tools');
    this.addToolRoute('dev-design-tools/responsive-breakpoint-tester', 'responsive-breakpoint-tester', 'dev-design-tools');
    this.addToolRoute('dev-design-tools/viewport-size-detector', 'viewport-size-detector', 'dev-design-tools');
    this.addToolRoute('dev-design-tools/postman-lite', 'postman-lite', 'dev-design-tools');
    this.addToolRoute('dev-design-tools/cors-test-tool', 'cors-test-tool', 'dev-design-tools');
    this.addToolRoute('dev-design-tools/http-header-decoder', 'http-header-decoder', 'dev-design-tools');
    this.addToolRoute('dev-design-tools/websocket-client', 'websocket-client', 'dev-design-tools');
    this.addToolRoute('dev-design-tools/http-request-generator', 'http-request-generator', 'dev-design-tools');
    this.addToolRoute('dev-design-tools/mock-json-generator', 'mock-json-generator', 'dev-design-tools');

    // Testing Tools
    this.addToolRoute('testing-tools/json-schema-validator', 'json-schema-validator', 'testing-tools');
    this.addToolRoute('testing-tools/password-rule-validator', 'password-rule-validator', 'testing-tools');
    this.addToolRoute('testing-tools/email-url-ip-checker', 'email-url-ip-checker', 'testing-tools');
    this.addToolRoute('testing-tools/user-agent-parser', 'user-agent-parser', 'testing-tools');
    this.addToolRoute('testing-tools/credit-card-validator', 'credit-card-validator', 'testing-tools');
    this.addToolRoute('testing-tools/jwt-decoder', 'jwt-decoder', 'testing-tools');

    // Security Tools
    this.addToolRoute('security-tools/hash-generator', 'hash-generator', 'security-tools');
    this.addToolRoute('security-tools/uuid-generator', 'uuid-generator', 'security-tools');
    this.addToolRoute('security-tools/password-strength-checker', 'password-strength-checker', 'security-tools');
    this.addToolRoute('security-tools/random-password-generator', 'random-password-generator', 'security-tools');
    this.addToolRoute('security-tools/text-encrypt-decrypt', 'text-encrypt-decrypt', 'security-tools');
    this.addToolRoute('security-tools/secure-clipboard', 'secure-clipboard', 'security-tools');
    this.addToolRoute('security-tools/private-notes', 'private-notes', 'security-tools');

    // Media Tools
    this.addToolRoute('media-tools/voice-recorder', 'voice-recorder', 'media-tools');
    this.addToolRoute('media-tools/audio-player', 'audio-player', 'media-tools');
    this.addToolRoute('media-tools/audio-trimmer', 'audio-trimmer', 'media-tools');
    this.addToolRoute('media-tools/video-to-gif', 'video-to-gif', 'media-tools');
    this.addToolRoute('media-tools/webcam-snapshot', 'webcam-snapshot', 'media-tools');

    // Browser Utils
    this.addToolRoute('browser-utils/screen-resolution-info', 'screen-resolution-info', 'browser-utils');
    this.addToolRoute('browser-utils/battery-status-viewer', 'battery-status-viewer', 'browser-utils');
    this.addToolRoute('browser-utils/device-orientation-logger', 'device-orientation-logger', 'browser-utils');
    this.addToolRoute('browser-utils/storage-viewer', 'storage-viewer', 'browser-utils');
    this.addToolRoute('browser-utils/cookie-editor', 'cookie-editor', 'browser-utils');
    this.addToolRoute('browser-utils/network-speed-test', 'network-speed-test', 'browser-utils');

    // Fun Tools
    this.addToolRoute('fun-tools/qr-code-generator', 'qr-code-generator', 'fun-tools');
    this.addToolRoute('fun-tools/barcode-generator', 'barcode-generator', 'fun-tools');
    this.addToolRoute('fun-tools/stopwatch-timer', 'stopwatch-timer', 'fun-tools');
    this.addToolRoute('fun-tools/random-number-generator', 'random-number-generator', 'fun-tools');
    this.addToolRoute('fun-tools/coin-toss-dice-roller', 'coin-toss-dice-roller', 'fun-tools');
    this.addToolRoute('fun-tools/lorem-ipsum-generator', 'lorem-ipsum-generator', 'fun-tools');
    this.addToolRoute('fun-tools/timezone-converter', 'timezone-converter', 'fun-tools');
    this.addToolRoute('fun-tools/typing-speed-test', 'typing-speed-test', 'fun-tools');
    this.addToolRoute('fun-tools/pomodoro-timer', 'pomodoro-timer', 'fun-tools');
    this.addToolRoute('fun-tools/flashcard-quiz-generator', 'flashcard-quiz-generator', 'fun-tools');
    this.addToolRoute('fun-tools/motivational-quote-generator', 'motivational-quote-generator', 'fun-tools');
  }

  private addToolRoute(path: string, toolName: string, category: string): void {
    this.toolRouteMap.set(path, { name: toolName, category });
  }

  /**
   * Setup automatic route tracking
   */
  private setupRouteTracking(): void {
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed()
      )
      .subscribe((event: NavigationEnd) => {
        this.trackRouteChange(event.urlAfterRedirects);
      });
  }

  /**
   * Track route change and automatically identify tool
   */
  private trackRouteChange(url: string): void {
    if (!isPlatformBrowser(this.platformId)) return;

    // Remove query params and leading slash
    const cleanPath = url.split('?')[0].replace(/^\//, '');
    
    // Find matching tool
    const toolInfo = this.toolRouteMap.get(cleanPath);
    
    if (toolInfo) {
      this.currentTool = toolInfo;
      this.trackToolView(toolInfo.name, toolInfo.category);
    } else {
      this.currentTool = null;
    }
  }

  /**
   * Track tool view automatically
   */
  private trackToolView(toolName: string, toolCategory: string): void {
    if (!isPlatformBrowser(this.platformId) || !(globalThis as any).gtag) return;

    // Track tool usage
    (globalThis as any).gtag('event', 'tool_usage', {
      event_category: toolCategory,
      event_label: toolName,
      tool_name: toolName,
      tool_category: toolCategory,
      action_type: 'view',
    });

    // Track for popularity
    (globalThis as any).gtag('event', 'tool_view', {
      event_category: 'tool_popularity',
      event_label: toolName,
      tool_name: toolName,
      tool_category: toolCategory,
    });
  }

  /**
   * Get current tool info (for components that need it)
   */
  getCurrentTool(): { name: string; category: string } | null {
    return this.currentTool;
  }

  /**
   * Track tool action (can be called from any component)
   */
  trackAction(actionType: string, metadata?: Record<string, any>): void {
    if (!this.currentTool) return;
    
    if (!isPlatformBrowser(this.platformId) || !(globalThis as any).gtag) return;

    (globalThis as any).gtag('event', 'tool_action', {
      event_category: this.currentTool.category,
      event_label: this.currentTool.name,
      tool_name: this.currentTool.name,
      tool_category: this.currentTool.category,
      action_type: actionType,
      ...metadata,
    });
  }

  /**
   * Track tool completion (can be called from any component)
   */
  trackCompletion(metadata?: Record<string, any>): void {
    if (!this.currentTool) return;
    
    if (!isPlatformBrowser(this.platformId) || !(globalThis as any).gtag) return;

    (globalThis as any).gtag('event', 'tool_completion', {
      event_category: this.currentTool.category,
      event_label: this.currentTool.name,
      tool_name: this.currentTool.name,
      tool_category: this.currentTool.category,
      action_type: 'complete',
      ...metadata,
    });
  }
}

