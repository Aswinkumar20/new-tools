import { Component, AfterViewInit, ViewChild, ElementRef, inject } from '@angular/core';
import { DecimalPipe, NgFor, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Navigation, TooltipDirective, AssetService, ToastService } from '@tools-workspace/features-home';
import { dcCopyText } from '../../shared/dc-clipboard.util';
import { dcDownloadBlob, dcDownloadTimestamp } from '../../shared/dc-download.util';
import type { DcRelatedToolLink, DcToolSuggestion } from '../../shared/dc-tool-suggestion.model';
import {
  MARKDOWN_TO_HTML_BULLET_STYLES,
  MARKDOWN_TO_HTML_CALLOUTS,
  MARKDOWN_TO_HTML_CODE_FENCES,
  MARKDOWN_TO_HTML_HEADING_STYLES,
  MARKDOWN_TO_HTML_HISTORY_LIMIT,
  MARKDOWN_TO_HTML_MODES,
  MARKDOWN_TO_HTML_RELATED_TOOLS,
  MARKDOWN_TO_HTML_SAMPLE_HTML,
  MARKDOWN_TO_HTML_SAMPLE_MARKDOWN,
  MARKDOWN_TO_HTML_USAGE_STEPS
} from '../../constants/markdown-to-html.constants';
import type {
  MarkdownToHtmlBulletStyle,
  MarkdownToHtmlConversionMode,
  MarkdownToHtmlConversionStatus,
  MarkdownToHtmlCopyStatus,
  MarkdownToHtmlHeadingStyle,
  MarkdownToHtmlHistoryEntry,
  MarkdownToHtmlHtmlOptions,
  MarkdownToHtmlMarkdownOptions,
  MarkdownToHtmlMetricsSummary
} from '../../types/markdown-to-html.types';
import {
  blurActiveElement,
  buildMarkdownToHtmlLineNumbers,
  computeMarkdownToHtmlMetrics,
  convertHtmlToMarkdown,
  convertMarkdownToHtml,
  isHtmlFileName,
  isMarkdownFileName,
  isSupportedMarkdownToHtmlFile,
  resolveMarkdownToHtmlSuggestion
} from '../../utils/markdown-to-html.utils';

