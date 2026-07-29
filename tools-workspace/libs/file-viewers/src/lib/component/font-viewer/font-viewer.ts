import { Component, ElementRef, OnDestroy, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Navigation, TooltipDirective, AssetService, ToastService } from '@tools-workspace/features-home';
import type { FvRelatedToolLink } from '../../shared/fv-tool-suggestion.model';
import {
  FONT_ACCEPT_ATTR,
  FONT_CHARACTER_SHOWCASES,
  FONT_COMPARISON_OPTIONS,
  FONT_DEFAULT_SAMPLE_TEXT,
  FONT_FORMAT_HINTS,
  FONT_PREVIEW_TEMPLATES,
  FONT_RELATED_TOOLS,
  FONT_USAGE_STEPS,
  FONT_WEIGHT_OPTIONS
} from '../../constants/font-viewer.constants';
import type {
  FontCharacterShowcase,
  FontComparisonOption,
  FontMetadata,
  FontPreviewTemplate
} from '../../types/font-viewer.types';
import {
  buildFontMetadata,
  buildFontPreviewHostStyles,
  createFontFamilyName,
  getDefaultUploadedFontFamily,
  getDocument,
  getFontFileExtension,
  getFontPreviewDefaults,
  isAllowedFontFormat,
  isFontApiSupported,
  normalizeFontFaceValue,
  resolveFontSuggestion
} from '../../utils/font-viewer.utils';

@Component({
  selector: 'lib-font-viewer',
  standalone: true,
  templateUrl: './font-viewer.html',
  styleUrls: ['./font-viewer.scss'],
  imports: [CommonModule, FormsModule, RouterLink, Navigation, TooltipDirective]
})
export class FontViewerComponent implements OnDestroy {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  readonly acceptAttr = FONT_ACCEPT_ATTR;
  readonly relatedTools: ReadonlyArray<FvRelatedToolLink> = FONT_RELATED_TOOLS;
  readonly weightOptions = FONT_WEIGHT_OPTIONS;
  readonly defaultSampleText = FONT_DEFAULT_SAMPLE_TEXT;
  readonly previewTemplates: ReadonlyArray<FontPreviewTemplate> = FONT_PREVIEW_TEMPLATES;
  readonly comparisonFonts: ReadonlyArray<FontComparisonOption> = FONT_COMPARISON_OPTIONS;
  readonly characterShowcases: ReadonlyArray<FontCharacterShowcase> = FONT_CHARACTER_SHOWCASES;
  readonly usageSteps = FONT_USAGE_STEPS;
  readonly formatHints = FONT_FORMAT_HINTS;

  sampleText = this.defaultSampleText;
  selectedTemplateId: string = this.previewTemplates[1].id;
  fontSize = getFontPreviewDefaults().fontSize;
  lineHeight = getFontPreviewDefaults().lineHeight;
  letterSpacing = getFontPreviewDefaults().letterSpacing;
  wordSpacing = getFontPreviewDefaults().wordSpacing;
  textColor = getFontPreviewDefaults().textColor;
  backgroundColor = getFontPreviewDefaults().backgroundColor;
  uppercase = getFontPreviewDefaults().uppercase;
  enableSmoothPreview = getFontPreviewDefaults().enableSmoothPreview;

  fontLoaded = false;
  isDragOver = false;
  loadError: string | null = null;
  showAbout = false;
  dismissedSuggestionId: string | null = null;

  uploadedFontFamily = getDefaultUploadedFontFamily();
  comparisonFont = this.comparisonFonts[0].value;

  fontMetadata?: FontMetadata;
  downloadUrl?: string;

  selectedWeight = getFontPreviewDefaults().selectedWeight;
  selectedStyle = getFontPreviewDefaults().selectedStyle;

  private fontFaceInstance: FontFace | null = null;

