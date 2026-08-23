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
  HTML_MINIFIER_DEFAULT_OPTIONS,
  HTML_MINIFIER_HISTORY_LIMIT,
  HTML_MINIFIER_HISTORY_PREVIEW_LENGTH,
  HTML_MINIFIER_RELATED_TOOLS,
  HTML_MINIFIER_SAMPLE
} from '../../constants/html-minifier.constants';
import type { HtmlMinifierOptions } from '../../types/html-minifier.types';
import type { MinificationResult, MinifierHistoryEntry } from '../../types/minifier.types';
import { formatClipboardBytes } from '../../utils/clipboard-history.utils';
import {
  buildMinificationResult,
  createMinifierHistoryEntry,
  formatMinifierHistoryPreview,
  prependMinifierHistory
} from '../../utils/minifier-common.utils';
import { minifyHtml, resolveHtmlMinifierSuggestion } from '../../utils/html-minifier.utils';

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

@Component({
  selector: 'lib-html-minifier',
  standalone: true,
  templateUrl: './html-minifier.html',
  styleUrls: ['./html-minifier.scss'],
  imports: [ReactiveFormsModule, RouterLink, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HtmlMinifierComponent {
  private readonly formBuilder = inject(FormBuilder);
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);

  readonly relatedTools: ReadonlyArray<CftRelatedToolLink> = HTML_MINIFIER_RELATED_TOOLS;
  readonly formatBytes = formatClipboardBytes;
  readonly formatHistoryPreview = (minified: string) =>
    formatMinifierHistoryPreview(minified, HTML_MINIFIER_HISTORY_PREVIEW_LENGTH);

  readonly form: MinifierFormGroup = this.formBuilder.group({
    removeComments: this.formBuilder.control(HTML_MINIFIER_DEFAULT_OPTIONS.removeComments, {
      nonNullable: true
    }),
    collapseWhitespace: this.formBuilder.control(
      HTML_MINIFIER_DEFAULT_OPTIONS.collapseWhitespace,
      { nonNullable: true }
    ),
    removeAttributeQuotes: this.formBuilder.control(
      HTML_MINIFIER_DEFAULT_OPTIONS.removeAttributeQuotes,
      { nonNullable: true }
    ),
    removeOptionalTags: this.formBuilder.control(
      HTML_MINIFIER_DEFAULT_OPTIONS.removeOptionalTags,
      { nonNullable: true }
    ),
    removeEmptyAttributes: this.formBuilder.control(
      HTML_MINIFIER_DEFAULT_OPTIONS.removeEmptyAttributes,
      { nonNullable: true }
    ),
    caseSensitive: this.formBuilder.control(HTML_MINIFIER_DEFAULT_OPTIONS.caseSensitive, {
      nonNullable: true
    }),
    minifyCSS: this.formBuilder.control(HTML_MINIFIER_DEFAULT_OPTIONS.minifyCSS, {
      nonNullable: true
    }),
    minifyJS: this.formBuilder.control(HTML_MINIFIER_DEFAULT_OPTIONS.minifyJS, {
      nonNullable: true
    }),
    rememberHistory: this.formBuilder.control(HTML_MINIFIER_DEFAULT_OPTIONS.rememberHistory, {
      nonNullable: true
    })
  });

  readonly inputHtml = signal(HTML_MINIFIER_SAMPLE);
  readonly errors = signal<string[]>([]);
  readonly result = signal<MinificationResult | null>(null);
  readonly history = signal<MinifierHistoryEntry[]>([]);
  readonly isProcessing = signal(false);
  readonly dismissedSuggestionId = signal<string | null>(null);

  readonly hasHistory = computed(() => this.history().length > 0);
  readonly hasResult = computed(() => this.result() !== null);
  readonly hasInput = computed(() => !!this.inputHtml().trim());
  readonly minifiedHtml = computed(() => this.result()?.minified ?? '');
  readonly reductionPercentage = computed(() => this.result()?.reductionPercentage ?? 0);

  readonly primarySuggestion = computed<CftToolSuggestion | null>(() => {
    const suggestion = resolveHtmlMinifierSuggestion(this.inputHtml(), this.result());
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

      const options = this.form.getRawValue() as HtmlMinifierOptions;
      const minified = minifyHtml(input, options);
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
    void cftCopyText(this.toast, this.inputHtml(), 'Input');
  }

  copyOutput(): void {
    void cftCopyText(this.toast, this.minifiedHtml(), 'Output');
  }

  downloadMinified(): void {
    const current = this.result();
    if (!current) return;

    try {
      cftDownloadBlob(
        new Blob([current.minified], { type: 'text/html;charset=utf-8' }),
        'minified.html'
      );
      this.toast.success('Minified HTML downloaded');
    } catch {
      this.toast.error('Could not download minified HTML');
    }
  }

  loadSample(): void {
    this.inputHtml.set(HTML_MINIFIER_SAMPLE);
    this.minify();
    this.toast.info('Sample HTML loaded');
  }

  clear(): void {
    this.inputHtml.set('');
    this.result.set(null);
    this.errors.set([]);
    this.toast.info('Editors cleared');
  }

  applyHistory(entry: MinifierHistoryEntry): void {
    this.inputHtml.set(entry.original);
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
      prependMinifierHistory(entries, entry, HTML_MINIFIER_HISTORY_LIMIT)
    );
  }
}
