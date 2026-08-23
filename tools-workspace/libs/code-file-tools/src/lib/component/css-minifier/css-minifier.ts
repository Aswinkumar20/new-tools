import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal
} from '@angular/core';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Navigation, TooltipDirective, AssetService, ToastService } from '@tools-workspace/features-home';
import { cftCopyText } from '../../shared/cft-clipboard.util';
import { cftDownloadBlob } from '../../shared/cft-download.util';
import type { CftRelatedToolLink, CftToolSuggestion } from '../../shared/cft-tool-suggestion.model';
import {
  CSS_MINIFIER_DEFAULT_OPTIONS,
  CSS_MINIFIER_HISTORY_LIMIT,
  CSS_MINIFIER_HISTORY_PREVIEW_LENGTH,
  CSS_MINIFIER_RELATED_TOOLS,
  CSS_MINIFIER_SAMPLE
} from '../../constants/css-minifier.constants';
import type { CssMinifierOptions } from '../../types/css-minifier.types';
import type { MinificationResult, MinifierHistoryEntry } from '../../types/minifier.types';
import { formatClipboardBytes } from '../../utils/clipboard-history.utils';
import {
  buildMinificationResult,
  createMinifierHistoryEntry,
  formatMinifierHistoryPreview,
  prependMinifierHistory
} from '../../utils/minifier-common.utils';
import { minifyCss, resolveCssMinifierSuggestion } from '../../utils/css-minifier.utils';

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

@Component({
  selector: 'lib-css-minifier',
  standalone: true,
  templateUrl: './css-minifier.html',
  styleUrls: ['./css-minifier.scss'],
  imports: [ReactiveFormsModule, RouterLink, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CssMinifierComponent {
  private readonly formBuilder = inject(FormBuilder);
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);

  readonly relatedTools: ReadonlyArray<CftRelatedToolLink> = CSS_MINIFIER_RELATED_TOOLS;
  readonly formatBytes = formatClipboardBytes;
  readonly formatHistoryPreview = (minified: string) =>
    formatMinifierHistoryPreview(minified, CSS_MINIFIER_HISTORY_PREVIEW_LENGTH);

  readonly form: MinifierFormGroup = this.formBuilder.group({
    removeComments: this.formBuilder.control(CSS_MINIFIER_DEFAULT_OPTIONS.removeComments, {
      nonNullable: true
    }),
    removeWhitespace: this.formBuilder.control(CSS_MINIFIER_DEFAULT_OPTIONS.removeWhitespace, {
      nonNullable: true
    }),
    removeEmptyRules: this.formBuilder.control(CSS_MINIFIER_DEFAULT_OPTIONS.removeEmptyRules, {
      nonNullable: true
    }),
    optimizeColors: this.formBuilder.control(CSS_MINIFIER_DEFAULT_OPTIONS.optimizeColors, {
      nonNullable: true
    }),
    removeUnnecessarySemicolons: this.formBuilder.control(
      CSS_MINIFIER_DEFAULT_OPTIONS.removeUnnecessarySemicolons,
      { nonNullable: true }
    ),
    removeUnits: this.formBuilder.control(CSS_MINIFIER_DEFAULT_OPTIONS.removeUnits, {
      nonNullable: true
    }),
    lowercaseSelectors: this.formBuilder.control(CSS_MINIFIER_DEFAULT_OPTIONS.lowercaseSelectors, {
      nonNullable: true
    }),
    rememberHistory: this.formBuilder.control(CSS_MINIFIER_DEFAULT_OPTIONS.rememberHistory, {
      nonNullable: true
    })
  });

  readonly inputCss = signal(CSS_MINIFIER_SAMPLE);
  readonly errors = signal<string[]>([]);
  readonly result = signal<MinificationResult | null>(null);
  readonly history = signal<MinifierHistoryEntry[]>([]);
  readonly isProcessing = signal(false);
  readonly dismissedSuggestionId = signal<string | null>(null);

  readonly hasHistory = computed(() => this.history().length > 0);
  readonly hasResult = computed(() => this.result() !== null);
  readonly hasInput = computed(() => !!this.inputCss().trim());
  readonly minifiedCss = computed(() => this.result()?.minified ?? '');
  readonly reductionPercentage = computed(() => this.result()?.reductionPercentage ?? 0);

  readonly primarySuggestion = computed<CftToolSuggestion | null>(() => {
    const suggestion = resolveCssMinifierSuggestion(this.inputCss(), this.result());
    if (!suggestion || this.dismissedSuggestionId() === suggestion.id) {
      return null;
    }
    return suggestion;
  });

  constructor() {
    this.minify();
  }

  dismissSuggestion(suggestionId: string): void {
    this.dismissedSuggestionId.set(suggestionId);
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

      const options = this.form.getRawValue() as CssMinifierOptions;
      const minified = minifyCss(input, options);
      const minificationResult = buildMinificationResult(input, minified);
      this.result.set(minificationResult);

      if (options.rememberHistory) {
        this.addToHistory(input, minified, minificationResult.reduction);
      }
    } catch (error) {
      this.errors.set([`Minification failed: ${(error as Error)?.message ?? 'Unknown error'}`]);
      this.result.set(null);
    } finally {
      this.isProcessing.set(false);
    }
  }

  copyInput(): void {
    void cftCopyText(this.toast, this.inputCss(), 'Input');
  }

  copyOutput(): void {
    void cftCopyText(this.toast, this.minifiedCss(), 'Output');
  }

  downloadMinified(): void {
    const current = this.result();
    if (!current) return;

    try {
      cftDownloadBlob(
        new Blob([current.minified], { type: 'text/css;charset=utf-8' }),
        'minified.css'
      );
      this.toast.success('Minified CSS downloaded');
    } catch {
      this.toast.error('Could not download minified CSS');
    }
  }

  loadSample(): void {
    this.inputCss.set(CSS_MINIFIER_SAMPLE);
    this.minify();
    this.toast.info('Sample CSS loaded');
  }

  clear(): void {
    this.inputCss.set('');
    this.result.set(null);
    this.errors.set([]);
    this.toast.info('Editors cleared');
  }

  applyHistory(entry: MinifierHistoryEntry): void {
    this.inputCss.set(entry.original);
    this.minify();
  }

  clearHistory(): void {
    this.history.set([]);
    this.toast.info('History cleared');
  }

  removeHistoryEntry(timestamp: number): void {
    this.history.update((entries) => entries.filter((entry) => entry.timestamp !== timestamp));
  }

  private addToHistory(original: string, minified: string, reduction: number): void {
    const entry = createMinifierHistoryEntry(original, minified, reduction);
    this.history.update((entries) =>
      prependMinifierHistory(entries, entry, CSS_MINIFIER_HISTORY_LIMIT)
    );
  }
}
