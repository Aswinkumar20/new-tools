import { ChangeDetectionStrategy, Component, WritableSignal, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Navigation, TooltipDirective, AssetService } from '@tools-workspace/features-home';

interface MinificationResult {
  minified: string;
  originalSize: number;
  minifiedSize: number;
  reduction: number;
  reductionPercentage: number;
}

interface HistoryEntry {
  timestamp: number;
  original: string;
  minified: string;
  reduction: number;
}

type MinifierFormGroup = FormGroup<{
  removeComments: FormControl<boolean>;
  collapseWhitespace: FormControl<boolean>;
  removeAttributeQuotes: FormControl<boolean>;
  removeOptionalTags: FormControl<boolean>;
  removeEmptyAttributes: FormControl<boolean>;
  caseSensitive: FormControl<boolean>;
  minifyCSS: FormControl<boolean>;
  minifyJS: FormControl<boolean>;
  rememberHistory: FormControl<boolean>;
}>;

const SAMPLE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sample HTML Document</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px;
        }
    </style>
</head>
<body>
    <h1>Welcome to HTML Minifier</h1>
    <p>This is a sample HTML document for testing minification.</p>
    <script>
        console.log('Hello, World!');
    </script>
</body>
</html>`;

@Component({
  selector: 'lib-html-minifier',
  standalone: true,
  templateUrl: './html-minifier.html',
  styleUrls: ['./html-minifier.scss'],
  imports: [CommonModule, ReactiveFormsModule, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HtmlMinifierComponent {
  private readonly fb = inject(FormBuilder);
  readonly assetService = inject(AssetService);

  readonly form: MinifierFormGroup = this.fb.group({
    removeComments: this.fb.control(true, { nonNullable: true }),
    collapseWhitespace: this.fb.control(true, { nonNullable: true }),
    removeAttributeQuotes: this.fb.control(false, { nonNullable: true }),
    removeOptionalTags: this.fb.control(false, { nonNullable: true }),
    removeEmptyAttributes: this.fb.control(true, { nonNullable: true }),
    caseSensitive: this.fb.control(true, { nonNullable: true }),
    minifyCSS: this.fb.control(false, { nonNullable: true }),
    minifyJS: this.fb.control(false, { nonNullable: true }),
    rememberHistory: this.fb.control(true, { nonNullable: true })
  });

  readonly inputHtml = signal<string>(SAMPLE_HTML);
  readonly errors = signal<string[]>([]);
  readonly result: WritableSignal<MinificationResult | null> = signal(null);
  readonly history = signal<HistoryEntry[]>([]);
  readonly isProcessing = signal(false);

  readonly hasHistory = computed(() => this.history().length > 0);
  readonly hasResult = computed(() => this.result() !== null);
  readonly hasInput = computed(() => !!this.inputHtml().trim());
  readonly minifiedHtml = computed(() => this.result()?.minified ?? '');
  readonly reductionPercentage = computed(() => this.result()?.reductionPercentage ?? 0);

  readonly Math = Math;

  constructor() {
    // Initial minification
    this.minify();
  }

  onInputChange(value: string): void {
    this.inputHtml.set(value);
    this.minify();
  }

  minify(): void {
    this.errors.set([]);
    this.isProcessing.set(true);

    try {
      const input = this.inputHtml().trim();
      if (!input) {
        this.result.set(null);
        this.isProcessing.set(false);
        return;
      }

      const options = this.form.getRawValue();
      const minified = this.minifyHtml(input, options);
      const originalSize = input.length;
      const minifiedSize = minified.length;
      const reduction = originalSize - minifiedSize;
      const reductionPercentage = originalSize > 0 ? Math.round((reduction / originalSize) * 100) : 0;

      const result: MinificationResult = {
        minified,
        originalSize,
        minifiedSize,
        reduction,
        reductionPercentage
      };

      this.result.set(result);

      if (options.rememberHistory) {
        this.addToHistory(input, minified, reduction);
      }
    } catch (error) {
      this.errors.set([`Minification failed: ${(error as Error)?.message ?? 'Unknown error'}`]);
      this.result.set(null);
    } finally {
      this.isProcessing.set(false);
    }
  }

  private minifyHtml(html: string, options: any): string {
    let result = html;

    // Remove HTML comments
    if (options.removeComments) {
      result = result.replace(/<!--[\s\S]*?-->/g, '');
    }

    // Collapse whitespace
    if (options.collapseWhitespace) {
      // Preserve whitespace in pre, textarea, and script tags
      result = result.replace(/>\s+</g, '><');
      result = result.replace(/\s+/g, ' ');
      result = result.replace(/^\s+|\s+$/g, '');
    }

    // Remove optional tags (simplified)
    if (options.removeOptionalTags) {
      result = result.replace(/<\/?(html|head|body)[^>]*>/gi, '');
    }

    // Remove empty attributes
    if (options.removeEmptyAttributes) {
      result = result.replace(/\s+(\w+)=""/g, '');
      result = result.replace(/\s+(\w+)=''/g, '');
    }

    // Remove attribute quotes where safe
    if (options.removeAttributeQuotes) {
      result = result.replace(/(\w+)="([^"]*)"/g, (match, attr, value) => {
        // Only remove quotes if value doesn't contain spaces or special chars
        if (!/[ =<>"'`]/.test(value)) {
          return `${attr}=${value}`;
        }
        return match;
      });
    }

    // Minify inline CSS
    if (options.minifyCSS) {
      result = result.replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, (match, css) => {
        const minifiedCSS = css
          .replace(/\/\*[\s\S]*?\*\//g, '') // Remove CSS comments
          .replace(/\s+/g, ' ') // Collapse whitespace
          .replace(/;\s*}/g, '}') // Remove semicolon before closing brace
          .replace(/\s*{\s*/g, '{') // Remove spaces around opening brace
          .replace(/;\s*/g, ';') // Remove spaces after semicolons
          .trim();
        return match.replace(css, minifiedCSS);
      });
    }

    // Minify inline JavaScript
    if (options.minifyJS) {
      result = result.replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, (match, js) => {
        const minifiedJS = js
          .replace(/\/\*[\s\S]*?\*\//g, '') // Remove block comments
          .replace(/\/\/.*/g, '') // Remove line comments
          .replace(/\s+/g, ' ') // Collapse whitespace
          .replace(/\s*{\s*/g, '{')
          .replace(/\s*}\s*/g, '}')
          .replace(/\s*;\s*/g, ';')
          .trim();
        return match.replace(js, minifiedJS);
      });
    }

    return result.trim();
  }

  copyInput(): void {
    this.copyToClipboard(this.inputHtml(), 'Input');
  }

  copyOutput(): void {
    this.copyToClipboard(this.minifiedHtml(), 'Output');
  }

  copyToClipboard(text: string, label: string): void {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        // Success - could show toast
      })
      .catch(() => {
        this.errors.set([`Unable to copy ${label} to clipboard.`]);
      });
  }

  downloadMinified(): void {
    const current = this.result();
    if (!current) return;

    const blob = new Blob([current.minified], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'minified.html';
    anchor.click();
    URL.revokeObjectURL(url);
  }

  loadSample(): void {
    this.inputHtml.set(SAMPLE_HTML);
    this.minify();
  }

  clear(): void {
    this.inputHtml.set('');
    this.result.set(null);
    this.errors.set([]);
  }

  applyHistory(entry: HistoryEntry): void {
    this.inputHtml.set(entry.original);
    this.minify();
  }

  clearHistory(): void {
    this.history.set([]);
  }

  removeHistoryEntry(timestamp: number): void {
    this.history.update((entries) => entries.filter((entry) => entry.timestamp !== timestamp));
  }

  private addToHistory(original: string, minified: string, reduction: number): void {
    const entry: HistoryEntry = {
      timestamp: Date.now(),
      original,
      minified,
      reduction
    };
    this.history.update((entries) => {
      const exists = entries.some((e) => e.minified === entry.minified && e.original === entry.original);
      if (exists) {
        return entries;
      }
      return [entry, ...entries].slice(0, 10);
    });
  }

  formatBytes(value: number): string {
    if (value === 0) {
      return '0 B';
    }
    const UNITS = ['B', 'KB', 'MB'];
    const exponent = Math.min(Math.floor(Math.log(value) / Math.log(1024)), UNITS.length - 1);
    const scaled = value / Math.pow(1024, exponent);
    return `${scaled.toFixed(scaled >= 10 || exponent === 0 ? 0 : 1)} ${UNITS[exponent]}`;
  }
}
