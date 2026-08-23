import { ChangeDetectionStrategy, Component, WritableSignal, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Navigation } from '@tools-workspace/features-home';

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
  removeEmptyStatements: FormControl<boolean>;
  removeUnnecessarySemicolons: FormControl<boolean>;
  removeConsoleLogs: FormControl<boolean>;
  removeDebugger: FormControl<boolean>;
  rememberHistory: FormControl<boolean>;
}>;

const SAMPLE_JAVASCRIPT = `// Sample JavaScript for minification
function calculateTotal(items) {
    let total = 0;
    
    // Loop through items
    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        total += item.price * item.quantity;
    }
    
    // Apply discount if applicable
    if (total > 100) {
        total = total * 0.9; // 10% discount
    }
    
    console.log('Total calculated:', total);
    return total;
}

// Example usage
const cart = [
    { price: 25.99, quantity: 2 },
    { price: 15.50, quantity: 1 },
    { price: 8.75, quantity: 3 }
];

const finalTotal = calculateTotal(cart);
console.log('Final total:', finalTotal);`;

@Component({
  selector: 'lib-javascript-minifier',
  standalone: true,
  templateUrl: './javascript-minifier.html',
  styleUrls: ['./javascript-minifier.scss'],
  imports: [CommonModule, ReactiveFormsModule, Navigation],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class JavascriptMinifierComponent {
  private readonly fb = inject(FormBuilder);

  readonly form: MinifierFormGroup = this.fb.group({
    removeComments: this.fb.control(true, { nonNullable: true }),
    removeWhitespace: this.fb.control(true, { nonNullable: true }),
    removeEmptyStatements: this.fb.control(true, { nonNullable: true }),
    removeUnnecessarySemicolons: this.fb.control(true, { nonNullable: true }),
    removeConsoleLogs: this.fb.control(false, { nonNullable: true }),
    removeDebugger: this.fb.control(true, { nonNullable: true }),
    rememberHistory: this.fb.control(true, { nonNullable: true })
  });

  readonly inputJs = signal<string>(SAMPLE_JAVASCRIPT);
  readonly errors = signal<string[]>([]);
  readonly result: WritableSignal<MinificationResult | null> = signal(null);
  readonly history = signal<HistoryEntry[]>([]);
  readonly isProcessing = signal(false);

  readonly hasHistory = computed(() => this.history().length > 0);
  readonly hasResult = computed(() => this.result() !== null);
  readonly minifiedJs = computed(() => this.result()?.minified ?? '');
  readonly reductionPercentage = computed(() => this.result()?.reductionPercentage ?? 0);

  readonly Math = Math;

  constructor() {
    // Initial minification
    this.minify();
  }

  onInputChange(value: string): void {
    this.inputJs.set(value);
    this.minify();
  }

  minify(): void {
    this.errors.set([]);
    this.isProcessing.set(true);

    try {
      const input = this.inputJs().trim();
      if (!input) {
        this.result.set(null);
        this.isProcessing.set(false);
        return;
      }

      const options = this.form.getRawValue();
      const minified = this.minifyJavaScript(input, options);
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

  private minifyJavaScript(js: string, options: any): string {
    let result = js;

    // Remove single-line comments
    if (options.removeComments) {
      // Remove single-line comments (// ...)
      result = result.replace(/\/\/.*$/gm, '');
      // Remove multi-line comments (/* ... */)
      result = result.replace(/\/\*[\s\S]*?\*\//g, '');
    }

    // Remove console.log statements
    if (options.removeConsoleLogs) {
      result = result.replace(/console\.(log|debug|info|warn|error)\([^)]*\);?\s*/g, '');
    }

    // Remove debugger statements
    if (options.removeDebugger) {
      result = result.replace(/debugger\s*;?\s*/g, '');
    }

    // Remove whitespace
    if (options.removeWhitespace) {
      // Remove spaces around operators
      result = result.replace(/\s*([=+\-*/%<>!&|?:,;{}()\[\]])\s*/g, '$1');
      // Remove spaces after keywords
      result = result.replace(/\b(if|else|for|while|function|return|var|let|const|class|extends|import|export)\s+/g, '$1 ');
      // Remove multiple spaces
      result = result.replace(/\s+/g, ' ');
      // Remove spaces at start/end of lines
      result = result.replace(/^\s+|\s+$/gm, '');
      // Remove empty lines
      result = result.replace(/\n\s*\n/g, '\n');
    }

    // Remove unnecessary semicolons
    if (options.removeUnnecessarySemicolons) {
      // Remove semicolon before closing brace
      result = result.replace(/;\s*}/g, '}');
      // Remove semicolon at end of string
      result = result.replace(/;$/gm, '');
      // Remove semicolon before newline (if not needed)
      result = result.replace(/;\s*\n/g, '\n');
    }

    // Remove empty statements
    if (options.removeEmptyStatements) {
      // Remove empty if/for/while blocks
      result = result.replace(/\{\s*\}/g, '{}');
      // Remove standalone semicolons
      result = result.replace(/;\s*;/g, ';');
    }

    return result.trim();
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

    const blob = new Blob([current.minified], { type: 'application/javascript;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'minified.js';
    anchor.click();
    URL.revokeObjectURL(url);
  }

  loadSample(): void {
    this.inputJs.set(SAMPLE_JAVASCRIPT);
    this.minify();
  }

  clear(): void {
    this.inputJs.set('');
    this.result.set(null);
    this.errors.set([]);
  }

  applyHistory(entry: HistoryEntry): void {
    this.inputJs.set(entry.original);
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
