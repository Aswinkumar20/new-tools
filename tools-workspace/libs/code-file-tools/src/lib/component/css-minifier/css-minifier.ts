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
  removeWhitespace: FormControl<boolean>;
  removeEmptyRules: FormControl<boolean>;
  optimizeColors: FormControl<boolean>;
  removeUnnecessarySemicolons: FormControl<boolean>;
  removeUnits: FormControl<boolean>;
  lowercaseSelectors: FormControl<boolean>;
  rememberHistory: FormControl<boolean>;
}>;

const SAMPLE_CSS = `/* Sample CSS for minification */
body {
    font-family: Arial, sans-serif;
    margin: 0;
    padding: 20px;
    background-color: #ffffff;
    color: #000000;
}

.container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 20px;
}

.button {
    background-color: #007bff;
    color: #ffffff;
    padding: 10px 20px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
}

.button:hover {
    background-color: #0056b3;
}

@media (max-width: 768px) {
    .container {
        padding: 10px;
    }
}`;

@Component({
  selector: 'lib-css-minifier',
  standalone: true,
  templateUrl: './css-minifier.html',
  styleUrls: ['./css-minifier.scss'],
  imports: [CommonModule, ReactiveFormsModule, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CssMinifierComponent {
  private readonly fb = inject(FormBuilder);
  readonly assetService = inject(AssetService);

  readonly form: MinifierFormGroup = this.fb.group({
    removeComments: this.fb.control(true, { nonNullable: true }),
    removeWhitespace: this.fb.control(true, { nonNullable: true }),
    removeEmptyRules: this.fb.control(true, { nonNullable: true }),
    optimizeColors: this.fb.control(true, { nonNullable: true }),
    removeUnnecessarySemicolons: this.fb.control(true, { nonNullable: true }),
    removeUnits: this.fb.control(false, { nonNullable: true }),
    lowercaseSelectors: this.fb.control(false, { nonNullable: true }),
    rememberHistory: this.fb.control(true, { nonNullable: true })
  });

  readonly inputCss = signal<string>(SAMPLE_CSS);
  readonly errors = signal<string[]>([]);
  readonly result: WritableSignal<MinificationResult | null> = signal(null);
  readonly history = signal<HistoryEntry[]>([]);
  readonly isProcessing = signal(false);

  readonly hasHistory = computed(() => this.history().length > 0);
  readonly hasResult = computed(() => this.result() !== null);
  readonly hasInput = computed(() => !!this.inputCss().trim());
  readonly minifiedCss = computed(() => this.result()?.minified ?? '');
  readonly reductionPercentage = computed(() => this.result()?.reductionPercentage ?? 0);

  readonly Math = Math;

  constructor() {
    // Initial minification
    this.minify();
  }

  onInputChange(value: string): void {
    this.inputCss.set(value);
    this.minify();
  }

  minify(): void {
    this.errors.set([]);
    this.isProcessing.set(true);

    try {
      const input = this.inputCss().trim();
      if (!input) {
        this.result.set(null);
        this.isProcessing.set(false);
        return;
      }

      const options = this.form.getRawValue();
      const minified = this.minifyCss(input, options);
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

  private minifyCss(css: string, options: any): string {
    let result = css;

    // Remove CSS comments
    if (options.removeComments) {
      result = result.replace(/\/\*[\s\S]*?\*\//g, '');
    }

    // Remove whitespace
    if (options.removeWhitespace) {
      // Remove spaces around operators
      result = result.replace(/\s*([{}:;,>+~])\s*/g, '$1');
      // Remove spaces before semicolons
      result = result.replace(/\s*;/g, ';');
      // Remove spaces after colons
      result = result.replace(/:\s*/g, ':');
      // Remove spaces around commas
      result = result.replace(/\s*,\s*/g, ',');
      // Remove spaces around opening braces
      result = result.replace(/\s*{\s*/g, '{');
      // Remove spaces around closing braces
      result = result.replace(/\s*}\s*/g, '}');
      // Remove leading/trailing whitespace
      result = result.trim();
    }

    // Remove unnecessary semicolons
    if (options.removeUnnecessarySemicolons) {
      // Remove semicolon before closing brace
      result = result.replace(/;}/g, '}');
      // Remove semicolon at end of string
      result = result.replace(/;$/g, '');
    }

    // Remove empty rules
    if (options.removeEmptyRules) {
      result = result.replace(/[^{}]+{\s*}/g, '');
      // Remove multiple consecutive closing braces
      result = result.replace(/}+/g, '}');
    }

    // Optimize colors
    if (options.optimizeColors) {
      // Convert #RRGGBB to #RGB where possible
      result = result.replace(/#([0-9a-fA-F])\1([0-9a-fA-F])\2([0-9a-fA-F])\3(?!\w)/g, '#$1$2$3');
      // Convert rgb() to hex where shorter
      result = result.replace(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/g, (match, r, g, b) => {
        const hex = '#' + [r, g, b].map(x => {
          const hex = Number.parseInt(x).toString(16).padStart(2, '0');
          return hex;
        }).join('');
        return hex.length <= match.length ? hex : match;
      });
      // Convert color names to hex (common ones)
      const colorMap: { [key: string]: string } = {
        'white': '#fff',
        'black': '#000',
        'red': '#f00',
        'green': '#0f0',
        'blue': '#00f'
      };
      for (const [name, hex] of Object.entries(colorMap)) {
        result = result.replace(new RegExp(`\\b${name}\\b`, 'gi'), hex);
      }
    }

    // Remove units from zero values
    if (options.removeUnits) {
      result = result.replace(/(\s|:)(0)(px|em|rem|pt|pc|in|cm|mm|ex|ch|vw|vh|vmin|vmax|%|deg|rad|grad|ms|s|Hz|kHz)/g, '$1$2');
    }

    // Lowercase selectors (optional)
    if (options.lowercaseSelectors) {
      // This is a simplified version - in production, use a proper CSS parser
      result = result.replace(/([^{}]+){/g, (match) => {
        return match.toLowerCase();
      });
    }

    return result.trim();
  }

  copyInput(): void {
    this.copyToClipboard(this.inputCss(), 'Input');
  }

  copyOutput(): void {
    this.copyToClipboard(this.minifiedCss(), 'Output');
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

    const blob = new Blob([current.minified], { type: 'text/css;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'minified.css';
    anchor.click();
    URL.revokeObjectURL(url);
  }

  loadSample(): void {
    this.inputCss.set(SAMPLE_CSS);
    this.minify();
  }

  clear(): void {
    this.inputCss.set('');
    this.result.set(null);
    this.errors.set([]);
  }

  applyHistory(entry: HistoryEntry): void {
    this.inputCss.set(entry.original);
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
