import { Component, OnDestroy, ViewChild, ElementRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Navigation, TooltipDirective, AssetService } from '@tools-workspace/features-home';

interface FontMetadata {
  fileName: string;
  formattedSize: string;
  rawSize: number;
  mimeType: string;
  formatLabel: string;
  lastModified: string;
  family: string;
  style: string;
  weight: string;
  stretch: string;
  variationSettings?: string;
}

interface PreviewTemplate {
  id: string;
  label: string;
  description: string;
  content: string;
}

@Component({
  selector: 'lib-font-viewer',
  standalone: true,
  templateUrl: './font-viewer.html',
  styleUrls: ['./font-viewer.scss'],
  imports: [CommonModule, FormsModule, Navigation, TooltipDirective]
})
export class FontViewerComponent implements OnDestroy {
  readonly assetService = inject(AssetService);
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  get fontApiSupported(): boolean {
    return (
      'FontFace' in (globalThis as typeof globalThis & { FontFace?: unknown }) &&
      this.getDocument() !== undefined
    );
  }

  readonly defaultSampleText =
    'The quick brown fox jumps over the lazy dog \u00B7 1234567890 \u00B7 !?';

  readonly previewTemplates: PreviewTemplate[] = [
    {
      id: 'headline',
      label: 'Hero Headline',
      description: 'Large display text for landing pages and marketing banners.',
      content: 'Elevate your story with beautifully rendered typography.'
    },
    {
      id: 'paragraph',
      label: 'Body Copy',
      description: 'A longer passage to review readability in paragraphs.',
      content:
        'Great typography balances personality with legibility. Preview multiple font sizes, colors, and weights to ensure your project feels cohesive and accessible across every device.'
    },
    {
      id: 'ui',
      label: 'Interface Labels',
      description: 'Short snippets that mimic buttons, badges, and navigation.',
      content: 'Primary Action \u00B7 Secondary \u00B7 Tab Label \u00B7 Badge 42'
    },
    {
      id: 'numbers',
      label: 'Numeric Data',
      description: 'Ideal for dashboards, pricing tables, and data-heavy layouts.',
      content: '123 456 789 \u00B7 01 / 23 / 45 \u00B7 $1,299.00 \u00B7 98.76%'
    }
  ];

  readonly comparisonFonts = [
    {
      label: 'System default (Inter)',
      value: "'Inter', 'Helvetica Neue', Arial, sans-serif"
    },
    {
      label: 'Serif (Georgia)',
      value: "Georgia, 'Times New Roman', serif"
    },
    {
      label: 'Mono (SFMono)',
      value: "'SFMono-Regular', 'Courier New', monospace"
    },
    {
      label: 'Display (Baskerville)',
      value: "'Libre Baskerville', 'Baskerville', serif"
    }
  ];

  readonly characterShowcases = [
    {
      title: 'Alphabet',
      description: 'Uppercase, lowercase, and digits for quick visual checks.',
      characters: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ\nabcdefghijklmnopqrstuvwxyz\n0123456789'
    },
    {
      title: 'Punctuation',
      description: 'Articles, quotes, and interface copy rely heavily on these.',
      characters: '! ? . , ; : \' " \u2013 \u2014 ( ) [ ] { } / \\ @ # $ % & *'
    },
    {
      title: 'Symbols',
      description: 'Currency, math, and UI symbols for financial or analytic UI.',
      characters:
        '\u20AC \u00A3 \u00A5 \u20A9 \u20BF \u00B1 \u00D7 \u00F7 \u2248 \u2260 \u2265 \u2264 \u221E \u2211 \u221A \u2206 \u00B5 \u00B0 \u2030 \u00A7 \u2020 \u2021 \u00B6'
    }
  ];

  readonly usageSteps = [
    'Drop a font file (TTF, OTF, WOFF, or WOFF2) or pick one from your device.',
    'Adjust size, color, and spacing to recreate real-world scenarios.',
    'Browse glyph groups and compare alongside familiar system fonts.',
    'Download metadata and share preview controls with teammates.'
  ];

  readonly formatHints = ['TTF', 'OTF', 'WOFF', 'WOFF2'];