  get fontApiSupported(): boolean {
    return isFontApiSupported();
  }

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
    return buildFontPreviewHostStyles({
      uploadedFontFamily: this.uploadedFontFamily,
      fontSize: this.fontSize,
      lineHeight: this.lineHeight,
      letterSpacing: this.letterSpacing,
      wordSpacing: this.wordSpacing,
      textColor: this.textColor,
      backgroundColor: this.backgroundColor,
      uppercase: this.uppercase,
      selectedWeight: this.selectedWeight,
      selectedStyle: this.selectedStyle,
      enableSmoothPreview: this.enableSmoothPreview
    });
  }

  get comparisonPreviewText(): string {
    return this.uppercase ? this.sampleText.toUpperCase() : this.sampleText;
  }

  get primarySuggestion() {
    const suggestion = resolveFontSuggestion({
      fontApiSupported: this.fontApiSupported,
      hasFont: this.fontLoaded,
      hasError: !!this.loadError,
      formatExtension: this.fontMetadata
        ? getFontFileExtension(this.fontMetadata.fileName)
        : ''
    });
    if (!suggestion || this.dismissedSuggestionId === suggestion.id) {
      return null;
    }
    return suggestion;
  }

  ngOnDestroy(): void {
    this.cleanupFont();
  }

  dismissSuggestion(suggestionId: string): void {
    this.dismissedSuggestionId = suggestionId;
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

  downloadFont(): void {
    if (!this.downloadUrl || !this.fontMetadata) {
      return;
    }
    const link = document.createElement('a');
    link.href = this.downloadUrl;
    link.download = this.fontMetadata.fileName;
    link.click();
    this.toast.info(`Downloaded ${this.fontMetadata.fileName}`);
  }

  resetPreviewControls(): void {
    const defaults = getFontPreviewDefaults();
    this.fontSize = defaults.fontSize;
    this.lineHeight = defaults.lineHeight;
    this.letterSpacing = defaults.letterSpacing;
    this.wordSpacing = defaults.wordSpacing;
    this.textColor = defaults.textColor;
    this.backgroundColor = defaults.backgroundColor;
    this.uppercase = defaults.uppercase;
    this.enableSmoothPreview = defaults.enableSmoothPreview;
    this.selectedWeight = defaults.selectedWeight;
    this.selectedStyle = defaults.selectedStyle;
  }

  clearFont(): void {
    this.cleanupFont();
    this.fontLoaded = false;
    this.fontMetadata = undefined;
    this.loadError = null;
    this.dismissedSuggestionId = null;
    this.uploadedFontFamily = getDefaultUploadedFontFamily();
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
    void this.loadFontFile(file);
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
    void this.loadFontFile(file);
  }

  trackByTemplateId(_: number, template: FontPreviewTemplate): string {
    return template.id;
  }

  private async loadFontFile(file: File): Promise<void> {
    if (!this.fontApiSupported) {
      this.loadError =
        'Font preview is not supported in this browser. Please switch to a modern browser.';
      return;
    }

    this.loadError = null;
    this.dismissedSuggestionId = null;

    if (!isAllowedFontFormat(file.name)) {
      this.loadError = 'Unsupported file type. Please upload TTF, OTF, WOFF, or WOFF2 fonts.';
      return;
    }

    try {
      this.cleanupFont();
      const fontFamilyName = createFontFamilyName(file.name);
      const arrayBuffer = await file.arrayBuffer();
      const fontFace = new FontFace(fontFamilyName, arrayBuffer);
      this.fontFaceInstance = await fontFace.load();
      const fonts = (getDocument() as Document & { fonts?: unknown })?.fonts as
        | { add?: (font: FontFace) => unknown }
        | undefined;
      fonts?.add?.(this.fontFaceInstance);

      this.uploadedFontFamily = `'${fontFamilyName}', sans-serif`;
      this.fontLoaded = true;
      this.selectedWeight = normalizeFontFaceValue(this.fontFaceInstance.weight, '400');
      this.selectedStyle = normalizeFontFaceValue(this.fontFaceInstance.style, 'normal');

      if (this.downloadUrl) {
        try {
          URL.revokeObjectURL(this.downloadUrl);
        } catch {
          // Ignore invalid object URLs when replacing
        }
      }
      this.downloadUrl = URL.createObjectURL(file);
      this.fontMetadata = buildFontMetadata(file, this.fontFaceInstance);
    } catch {
      this.loadError = 'We could not preview this font. Please verify the file and try again.';
      this.fontLoaded = false;
      this.fontMetadata = undefined;
    }
  }

  private cleanupFont(): void {
    if (this.fontFaceInstance) {
      const fonts = (getDocument() as Document & { fonts?: unknown })?.fonts as
        | { delete?: (font: FontFace) => unknown }
        | undefined;
      fonts?.delete?.(this.fontFaceInstance);
      this.fontFaceInstance = null;
    }

    if (this.downloadUrl) {
      try {
        URL.revokeObjectURL(this.downloadUrl);
      } catch {
        // Ignore invalid object URLs during teardown
      }
      this.downloadUrl = undefined;
    }
  }
}
