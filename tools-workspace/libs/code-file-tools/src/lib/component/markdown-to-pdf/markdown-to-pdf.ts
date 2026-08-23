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
import type { CftRelatedToolLink, CftToolSuggestion } from '../../shared/cft-tool-suggestion.model';
import {
  MARKDOWN_TO_PDF_DEFAULT_OPTIONS,
  MARKDOWN_TO_PDF_RELATED_TOOLS,
  MARKDOWN_TO_PDF_SAMPLE
} from '../../constants/markdown-to-pdf.constants';
import type { MarkdownPdfOptions } from '../../types/markdown-to-pdf.types';
import { formatClipboardBytes } from '../../utils/clipboard-history.utils';
import {
  generateMarkdownPdf,
  markdownToHtml,
  resolveMarkdownToPdfSuggestion
} from '../../utils/markdown-to-pdf.utils';

@Component({
  selector: 'lib-markdown-to-pdf',
  standalone: true,
  templateUrl: './markdown-to-pdf.html',
  styleUrls: ['./markdown-to-pdf.scss'],
  imports: [RouterLink, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MarkdownToPdfComponent {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);

  readonly relatedTools: ReadonlyArray<CftRelatedToolLink> = MARKDOWN_TO_PDF_RELATED_TOOLS;
  /** Bound in template for number option inputs. */
  readonly Number = Number;

  readonly markdownInput = signal(MARKDOWN_TO_PDF_SAMPLE);
  readonly htmlOutput = signal('');
  readonly errors = signal<string[]>([]);
  readonly isGenerating = signal(false);
  readonly pdfOptions = signal<MarkdownPdfOptions>({ ...MARKDOWN_TO_PDF_DEFAULT_OPTIONS });
  readonly dismissedSuggestionId = signal<string | null>(null);

  readonly hasContent = computed(() => this.markdownInput().trim().length > 0);
  readonly hasHtmlOutput = computed(() => this.htmlOutput().length > 0);

  readonly primarySuggestion = computed<CftToolSuggestion | null>(() => {
    const suggestion = resolveMarkdownToPdfSuggestion(
      this.markdownInput(),
      this.hasHtmlOutput()
    );
    if (!suggestion || this.dismissedSuggestionId() === suggestion.id) {
      return null;
    }
    return suggestion;
  });

  constructor() {
    this.convertMarkdown();
  }

  dismissSuggestion(suggestionId: string): void {
    this.dismissedSuggestionId.set(suggestionId);
  }

  onInputChange(value: string): void {
    this.markdownInput.set(value);
    this.convertMarkdown();
  }

  convertMarkdown(): void {
    this.errors.set([]);
    const markdown = this.markdownInput().trim();

    if (!markdown) {
      this.htmlOutput.set('');
      return;
    }

    try {
      this.htmlOutput.set(markdownToHtml(markdown));
    } catch (error) {
      this.errors.set([`Conversion failed: ${(error as Error)?.message ?? 'Unknown error'}`]);
      this.htmlOutput.set('');
    }
  }

  async generatePdf(): Promise<void> {
    this.errors.set([]);
    this.isGenerating.set(true);

    try {
      const html = this.htmlOutput();
      if (!html) {
        this.errors.set(['No HTML content to convert. Please convert Markdown first.']);
        this.isGenerating.set(false);
        return;
      }

      await generateMarkdownPdf(html, this.pdfOptions());
      this.toast.success('PDF downloaded');
    } catch (error) {
      const message = `PDF generation failed: ${(error as Error)?.message ?? 'Unknown error'}`;
      this.errors.set([message]);
      this.toast.error('Could not generate PDF');
    } finally {
      this.isGenerating.set(false);
    }
  }

  updateOption<K extends keyof MarkdownPdfOptions>(
    key: K,
    value: MarkdownPdfOptions[K]
  ): void {
    this.pdfOptions.update((options) => ({
      ...options,
      [key]: value
    }));
  }

  loadSample(): void {
    this.markdownInput.set(MARKDOWN_TO_PDF_SAMPLE);
    this.convertMarkdown();
    this.toast.info('Sample Markdown loaded');
  }

  clear(): void {
    this.markdownInput.set('');
    this.htmlOutput.set('');
    this.errors.set([]);
    this.toast.info('Editors cleared');
  }

  copyInput(): void {
    void cftCopyText(this.toast, this.markdownInput(), 'Markdown');
  }

  copyHtml(): void {
    void cftCopyText(this.toast, this.htmlOutput(), 'HTML');
  }

  formatBytes(value: number): string {
    return formatClipboardBytes(value);
  }
}
