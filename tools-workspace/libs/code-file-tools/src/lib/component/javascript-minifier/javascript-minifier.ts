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
  JS_MINIFIER_DEFAULT_OPTIONS,
  JS_MINIFIER_HISTORY_LIMIT,
  JS_MINIFIER_HISTORY_PREVIEW_LENGTH,
  JS_MINIFIER_RELATED_TOOLS,
  JS_MINIFIER_SAMPLE
} from '../../constants/javascript-minifier.constants';
import type { JavascriptMinifierOptions } from '../../types/javascript-minifier.types';
import type { MinificationResult, MinifierHistoryEntry } from '../../types/minifier.types';
import { formatClipboardBytes } from '../../utils/clipboard-history.utils';
import {
  buildMinificationResult,
  createMinifierHistoryEntry,
  formatMinifierHistoryPreview,
  prependMinifierHistory
} from '../../utils/minifier-common.utils';
import {
  minifyJavaScript,
  resolveJavascriptMinifierSuggestion
} from '../../utils/javascript-minifier.utils';

type MinifierFormGroup = FormGroup<{
  removeComments: FormControl<boolean>;
  removeWhitespace: FormControl<boolean>;
  removeEmptyStatements: FormControl<boolean>;
  removeUnnecessarySemicolons: FormControl<boolean>;
  removeConsoleLogs: FormControl<boolean>;
  removeDebugger: FormControl<boolean>;
  rememberHistory: FormControl<boolean>;
}>;

@Component({
  selector: 'lib-javascript-minifier',
  standalone: true,
  templateUrl: './javascript-minifier.html',
  styleUrls: ['./javascript-minifier.scss'],
  imports: [ReactiveFormsModule, RouterLink, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class JavascriptMinifierComponent {
  private readonly formBuilder = inject(FormBuilder);
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);

  readonly relatedTools: ReadonlyArray<CftRelatedToolLink> = JS_MINIFIER_RELATED_TOOLS;
  readonly formatBytes = formatClipboardBytes;
  readonly formatHistoryPreview = (minified: string) =>
    formatMinifierHistoryPreview(minified, JS_MINIFIER_HISTORY_PREVIEW_LENGTH);

  readonly form: MinifierFormGroup = this.formBuilder.group({
    removeComments: this.formBuilder.control(JS_MINIFIER_DEFAULT_OPTIONS.removeComments, {
      nonNullable: true
    }),
    removeWhitespace: this.formBuilder.control(JS_MINIFIER_DEFAULT_OPTIONS.removeWhitespace, {
      nonNullable: true
    }),
    removeEmptyStatements: this.formBuilder.control(
      JS_MINIFIER_DEFAULT_OPTIONS.removeEmptyStatements,
      { nonNullable: true }
    ),
    removeUnnecessarySemicolons: this.formBuilder.control(
      JS_MINIFIER_DEFAULT_OPTIONS.removeUnnecessarySemicolons,
      { nonNullable: true }
    ),
    removeConsoleLogs: this.formBuilder.control(JS_MINIFIER_DEFAULT_OPTIONS.removeConsoleLogs, {
      nonNullable: true
    }),
    removeDebugger: this.formBuilder.control(JS_MINIFIER_DEFAULT_OPTIONS.removeDebugger, {
      nonNullable: true
    }),
    rememberHistory: this.formBuilder.control(JS_MINIFIER_DEFAULT_OPTIONS.rememberHistory, {
      nonNullable: true
    })
  });

  readonly inputJs = signal(JS_MINIFIER_SAMPLE);
  readonly errors = signal<string[]>([]);
  readonly result = signal<MinificationResult | null>(null);
  readonly history = signal<MinifierHistoryEntry[]>([]);
  readonly isProcessing = signal(false);
  readonly dismissedSuggestionId = signal<string | null>(null);

  readonly hasHistory = computed(() => this.history().length > 0);
  readonly hasResult = computed(() => this.result() !== null);
  readonly hasInput = computed(() => !!this.inputJs().trim());
  readonly minifiedJs = computed(() => this.result()?.minified ?? '');
  readonly reductionPercentage = computed(() => this.result()?.reductionPercentage ?? 0);

  readonly primarySuggestion = computed<CftToolSuggestion | null>(() => {
    const suggestion = resolveJavascriptMinifierSuggestion(this.inputJs(), this.result());
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

      const options = this.form.getRawValue() as JavascriptMinifierOptions;
      const minified = minifyJavaScript(input, options);
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
    void cftCopyText(this.toast, this.inputJs(), 'Input');
  }

  copyOutput(): void {
    void cftCopyText(this.toast, this.minifiedJs(), 'Output');
  }

  downloadMinified(): void {
    const current = this.result();
    if (!current) return;

    try {
      cftDownloadBlob(
        new Blob([current.minified], { type: 'application/javascript;charset=utf-8' }),
        'minified.js'
      );
      this.toast.success('Minified JavaScript downloaded');
    } catch {
      this.toast.error('Could not download minified JavaScript');
    }
  }

  loadSample(): void {
    this.inputJs.set(JS_MINIFIER_SAMPLE);
    this.minify();
    this.toast.info('Sample JavaScript loaded');
  }

  clear(): void {
    this.inputJs.set('');
    this.result.set(null);
    this.errors.set([]);
    this.toast.info('Editors cleared');
  }

  applyHistory(entry: MinifierHistoryEntry): void {
    this.inputJs.set(entry.original);
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
      prependMinifierHistory(entries, entry, JS_MINIFIER_HISTORY_LIMIT)
    );
  }
}
