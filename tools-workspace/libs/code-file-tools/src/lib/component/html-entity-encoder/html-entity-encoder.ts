import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { Navigation, TooltipDirective, AssetService, ToastService } from '@tools-workspace/features-home';
import { cftCopyText } from '../../shared/cft-clipboard.util';
import { cftDownloadBlob } from '../../shared/cft-download.util';
import type { CftRelatedToolLink, CftToolSuggestion } from '../../shared/cft-tool-suggestion.model';
import {
  HTML_ENTITY_DEFAULT_ENCODING,
  HTML_ENTITY_HISTORY_PREVIEW_LENGTH,
  HTML_ENTITY_RELATED_TOOLS,
  HTML_ENTITY_SAMPLE
} from '../../constants/html-entity-encoder.constants';
import type {
  HtmlEntityEncodingFormat,
  HtmlEntityHistoryEntry,
  HtmlEntityMode
} from '../../types/html-entity-encoder.types';
import { formatClipboardTimestamp } from '../../utils/clipboard-history.utils';
import {
  createHtmlEntityHistoryEntry,
  formatHtmlEntityHistoryPreview,
  prependHtmlEntityHistory,
  processHtmlEntities,
  resolveHtmlEntitySuggestion
} from '../../utils/html-entity-encoder.utils';

@Component({
  selector: 'lib-html-entity-encoder',
  standalone: true,
  templateUrl: './html-entity-encoder.html',
  styleUrls: ['./html-entity-encoder.scss'],
  imports: [RouterLink, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HtmlEntityEncoderComponent {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);

  readonly relatedTools: ReadonlyArray<CftRelatedToolLink> = HTML_ENTITY_RELATED_TOOLS;
  readonly formatTimestamp = formatClipboardTimestamp;
  readonly formatHistoryPreview = (input: string) =>
    formatHtmlEntityHistoryPreview(input, HTML_ENTITY_HISTORY_PREVIEW_LENGTH);

  readonly mode = signal<HtmlEntityMode>('encode');
  readonly encodingMode = signal<HtmlEntityEncodingFormat>(HTML_ENTITY_DEFAULT_ENCODING);
  readonly inputText = signal(HTML_ENTITY_SAMPLE);
  readonly outputText = signal('');
  readonly errors = signal<string[]>([]);
  readonly history = signal<HtmlEntityHistoryEntry[]>([]);
  readonly dismissedSuggestionId = signal<string | null>(null);

  readonly hasHistory = computed(() => this.history().length > 0);
  readonly hasOutput = computed(() => this.outputText().length > 0);

  readonly primarySuggestion = computed<CftToolSuggestion | null>(() => {
    const suggestion = resolveHtmlEntitySuggestion(
      this.inputText(),
      this.mode(),
      this.hasOutput()
    );
    if (!suggestion || this.dismissedSuggestionId() === suggestion.id) {
      return null;
    }
    return suggestion;
  });

  constructor() {
    this.process();
  }

  dismissSuggestion(suggestionId: string): void {
    this.dismissedSuggestionId.set(suggestionId);
  }

  selectMode(selectedMode: HtmlEntityMode): void {
    if (this.mode() !== selectedMode) {
      this.mode.set(selectedMode);
      const currentInput = this.inputText();
      const currentOutput = this.outputText();
      this.inputText.set(currentOutput);
      this.outputText.set(currentInput);
      this.process();
    }
  }

  selectEncodingMode(selectedMode: HtmlEntityEncodingFormat): void {
    this.encodingMode.set(selectedMode);
    this.process();
  }

  onInputChange(value: string): void {
    this.inputText.set(value);
    this.process();
  }

  process(): void {
    this.errors.set([]);
    const input = this.inputText().trim();

    if (!input) {
      this.outputText.set('');
      return;
    }

    try {
      this.outputText.set(processHtmlEntities(input, this.mode(), this.encodingMode()));
      this.addToHistory();
    } catch (error) {
      this.errors.set([`Processing failed: ${(error as Error)?.message ?? 'Unknown error'}`]);
      this.outputText.set('');
    }
  }

  copyInput(): void {
    void cftCopyText(this.toast, this.inputText(), 'Input');
  }

  copyOutput(): void {
    void cftCopyText(this.toast, this.outputText(), 'Output');
  }

  downloadOutput(): void {
    if (!this.hasOutput()) {
      return;
    }
    try {
      cftDownloadBlob(
        new Blob([this.outputText()], { type: 'text/plain;charset=utf-8' }),
        this.mode() === 'encode' ? 'encoded-entities.txt' : 'decoded-text.txt'
      );
      this.toast.success('Output downloaded');
    } catch {
      this.toast.error('Could not download output');
    }
  }

  loadSample(): void {
    this.inputText.set(HTML_ENTITY_SAMPLE);
    this.process();
    this.toast.info('Sample text loaded');
  }

  clear(): void {
    this.inputText.set('');
    this.outputText.set('');
    this.errors.set([]);
    this.toast.info('Editors cleared');
  }

  swapInputOutput(): void {
    const currentInput = this.inputText();
    const currentOutput = this.outputText();
    this.inputText.set(currentOutput);
    this.outputText.set(currentInput);
    this.process();
  }

  applyHistory(entry: HtmlEntityHistoryEntry): void {
    this.mode.set(entry.mode);
    this.inputText.set(entry.input);
    this.outputText.set(entry.output);
  }

  clearHistory(): void {
    this.history.set([]);
    this.toast.info('History cleared');
  }

  removeHistoryEntry(timestamp: number): void {
    this.history.update((entries) => entries.filter((entry) => entry.timestamp !== timestamp));
  }

  private addToHistory(): void {
    const input = this.inputText().trim();
    const output = this.outputText().trim();
    if (!input || !output) {
      return;
    }
    const entry = createHtmlEntityHistoryEntry(input, output, this.mode());
    this.history.update((entries) => prependHtmlEntityHistory(entries, entry));
  }
}