@Component({
  selector: 'lib-markdown-to-html',
  standalone: true,
  templateUrl: './markdown-to-html.html',
  styleUrls: ['./markdown-to-html.scss'],
  imports: [DecimalPipe, NgIf, NgFor, FormsModule, RouterLink, Navigation, TooltipDirective]
})
export class MarkdownToHtmlComponent implements AfterViewInit {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);

  @ViewChild('markdownTextarea') markdownTextarea!: ElementRef<HTMLTextAreaElement>;
  @ViewChild('htmlTextarea') htmlTextarea!: ElementRef<HTMLTextAreaElement>;
  @ViewChild('resultsTextarea') resultsTextarea!: ElementRef<HTMLTextAreaElement>;
  @ViewChild('inputLineNumbers') inputLineNumbers!: ElementRef<HTMLElement>;
  @ViewChild('outputLineNumbers') outputLineNumbers!: ElementRef<HTMLElement>;

  private fileInput: HTMLInputElement | null = null;
  private dismissedSuggestionId: string | null = null;

  readonly modes = MARKDOWN_TO_HTML_MODES;
  readonly usageSteps = MARKDOWN_TO_HTML_USAGE_STEPS;
  readonly callouts = MARKDOWN_TO_HTML_CALLOUTS;
  readonly bulletStyles = MARKDOWN_TO_HTML_BULLET_STYLES;
  readonly headingStyles = MARKDOWN_TO_HTML_HEADING_STYLES;
  readonly codeFences = [...MARKDOWN_TO_HTML_CODE_FENCES];
  readonly relatedTools: ReadonlyArray<DcRelatedToolLink> = MARKDOWN_TO_HTML_RELATED_TOOLS;

  conversionMode: MarkdownToHtmlConversionMode = 'markdown-to-html';

  markdownInput = '';
  htmlInput = '';
  resultOutput = '';

  markdownWrapParagraphs = true;
  markdownConvertLineBreaks = false;
  markdownEscapeHtml = true;
  markdownSmartTypography = false;

  htmlBulletStyle: MarkdownToHtmlBulletStyle = '-';
  htmlHeadingStyle: MarkdownToHtmlHeadingStyle = 'atx';
  htmlCollapseWhitespace = true;
  htmlKeepLinks = true;
  htmlCodeFence = '```';

  conversionStatus: MarkdownToHtmlConversionStatus = {
    status: 'idle',
    message: 'Load the sample content or paste your own Markdown/HTML to get started.'
  };

  metrics: MarkdownToHtmlMetricsSummary = {
    characters: 0,
    lines: 0,
    sizeLabel: '0 B',
    selection: 'Markdown'
  };

  operationHistory: MarkdownToHtmlHistoryEntry[] = [];
  copyStatus: MarkdownToHtmlCopyStatus = 'idle';
  isDragOver = false;
  editorLines: number[] = [];
  resultLines: number[] = [];

  constructor() {
    this.loadSample();
  }

  ngAfterViewInit(): void {
    this.updateEditorLineNumbers();
    this.updateResultLineNumbers();
  }

  get selectionDescription(): string | undefined {
    return this.modes.find((mode) => mode.id === this.conversionMode)?.description;
  }

  get primarySuggestion(): DcToolSuggestion | null {
    const suggestion = resolveMarkdownToHtmlSuggestion({
      mode: this.conversionMode,
      markdownInput: this.markdownInput,
      htmlInput: this.htmlInput,
      hasOutput: !!this.resultOutput.trim(),
      status: this.conversionStatus.status
    });
    if (!suggestion || this.dismissedSuggestionId === suggestion.id) {
      return null;
    }
    return suggestion;
  }

  dismissSuggestion(suggestionId: string): void {
    this.dismissedSuggestionId = suggestionId;
  }

  applySuggestion(suggestion: DcToolSuggestion): void {
    if (suggestion.id === 'mth-switch-html') {
      this.htmlInput = this.markdownInput;
      this.onSelectionModeChange('html-to-markdown');
      this.dismissedSuggestionId = suggestion.id;
      return;
    }
    if (suggestion.id === 'mth-switch-md') {
      this.markdownInput = this.htmlInput;
      this.onSelectionModeChange('markdown-to-html');
      this.dismissedSuggestionId = suggestion.id;
    }
  }

  isModeSwitchSuggestion(suggestion: DcToolSuggestion): boolean {
    return suggestion.id === 'mth-switch-html' || suggestion.id === 'mth-switch-md';
  }

  onMarkdownInputChange(value: string): void {
    this.markdownInput = value;
    this.dismissedSuggestionId = null;
    this.updateEditorLineNumbers();
    this.updateMetrics(value, 'Markdown');
    if (this.conversionMode === 'markdown-to-html') {
      this.conversionStatus = {
        status: 'idle',
        message: 'Markdown ready. Configure options and convert when you are satisfied.'
      };
    }
  }

  onHtmlInputChange(value: string): void {
    this.htmlInput = value;
    this.dismissedSuggestionId = null;
    this.updateEditorLineNumbers();
    this.updateMetrics(value, 'HTML');
    if (this.conversionMode === 'html-to-markdown') {
      this.conversionStatus = {
        status: 'idle',
        message: 'HTML ready. Adjust markdown output settings before converting.'
      };
    }
  }

  onEditorScroll(event: Event): void {
    const target = event.target as HTMLTextAreaElement;
    const lineNumbers = this.inputLineNumbers?.nativeElement;
    if (lineNumbers) {
      lineNumbers.scrollTop = target.scrollTop;
    }
  }

  onResultsScroll(event: Event): void {
    const target = event.target as HTMLTextAreaElement;
    const lineNumbers = this.outputLineNumbers?.nativeElement;
    if (lineNumbers) {
      lineNumbers.scrollTop = target.scrollTop;
    }
  }

  copyInput(): void {
    const text = this.conversionMode === 'markdown-to-html' ? this.markdownInput : this.htmlInput;
    void this.copyText(text, 'Input');
  }

  uploadFile(): void {
    if (!this.fileInput) {
      this.fileInput = document.createElement('input');
      this.fileInput.type = 'file';
      this.fileInput.style.display = 'none';
      this.fileInput.onchange = () => {
        const file = this.fileInput?.files?.[0];
        if (file) {
          this.readFile(file);
        }
      };
    }
    this.fileInput.accept = '.md,.markdown,.html,.htm,text/markdown,text/html';
    this.fileInput.click();
  }

  convert(): void {
    blurActiveElement();
    if (this.conversionMode === 'markdown-to-html') {
      this.convertMarkdownPipeline();
    } else {
      this.convertHtmlPipeline();
    }
  }

  resetWorkspace(): void {
    blurActiveElement();
    this.loadSample();
  }

  trackByHistory = (_index: number, entry: MarkdownToHtmlHistoryEntry): string =>
    `${entry.label}-${entry.timestamp}`;

  async copyResult(): Promise<void> {
    if (!this.resultOutput.trim()) {
      this.copyStatus = 'error';
      setTimeout(() => (this.copyStatus = 'idle'), 1500);
      return;
    }

    const ok = await dcCopyText(this.toast, this.resultOutput, 'Converted output');
    if (ok) {
      this.copyStatus = 'success';
      this.recordHistory('Copied converted output');
    } else {
      this.copyStatus = 'error';
    }
    setTimeout(() => (this.copyStatus = 'idle'), 1500);
  }

  downloadResult(): void {
    if (!this.resultOutput.trim()) {
      return;
    }

    const isMarkdown = this.conversionMode === 'html-to-markdown';
    const extension = isMarkdown ? 'md' : 'html';
    const mime = isMarkdown ? 'text/markdown' : 'text/html';
    try {
      const blob = new Blob([this.resultOutput], { type: `${mime};charset=utf-8` });
      dcDownloadBlob(blob, `converted-${dcDownloadTimestamp()}.${extension}`);
      this.recordHistory(`Downloaded ${extension.toUpperCase()} result`);
      this.toast.success(`${extension.toUpperCase()} downloaded`);
    } catch {
      this.toast.error('Could not download result');
    }
  }

  onSelectionModeChange(mode: MarkdownToHtmlConversionMode): void {
    if (this.conversionMode === mode) {
      return;
    }

    blurActiveElement();

    this.conversionMode = mode;
    this.resultOutput = '';
    this.dismissedSuggestionId = null;
    this.updateResultLineNumbers();

    if (mode === 'markdown-to-html') {
      this.markdownWrapParagraphs = true;
      this.markdownConvertLineBreaks = false;
      this.markdownEscapeHtml = true;
      this.markdownSmartTypography = false;
      this.updateMetrics(this.markdownInput, 'Markdown');
      this.conversionStatus = {
        status: 'idle',
        message: 'Mode switched to Markdown → HTML. Paste or load Markdown content before converting.'
      };
    } else {
      this.htmlBulletStyle = '-';
      this.htmlHeadingStyle = 'atx';
      this.htmlCollapseWhitespace = true;
      this.htmlKeepLinks = true;
      this.htmlCodeFence = '```';
      this.updateMetrics(this.htmlInput, 'HTML');
      this.conversionStatus = {
        status: 'idle',
        message: 'Mode switched to HTML → Markdown. Paste or load HTML content before converting.'
      };
    }

    this.updateEditorLineNumbers();
  }

  toggleWrapParagraphs(): void {
    this.markdownWrapParagraphs = !this.markdownWrapParagraphs;
  }

  toggleConvertLineBreaks(): void {
    this.markdownConvertLineBreaks = !this.markdownConvertLineBreaks;
  }

  toggleEscapeHtml(): void {
    this.markdownEscapeHtml = !this.markdownEscapeHtml;
  }

  toggleSmartTypography(): void {
    this.markdownSmartTypography = !this.markdownSmartTypography;
  }

  toggleCollapseWhitespace(): void {
    this.htmlCollapseWhitespace = !this.htmlCollapseWhitespace;
  }

  toggleKeepLinks(): void {
    this.htmlKeepLinks = !this.htmlKeepLinks;
  }

  onFileInputChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }
    this.readFile(file);
    input.value = '';
  }

  onDragEnter(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver = true;
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver = false;
    const file = event.dataTransfer?.files?.[0];
    if (!file) {
      return;
    }
    this.readFile(file);
  }

  private async copyText(text: string, label: string): Promise<void> {
    if (!text.trim()) {
      return;
    }
    await dcCopyText(this.toast, text, label);
  }

  private convertMarkdownPipeline(): void {
    if (!this.markdownInput.trim()) {
      this.conversionStatus = {
        status: 'error',
        message: 'Paste Markdown or load a sample before converting to HTML. The input field is empty.'
      };
      this.resultOutput = '';
      this.updateResultLineNumbers();
      return;
    }

    const options: MarkdownToHtmlMarkdownOptions = {
      wrapParagraphs: this.markdownWrapParagraphs,
      convertLineBreaks: this.markdownConvertLineBreaks,
      escapeHtml: this.markdownEscapeHtml,
      smartTypography: this.markdownSmartTypography
    };

    try {
      const html = convertMarkdownToHtml(this.markdownInput, options);

      if (!html || !html.trim()) {
        this.conversionStatus = {
          status: 'error',
          message: 'Conversion produced empty output. Please check your Markdown content and try again.'
        };
        this.resultOutput = '';
        this.updateResultLineNumbers();
        return;
      }

      this.resultOutput = html;
      this.updateResultLineNumbers();
      this.updateMetrics(html, 'HTML');
      this.conversionStatus = {
        status: 'success',
        message: `Markdown rendered to HTML (${this.metrics.lines} lines).`
      };
      this.recordHistory('Converted Markdown to HTML');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.conversionStatus = {
        status: 'error',
        message: `Markdown conversion failed: ${errorMessage}. Please check your Markdown syntax and try again.`
      };
      this.resultOutput = '';
      this.updateResultLineNumbers();
      this.toast.error('Markdown conversion failed');
    }
  }

  private convertHtmlPipeline(): void {
    if (!this.htmlInput.trim()) {
      this.conversionStatus = {
        status: 'error',
        message: 'Paste HTML or load a sample before converting to Markdown. The input field is empty.'
      };
      this.resultOutput = '';
      this.updateResultLineNumbers();
      return;
    }

    const options: MarkdownToHtmlHtmlOptions = {
      bulletStyle: this.htmlBulletStyle,
      headingStyle: this.htmlHeadingStyle,
      collapseWhitespace: this.htmlCollapseWhitespace,
      keepLinks: this.htmlKeepLinks,
      codeFence: this.htmlCodeFence
    };

    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(this.htmlInput, 'text/html');
      const parserError = doc.querySelector('parsererror');
      if (parserError) {
        this.conversionStatus = {
          status: 'error',
          message:
            'Invalid HTML format. The HTML could not be parsed. Please check your HTML syntax and try again.'
        };
        this.resultOutput = '';
        this.updateResultLineNumbers();
        return;
      }

      const markdown = convertHtmlToMarkdown(this.htmlInput, options);

      if (!markdown || !markdown.trim()) {
        this.conversionStatus = {
          status: 'error',
          message: 'Conversion produced empty output. Please check your HTML content and try again.'
        };
        this.resultOutput = '';
        this.updateResultLineNumbers();
        return;
      }

      this.resultOutput = markdown;
      this.updateResultLineNumbers();
      this.updateMetrics(markdown, 'Markdown');
      this.conversionStatus = {
        status: 'success',
        message: `HTML flattened to Markdown (${this.metrics.lines} lines).`
      };
      this.recordHistory('Converted HTML to Markdown');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.conversionStatus = {
        status: 'error',
        message: `HTML conversion failed: ${errorMessage}. Please ensure your HTML contains valid markup and try again.`
      };
      this.resultOutput = '';
      this.updateResultLineNumbers();
      this.toast.error('HTML conversion failed');
    }
  }

  private updateMetrics(value: string, selection: string): void {
    this.metrics = computeMarkdownToHtmlMetrics(value, selection);
  }

  private readFile(file: File): void {
    if (!isSupportedMarkdownToHtmlFile(file.name)) {
      this.conversionStatus = {
        status: 'error',
        message: `Unsupported file type: ${file.name.split('.').pop() || 'unknown'}. Please upload .md, .markdown, .html, or .htm files.`
      };
      this.resultOutput = '';
      this.updateResultLineNumbers();
      this.toast.error('Unsupported file type');
      return;
    }

    file
      .text()
      .then((text) => {
        if (!text || !text.trim()) {
          this.conversionStatus = {
            status: 'error',
            message: `The file ${file.name} appears to be empty. Please upload a file with content.`
          };
          this.resultOutput = '';
          this.updateResultLineNumbers();
          this.toast.error('File is empty');
          return;
        }

        if (isMarkdownFileName(file.name)) {
          this.conversionMode = 'markdown-to-html';
          this.markdownInput = text;
          this.onMarkdownInputChange(text);
          this.conversionStatus = {
            status: 'idle',
            message: `Loaded Markdown file (${file.name}). Configure HTML options and convert when ready.`
          };
          this.toast.info(`Loaded ${file.name}`);
        } else if (isHtmlFileName(file.name)) {
          this.conversionMode = 'html-to-markdown';
          this.htmlInput = text;
          this.onHtmlInputChange(text);
          this.conversionStatus = {
            status: 'idle',
            message: `Loaded HTML file (${file.name}). Configure Markdown options and convert when ready.`
          };
          this.toast.info(`Loaded ${file.name}`);
        }
      })
      .catch(() => {
        this.conversionStatus = {
          status: 'error',
          message: `Could not read the file ${file.name}. Please check file permissions and try again.`
        };
        this.resultOutput = '';
        this.updateResultLineNumbers();
        this.toast.error('Could not read file');
      });
  }

  private recordHistory(label: string): void {
    const timestamp = new Date().toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit'
    });
    this.operationHistory = [{ label, timestamp }, ...this.operationHistory].slice(
      0,
      MARKDOWN_TO_HTML_HISTORY_LIMIT
    );
  }

  private loadSample(): void {
    this.markdownInput = MARKDOWN_TO_HTML_SAMPLE_MARKDOWN;
    this.htmlInput = MARKDOWN_TO_HTML_SAMPLE_HTML;
    this.resultOutput = '';
    this.conversionMode = 'markdown-to-html';
    this.dismissedSuggestionId = null;

    this.markdownWrapParagraphs = true;
    this.markdownConvertLineBreaks = false;
    this.markdownEscapeHtml = true;
    this.markdownSmartTypography = false;
    this.htmlBulletStyle = '-';
    this.htmlHeadingStyle = 'atx';
    this.htmlCollapseWhitespace = true;
    this.htmlKeepLinks = true;
    this.htmlCodeFence = '```';

    this.updateEditorLineNumbers();
    this.updateResultLineNumbers();
    this.updateMetrics(this.markdownInput, 'Markdown');
    this.conversionStatus = {
      status: 'idle',
      message: 'Sample Markdown loaded. Adjust options and convert when ready.'
    };
    this.operationHistory = [];
    this.copyStatus = 'idle';
  }

  private updateEditorLineNumbers(): void {
    const content =
      this.conversionMode === 'markdown-to-html' ? this.markdownInput : this.htmlInput;
    this.editorLines = buildMarkdownToHtmlLineNumbers(content);
  }

  private updateResultLineNumbers(): void {
    this.resultLines = buildMarkdownToHtmlLineNumbers(this.resultOutput);
  }
}