  sampleText = this.defaultSampleText;
  selectedTemplateId: string = this.previewTemplates[1].id;
  fontSize = 48;
  lineHeight = 1.3;
  letterSpacing = 0;
  wordSpacing = 0;
  textColor = '#1d1d1f';
  backgroundColor = '#f9fafc';
  uppercase = false;
  enableSmoothPreview = true;

  fontLoaded = false;
  isDragOver = false;
  loadError: string | null = null;
  showAbout = false;

  uploadedFontFamily = "'Inter', 'Helvetica Neue', Arial, sans-serif";
  comparisonFont = this.comparisonFonts[0].value;

  fontMetadata?: FontMetadata;
  downloadUrl?: string;

  selectedWeight = '400';
  selectedStyle = 'normal';

  private fontFaceInstance: FontFace | null = null;

  get loadedFontsCount(): number {
    return this.fontLoaded ? 1 : 0;
  }

  get activeTemplateLabel(): string {
    const template = this.previewTemplates.find((item) => item.id === this.selectedTemplateId);
    if (template) {
      return template.label;
    }
    if (this.selectedTemplateId === 'custom') {
      return 'Custom';
    }
    return this.previewTemplates[0].label;
  }

  get formatSummary(): string {
    return this.fontMetadata?.formatLabel ?? '—';
  }

  get fontStatus(): string {
    if (this.loadError) {
      return 'Error';
    }
    return this.fontLoaded ? 'Ready' : 'Waiting';
  }

  get previewHostStyles(): Record<string, string | number> {
    return {
      'font-family': this.uploadedFontFamily,
      'font-size': `${this.fontSize}px`,
      'line-height': this.lineHeight.toString(),
      'letter-spacing': `${this.letterSpacing}px`,
      'word-spacing': `${this.wordSpacing}px`,
      color: this.textColor,
      'background-color': this.backgroundColor,
      'text-transform': this.uppercase ? 'uppercase' : 'none',
      'font-weight': this.selectedWeight,
      'font-style': this.selectedStyle,
      'font-smooth': this.enableSmoothPreview ? 'always' : 'auto'
    };
  }

  get comparisonPreviewText(): string {
    return this.uppercase ? this.sampleText.toUpperCase() : this.sampleText;
  }

  ngOnDestroy(): void {
    this.cleanupFont();
  }

  onTemplateSelect(templateId: string): void {
    const template = this.previewTemplates.find((item) => item.id === templateId);
    if (!template) {
      return;
    }
    this.selectedTemplateId = templateId;
    this.sampleText = template.content;
  }

  onSampleTextInput(value: string): void {
    this.sampleText = value;
    this.selectedTemplateId = 'custom';
  }

  resetPreviewControls(): void {
    this.fontSize = 48;
    this.lineHeight = 1.3;
    this.letterSpacing = 0;
    this.wordSpacing = 0;
    this.textColor = '#1d1d1f';
    this.backgroundColor = '#f9fafc';
    this.uppercase = false;
    this.enableSmoothPreview = true;
    this.selectedWeight = '400';
    this.selectedStyle = 'normal';
  }

  clearFont(): void {
    this.cleanupFont();
    this.fontLoaded = false;
    this.fontMetadata = undefined;
    this.loadError = null;
    this.uploadedFontFamily = "'Inter', 'Helvetica Neue', Arial, sans-serif";
    if (this.fileInput?.nativeElement) {
      this.fileInput.nativeElement.value = '';
    }
  }

  toggleAbout(): void {
    this.showAbout = !this.showAbout;
  }

  openFileDialog(): void {
    this.fileInput?.nativeElement.click();
  }

  onFileInputChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }
    this.handleFontFile(file);
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
    this.handleFontFile(file);
  }

  trackByTemplateId(_: number, template: PreviewTemplate): string {
    return template.id;
  }

  private async handleFontFile(file: File): Promise<void> {
    if (!this.fontApiSupported) {
      this.loadError =
        'Font preview is not supported in this browser. Please switch to a modern browser.';
      return;
    }

    this.loadError = null;

    if (!this.isAllowedFormat(file.name)) {
      this.loadError = 'Unsupported file type. Please upload TTF, OTF, WOFF, or WOFF2 fonts.';
      return;
    }

    try {
      this.cleanupFont();
      const fontFamilyName = this.createFontFamilyName(file.name);
      const arrayBuffer = await file.arrayBuffer();
      const fontFace = new FontFace(fontFamilyName, arrayBuffer);
      this.fontFaceInstance = await fontFace.load();
      const fonts = (this.getDocument() as Document & { fonts?: unknown })?.fonts as
        | { add?: (font: FontFace) => unknown }
        | undefined;
      fonts?.add?.(this.fontFaceInstance);

      this.uploadedFontFamily = `'${fontFamilyName}', sans-serif`;
      this.fontLoaded = true;
      this.selectedWeight = this.normalizeFontFaceValue(this.fontFaceInstance.weight, '400');
      this.selectedStyle = this.normalizeFontFaceValue(this.fontFaceInstance.style, 'normal');

      if (this.downloadUrl) {
        URL.revokeObjectURL(this.downloadUrl);
      }
      this.downloadUrl = URL.createObjectURL(file);
      this.fontMetadata = this.buildMetadata(file, this.fontFaceInstance);
    } catch (error) {
      console.error('Unable to load font file:', error);
      this.loadError = 'We could not preview this font. Please verify the file and try again.';
      this.fontLoaded = false;
      this.fontMetadata = undefined;
    }
  }

  private createFontFamilyName(fileName: string): string {
    const name =
      fileName.lastIndexOf('.') > 0 ? fileName.slice(0, fileName.lastIndexOf('.')) : fileName;
    let sanitized = '';
    let previousIsHyphen = false;

    for (const char of name) {
      if (/^[a-zA-Z0-9-]$/.test(char)) {
        sanitized += char;
        previousIsHyphen = char === '-';
      } else if (!previousIsHyphen) {
        sanitized += '-';
        previousIsHyphen = true;
      }
    }

    while (sanitized.startsWith('-')) {
      sanitized = sanitized.slice(1);
    }

    while (sanitized.endsWith('-')) {
      sanitized = sanitized.slice(0, -1);
    }

    const result = sanitized.slice(0, 40);
    return result || 'Uploaded-Font';
  }

  private isAllowedFormat(fileName: string): boolean {
    const lowerName = fileName.toLowerCase();
    return this.formatHints.some((extension) => lowerName.endsWith(extension.toLowerCase()));
  }

  private formatFileSize(bytes: number): string {
    if (bytes === 0) {
      return '0 B';
    }
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 2)} ${sizes[i]}`;
  }

  private buildMetadata(file: File, fontFace: FontFace): FontMetadata {
    const lastModified = new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(new Date(file.lastModified));

    return {
      fileName: file.name,
      formattedSize: this.formatFileSize(file.size),
      rawSize: file.size,
      mimeType: file.type || 'application/octet-stream',
      formatLabel: this.detectFormatLabel(file.name),
      lastModified,
      family: fontFace.family,
      style: this.normalizeFontFaceValue(fontFace.style, 'normal'),
      weight: this.normalizeFontFaceValue(fontFace.weight, '400'),
      stretch: this.normalizeFontFaceValue(fontFace.stretch, 'normal'),
      variationSettings: fontFace.featureSettings
    };
  }

  private detectFormatLabel(fileName: string): string {
    const extension = fileName.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'ttf':
        return 'TrueType Font (.ttf)';
      case 'otf':
        return 'OpenType Font (.otf)';
      case 'woff':
        return 'Web Open Font Format (.woff)';
      case 'woff2':
        return 'Web Open Font Format 2 (.woff2)';
      default:
        return 'Unknown format';
    }
  }

  private normalizeFontFaceValue(value: string, fallback: string): string {
    if (!value || value === 'normal') {
      return fallback;
    }
    return value;
  }

  private cleanupFont(): void {
    if (this.fontFaceInstance) {
      const fonts = (this.getDocument() as Document & { fonts?: unknown })?.fonts as
        | { delete?: (font: FontFace) => unknown }
        | undefined;
      fonts?.delete?.(this.fontFaceInstance);
      this.fontFaceInstance = null;
    }

    if (this.downloadUrl) {
      URL.revokeObjectURL(this.downloadUrl);
      this.downloadUrl = undefined;
    }
  }
  private getDocument(): Document | undefined {
    return (globalThis as typeof globalThis & { document?: Document }).document;
  }
}
