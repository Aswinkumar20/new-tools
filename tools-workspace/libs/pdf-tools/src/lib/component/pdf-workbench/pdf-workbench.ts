import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  Input,
  OnDestroy,
  ViewChild,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Navigation, TooltipDirective, AssetService, ToastService } from '@tools-workspace/features-home';
import type { PDFDocument } from 'pdf-lib';
import { PasswordRequiredError, PdfLibService } from '../../services/pdf-lib.service';
import { PdfJspdfService } from '../../services/pdf-jspdf.service';
import { PdfPreviewService } from '../../services/pdf-preview.service';
import { PdfFullscreenOverlayComponent } from '../pdf-fullscreen-overlay/pdf-fullscreen-overlay';
import type { AnnotationDraft, PdfFormFieldInfo, PdfMetadataInfo, PdfPageState, PdfToolMode } from '../../shared/pdf.types';
import { fullscreenPreviewWidth } from '../../shared/pdf-fullscreen.util';
import {
  PDF_MAX_BYTES,
  cloneBytes,
  defaultOutputName,
  downloadBytes,
  downloadText,
  formatFileSize,
  parsePageRanges,
} from '../../shared/pdf.utils';
import {
  validateEmail,
  validateFontSize,
  validateImageFiles,
  validateOpacity,
  validateOutputFilename,
  validatePageRangeInput,
  validatePassword,
  validateRequiredText,
  validateTableData,
} from '../../shared/pdf.validation';
import { pdfNotifyError, pdfNotifySuccess, pdfNotifyWarning } from '../../shared/pdf-feedback.util';

const SESSION_KEY = 'easytoolhub.pdf.session';

@Component({
  selector: 'lib-pdf-workbench',
  standalone: true,
  templateUrl: './pdf-workbench.html',
  styleUrls: ['./pdf-workbench.scss'],
  imports: [CommonModule, FormsModule, Navigation, TooltipDirective, PdfFullscreenOverlayComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PdfWorkbenchComponent implements OnDestroy {
  readonly assetService = inject(AssetService);
  private readonly pdfLib = inject(PdfLibService);
  private readonly jspdf = inject(PdfJspdfService);
  private readonly preview = inject(PdfPreviewService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);

  @Input({ required: true }) mode!: PdfToolMode;
  @Input({ required: true }) title = 'PDF Tool';
  @Input({ required: true }) description = '';

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('previewCanvas') previewCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('previewCanvasWrap') previewCanvasWrap?: ElementRef<HTMLElement>;
  @ViewChild('imageInput') imageInput?: ElementRef<HTMLInputElement>;
  @ViewChild('optionsFlyout') optionsFlyout?: ElementRef<HTMLElement>;
  @ViewChild(PdfFullscreenOverlayComponent) fullscreenOverlay?: PdfFullscreenOverlayComponent;

  previewFullscreen = false;

  fileName = '';
  fileSize = 0;
  pdfBytes: Uint8Array | null = null;
  pdfDoc: PDFDocument | null = null;
  pages: PdfPageState[] = [];
  thumbnails: string[] = [];
  currentPage = 1;
  outputBytes: Uint8Array | null = null;

  loading = false;
  loadingMessage = 'Processing…';
  previewRendering = false;
  previewError = '';
  fieldErrors: Record<string, string> = {};
  showDropZone = false;
  optionsPanelOpen = true;

  showPasswordDialog = false;
  passwordInput = '';
  passwordError = '';
  pendingFile: File | null = null;
  docPassword = '';

  // Mode-specific state
  pageRangeInput = '';
  outputFilename = '';
  metadata: PdfMetadataInfo = {
    title: '',
    author: '',
    subject: '',
    keywords: '',
    creator: '',
    producer: '',
  };
  formFields: PdfFormFieldInfo[] = [];
  base64Output = '';
  extractedText = '';
  userPassword = '';
  ownerPassword = '';
  plainTextInput = '';
  htmlInput = '';
  watermarkText = 'CONFIDENTIAL';
  watermarkOpacity = 0.3;
  annotationText = '';
  annotationFontSize = 14;
  highlightColor = '#ffff00';
  tableHeaders = 'Column 1,Column 2,Column 3';
  tableRows = 'A1,B1,C1\nA2,B2,C2';
  tableTitle = 'Data Table';
  resume = { name: '', email: '', phone: '', summary: '', experience: '', education: '' };
  annotations: AnnotationDraft[] = [];
  placementMode = false;
  dragPageIndex: number | null = null;
  pageNumberPosition: 'bottom-left' | 'bottom-center' | 'bottom-right' | 'top-left' | 'top-center' | 'top-right' =
    'bottom-center';
  pageNumberFontSize = 10;
  pageNumberStart = 1;
  pageNumberFormat: 'number' | 'page-of-total' = 'page-of-total';

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  private undoStack: Uint8Array[] = [];
  private redoStack: Uint8Array[] = [];
  private modifiedDoc: PDFDocument | null = null;
  private previewRenderRetries = 0;
  private readonly maxPreviewRenderRetries = 20;
  private previewRenderGeneration = 0;
  private previewRenderInFlight = false;

  ngOnDestroy(): void {
    this.preview.clearCache();
    this.previewFullscreen = false;
  }

  togglePreviewFullscreen(): void {
    if (!this.hasDocument) return;
    if (this.previewFullscreen) {
      this.closePreviewFullscreen();
    } else {
      this.openPreviewFullscreen();
    }
  }

  openPreviewFullscreen(): void {
    if (!this.hasDocument) return;
    this.previewFullscreen = true;
    this.cdr.markForCheck();
    this.scheduleRenderPreview();
  }

  closePreviewFullscreen(): void {
    this.previewFullscreen = false;
    this.cdr.markForCheck();
    this.scheduleRenderPreview();
  }

  private activePreviewCanvas(): HTMLCanvasElement | undefined {
    if (this.previewFullscreen) {
      return this.fullscreenOverlay?.canvasElement;
    }
    return (
      this.previewCanvas?.nativeElement ??
      this.previewCanvasWrap?.nativeElement?.querySelector('canvas') ??
      undefined
    );
  }

  get totalPages(): number {
    return this.pages.length;
  }

  get hasDocument(): boolean {
    return !!this.pdfBytes && !!this.pdfDoc;
  }

  get previewBytes(): Uint8Array | null {
    return this.outputBytes ?? this.pdfBytes;
  }

  get canDownload(): boolean {
    if (this.loading) return false;
    if (this.isCreationMode || this.mode === 'screenshot-to-pdf' || this.mode === 'image-to-pdf') {
      return !!this.outputBytes?.length;
    }
    if (this.mode === 'pdf-to-base64') {
      return !!this.pdfBytes?.length;
    }
    return this.hasDocument;
  }

  get canRunPrimaryAction(): boolean {
    if (this.loading) return false;
    if (this.isCreationMode || this.mode === 'screenshot-to-pdf' || this.mode === 'image-to-pdf') {
      return true;
    }
    return this.hasDocument;
  }

  get canExtractText(): boolean {
    return this.hasDocument && !this.loading;
  }

  get canClearAll(): boolean {
    return !this.loading && (this.hasDocument || !!this.plainTextInput.trim() || !!this.outputBytes?.length);
  }

  get supportsPageThumbnails(): boolean {
    return [
      'delete-pages',
      'rotate-pages',
      'reorder-pages',
      'extract-pages',
      'annotate-pdf',
      'highlight-text',
    ].includes(this.mode);
  }

  get isCreationMode(): boolean {
    return [
      'text-to-pdf',
      'create-pdf-from-html',
      'tables-charts-to-pdf',
      'resume-invoice-generator',
    ].includes(this.mode);
  }

  get needsPdfUpload(): boolean {
    return !this.isCreationMode;
  }

  get hasOptionsPanel(): boolean {
    return this.hasDocument && !this.isCreationMode;
  }

  get configSetupHint(): string {
    const hints: Partial<Record<PdfToolMode, string>> = {
      'delete-pages': 'Select pages to remove using thumbnails or page ranges in Configuration.',
      'extract-pages': 'Select pages to extract using thumbnails or page ranges in Configuration.',
      'reorder-pages': 'Drag thumbnails to reorder pages, then apply the new order.',
      'rotate-pages': 'Rotate pages using toolbar controls, then apply rotation.',
      'add-watermark': 'Enter watermark text and opacity in Configuration before applying.',
      'annotate-pdf': 'Enter annotation text, enable Place, then click on the preview.',
      'highlight-text': 'Enable Place in the toolbar, then click on the preview to add highlights.',
      'password-protect-pdf': 'Set a user password in Configuration before applying.',
      'fill-pdf-forms': 'Fill detected form fields in Configuration, then save.',
      'flatten-pdf-forms': 'This PDF must contain fillable form fields to flatten.',
      'pdf-metadata-editor': 'Edit title, author, and other metadata in Configuration.',
      'compress-pdf': 'Optional: set an output filename, then compress.',
      'pdf-to-base64': 'Run encode to generate Base64 output.',
      'add-page-numbers': 'Choose position, font size, and format in Configuration before applying.',
    };
    return hints[this.mode] ?? 'Review settings in Configuration before running the primary action.';
  }

  /** Short description shown inside the configuration sidebar (no duplicate “Configuration” title). */
  get configPanelDescription(): string {
    const desc: Partial<Record<PdfToolMode, string>> = {
      'delete-pages': 'Choose which pages to remove from this PDF.',
      'extract-pages': 'Choose pages to extract into a new PDF.',
      'reorder-pages': 'Drag thumbnails to reorder, then apply.',
      'rotate-pages': 'Rotate pages in the toolbar, then apply.',
      'add-watermark': 'Set watermark text and opacity, then apply.',
      'annotate-pdf': 'Add text annotations on the preview.',
      'highlight-text': 'Click the preview to place highlight boxes.',
      'password-protect-pdf': 'Set passwords for the exported PDF.',
      'fill-pdf-forms': 'Complete the detected form fields below.',
      'flatten-pdf-forms': 'Bake form fields into static page content.',
      'pdf-metadata-editor': 'Update document properties and metadata.',
      'compress-pdf': 'Optimize file size with object-stream compression.',
      'pdf-to-base64': 'Encode the uploaded PDF as Base64 text.',
    };
    return desc[this.mode] ?? 'Adjust options below, then use the toolbar action.';
  }

  get compressOutputSizeLabel(): string | null {
    if (this.mode !== 'compress-pdf' || !this.outputBytes?.length) return null;
    return formatFileSize(this.outputBytes.length);
  }

  get compressSavingsLabel(): string | null {
    if (this.mode !== 'compress-pdf' || !this.fileSize || !this.outputBytes?.length) return null;
    const saved = this.fileSize - this.outputBytes.length;
    if (saved <= 0) return 'Similar size — in-browser compression is limited to structure optimization.';
    const pct = Math.round((saved / this.fileSize) * 100);
    return `About ${pct}% smaller (${formatFileSize(saved)} saved)`;
  }

  get needsConfigAttention(): boolean {
    if (!this.hasDocument || this.isCreationMode) return false;
    switch (this.mode) {
      case 'delete-pages':
      case 'extract-pages':
        return this.getSelectedPageCount() === 0;
      case 'password-protect-pdf':
        return !this.userPassword.trim();
      case 'annotate-pdf':
      case 'highlight-text':
        return this.annotations.length === 0;
      case 'fill-pdf-forms':
      case 'flatten-pdf-forms':
        return this.formFields.length === 0;
      default:
        return false;
    }
  }

  openOptionsPanel(): void {
    this.optionsPanelOpen = true;
    this.optionsFlyout?.nativeElement?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    this.cdr.markForCheck();
  }

  toggleOptionsPanel(): void {
    this.optionsPanelOpen = !this.optionsPanelOpen;
    this.cdr.markForCheck();
  }

  get capabilityNote(): string {
    const notes: Partial<Record<PdfToolMode, string>> = {
      'compress-pdf':
        'pdf-lib re-saves with object streams. True image compression is limited in-browser.',
      'create-pdf-from-html': 'HTML is converted to plain text layout (no CSS rendering).',
      'password-protect-pdf': 'pdf-lib cannot encrypt PDFs — not supported without a backend.',
      'flatten-pdf-forms': 'Flattens AcroForm fields into static content.',
      'pdf-to-base64': 'Fully supported — no upload required for output copy.',
    };
    return notes[this.mode] ?? '';
  }

  openFileDialog(): void {
    this.fileInput?.nativeElement?.click();
  }

  openImageDialog(): void {
    this.imageInput?.nativeElement?.click();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) void this.loadFile(file);
    input.value = '';
  }

  onImagesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = input.files ? Array.from(input.files) : [];
    if (files.length) void this.createFromImages(files);
    input.value = '';
  }

  onDragEnter(event: DragEvent): void {
    event.preventDefault();
    this.showDropZone = true;
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.showDropZone = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.showDropZone = false;
    const file = event.dataTransfer?.files?.[0];
    if (!file) return;
    if (this.mode === 'screenshot-to-pdf' || this.mode === 'image-to-pdf') {
      const images = Array.from(event.dataTransfer.files).filter((f) => f.type.startsWith('image/'));
      if (images.length) void this.createFromImages(images);
      return;
    }
    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      void this.loadFile(file);
    } else {
      pdfNotifyError(this.toast, 'Please drop a valid PDF file');
      this.cdr.markForCheck();
    }
  }

  async loadFile(file: File, password?: string): Promise<void> {
    if (file.size > PDF_MAX_BYTES) {
      pdfNotifyError(this.toast, 'File exceeds 100 MB limit');
      this.cdr.markForCheck();
      return;
    }
    this.loading = true;
    this.loadingMessage = 'Loading PDF…';
    this.cdr.markForCheck();
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const doc = await this.pdfLib.loadDocument(bytes, password);
      this.applyLoadedDocument(file, bytes, doc, password);
      pdfNotifySuccess(this.toast, 'PDF loaded');
      if (this.needsConfigAttention) {
        this.openOptionsPanel();
      }
    } catch (error) {
      if (error instanceof PasswordRequiredError) {
        this.pendingFile = file;
        this.showPasswordDialog = true;
        this.passwordInput = '';
        this.passwordError = 'This PDF is password-protected.';
      } else {
        pdfNotifyError(this.toast, error instanceof Error ? error.message : 'Failed to load PDF');
      }
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
      if (this.hasDocument) {
        this.scheduleRenderPreview();
      } else {
        this.cdr.markForCheck();
      }
    }
  }

  private applyLoadedDocument(file: File, bytes: Uint8Array, doc: PDFDocument, password?: string): void {
    this.preview.clearCache();
    this.fileName = file.name;
    this.fileSize = file.size;
    this.pdfBytes = new Uint8Array(bytes);
    this.pdfDoc = doc;
    this.docPassword = password ?? '';
    this.outputBytes = null;
    this.outputFilename = defaultOutputName(file.name, this.mode.replace(/-/g, ''));
    this.pages = doc.getPageIndices().map((sourceIndex) => ({
      sourceIndex,
      rotation: 0,
      selected: false,
    }));
    this.currentPage = 1;
    this.undoStack = [];
    this.redoStack = [];
    this.modifiedDoc = null;
    if (this.mode === 'pdf-metadata-editor') {
      this.metadata = this.pdfLib.readMetadata(doc);
    }
    if (this.mode === 'fill-pdf-forms' || this.mode === 'flatten-pdf-forms') {
      this.formFields = this.pdfLib.listFormFields(doc);
    }
    void this.refreshThumbnails();
    this.optionsPanelOpen = true;
    this.saveSession();
    this.cdr.markForCheck();
  }

  async submitPassword(): Promise<void> {
    if (!this.pendingFile || !this.passwordInput.trim()) {
      this.passwordError = 'Enter the PDF password';
      this.cdr.markForCheck();
      return;
    }
    const file = this.pendingFile;
    this.showPasswordDialog = false;
    this.pendingFile = null;
    await this.loadFile(file, this.passwordInput.trim());
  }

  cancelPassword(): void {
    this.showPasswordDialog = false;
    this.pendingFile = null;
    this.passwordInput = '';
    this.cdr.markForCheck();
  }

  async refreshThumbnails(): Promise<void> {
    if (!this.previewBytes || !this.supportsPageThumbnails) return;
    try {
      const thumbs: string[] = [];
      for (let i = 1; i <= this.totalPages; i++) {
        thumbs.push(await this.preview.renderThumbnail(this.previewBytes, i));
      }
      this.thumbnails = thumbs;
    } catch (error) {
      pdfNotifyWarning(
        this.toast,
        error instanceof Error ? error.message : 'Page thumbnails could not be generated',
      );
    } finally {
      this.cdr.markForCheck();
    }
  }

  /** Wait for the preview canvas to exist in the DOM (OnPush + conditional template). */
  scheduleRenderPreview(): void {
    this.previewRenderRetries = 0;
    this.previewError = '';
    this.previewRenderGeneration++;
    this.cdr.markForCheck();
    requestAnimationFrame(() => {
      this.cdr.detectChanges();
      requestAnimationFrame(() => void this.renderPreview(this.previewRenderGeneration));
    });
  }

  async renderPreview(generation = this.previewRenderGeneration): Promise<void> {
    if (generation !== this.previewRenderGeneration) return;

    const bytes = this.previewBytes;
    if (!bytes?.length) {
      this.previewError = '';
      this.previewRendering = false;
      return;
    }

    const canvas = this.activePreviewCanvas();
    if (!canvas) {
      if (this.previewRenderRetries < this.maxPreviewRenderRetries) {
        this.previewRenderRetries++;
        this.cdr.detectChanges();
        setTimeout(
          () => void this.renderPreview(generation),
          this.previewRenderRetries <= 3 ? 16 : 80,
        );
      } else {
        this.previewError = 'Preview could not be initialized. Try refreshing the page.';
        this.cdr.markForCheck();
      }
      return;
    }

    if (this.previewRenderInFlight) {
      this.previewRenderGeneration++;
      const nextGeneration = this.previewRenderGeneration;
      requestAnimationFrame(() => void this.renderPreview(nextGeneration));
      return;
    }

    this.previewRenderInFlight = true;
    this.previewRendering = true;
    this.previewError = '';
    this.cdr.markForCheck();

    try {
      const maxWidth = this.previewFullscreen ? fullscreenPreviewWidth() : undefined;
      await this.preview.renderPageToCanvas(bytes, this.currentPage, canvas, maxWidth);
      if (generation !== this.previewRenderGeneration) return;
    } catch (error) {
      if (generation !== this.previewRenderGeneration) return;
      const message = error instanceof Error ? error.message : 'Could not render PDF preview';
      if (message.toLowerCase().includes('cancel') || message.toLowerCase().includes('same canvas')) return;
      this.previewError = message;
      pdfNotifyError(this.toast, this.previewError);
    } finally {
      this.previewRenderInFlight = false;
      if (generation === this.previewRenderGeneration) {
        this.previewRendering = false;
      }
      this.cdr.markForCheck();
    }
  }

  selectPage(index: number): void {
    const page = Math.max(1, Math.min(this.totalPages || 1, Math.round(Number(index) || 1)));
    this.currentPage = page;
    this.scheduleRenderPreview();
  }

  fieldError(field: string): string {
    return this.fieldErrors[field] ?? '';
  }

  clearFieldError(field: string): void {
    if (this.fieldErrors[field]) {
      const { [field]: _, ...rest } = this.fieldErrors;
      this.fieldErrors = rest;
    }
  }

  private setValidationError(
    message: string,
    fieldErrors: Record<string, string> = {},
    options: { toast?: boolean; focusOptions?: boolean } = {},
  ): void {
    const { toast = true, focusOptions = true } = options;
    this.fieldErrors = fieldErrors;
    if (toast) {
      if (this.hasOptionsPanel && this.needsConfigAttention) {
        pdfNotifyWarning(this.toast, message);
      } else {
        pdfNotifyError(this.toast, message);
      }
    }
    if (focusOptions && this.hasOptionsPanel) {
      this.openOptionsPanel();
    }
    this.cdr.markForCheck();
  }

  private clearValidation(): void {
    this.fieldErrors = {};
  }

  private getSelectedPageCount(): number {
    return this.pages.filter((p) => p.selected).length;
  }

  validateForMode(): string | null {
    const errors: Record<string, string> = {};

    const filenameError = validateOutputFilename(this.outputFilename);
    if (filenameError) errors['outputFilename'] = filenameError;

    switch (this.mode) {
      case 'text-to-pdf': {
        const err = validateRequiredText(this.plainTextInput, 'Text content');
        if (err) errors['plainTextInput'] = err;
        break;
      }
      case 'create-pdf-from-html': {
        const err = validateRequiredText(this.htmlInput, 'HTML source');
        if (err) errors['htmlInput'] = err;
        break;
      }
      case 'tables-charts-to-pdf': {
        const err = validateTableData(this.tableHeaders, this.tableRows);
        if (err) errors['tableRows'] = err;
        break;
      }
      case 'resume-invoice-generator': {
        const nameErr = validateRequiredText(this.resume.name, 'Name');
        if (nameErr) errors['resumeName'] = nameErr;
        const emailErr = validateEmail(this.resume.email, true);
        if (emailErr) errors['resumeEmail'] = emailErr;
        break;
      }
      case 'delete-pages': {
        const selected = this.getSelectedPageCount();
        if (!selected) errors['pageSelection'] = 'Select at least one page to delete';
        else if (selected >= this.totalPages) {
          errors['pageSelection'] = 'Cannot delete all pages — at least one must remain';
        }
        break;
      }
      case 'extract-pages': {
        if (!this.getSelectedPageCount()) {
          errors['pageSelection'] = 'Select at least one page to extract';
        }
        break;
      }
      case 'fill-pdf-forms':
      case 'flatten-pdf-forms': {
        if (!this.formFields.length) {
          errors['formFields'] = 'This PDF has no fillable form fields';
        }
        break;
      }
      case 'password-protect-pdf': {
        const err = validatePassword(this.userPassword);
        if (err) errors['userPassword'] = err;
        break;
      }
      case 'add-watermark': {
        const err = validateRequiredText(this.watermarkText, 'Watermark text');
        if (err) errors['watermarkText'] = err;
        const opacityErr = validateOpacity(this.watermarkOpacity);
        if (opacityErr) errors['watermarkOpacity'] = opacityErr;
        break;
      }
      case 'annotate-pdf': {
        if (!this.annotations.length) {
          errors['annotations'] = 'Place at least one annotation on the preview before applying';
        }
        const fontErr = validateFontSize(this.annotationFontSize);
        if (fontErr) errors['annotationFontSize'] = fontErr;
        break;
      }
      case 'highlight-text': {
        if (!this.annotations.length) {
          errors['annotations'] = 'Place at least one highlight on the preview before applying';
        }
        break;
      }
      default:
        break;
    }

    this.fieldErrors = errors;
    const first = Object.values(errors)[0];
    return first ?? null;
  }

  validateCreationMode(): string | null {
    this.fieldErrors = {};
    switch (this.mode) {
      case 'text-to-pdf':
        return validateRequiredText(this.plainTextInput, 'Text content');
      case 'create-pdf-from-html':
        return validateRequiredText(this.htmlInput, 'HTML source');
      case 'tables-charts-to-pdf':
        return validateTableData(this.tableHeaders, this.tableRows);
      case 'resume-invoice-generator': {
        const nameErr = validateRequiredText(this.resume.name, 'Name');
        if (nameErr) return nameErr;
        return validateEmail(this.resume.email, true);
      }
      default:
        return null;
    }
  }

  togglePageSelected(index: number): void {
    const page = this.pages[index - 1];
    if (page) page.selected = !page.selected;
    this.clearFieldError('pageSelection');
    this.cdr.markForCheck();
  }

  selectAllPages(): void {
    for (const p of this.pages) p.selected = true;
    this.cdr.markForCheck();
  }

  clearPageSelection(): void {
    for (const p of this.pages) p.selected = false;
    this.cdr.markForCheck();
  }

  async rotateCurrentPage(clockwise: boolean): Promise<void> {
    await this.pdfLib.rotatePagesInPlace(this.pages, this.currentPage - 1, clockwise ? 90 : -90);
    await this.applyPageChanges();
  }

  onThumbDragStart(index: number): void {
    this.dragPageIndex = index;
  }

  onThumbDrop(targetIndex: number): void {
    if (this.dragPageIndex == null || this.dragPageIndex === targetIndex) return;
    const item = this.pages.splice(this.dragPageIndex, 1)[0];
    this.pages.splice(targetIndex, 0, item);
    this.dragPageIndex = null;
    void this.applyPageChanges();
  }

  private pushUndo(): void {
    if (this.pdfBytes) {
      this.undoStack.push(new Uint8Array(this.pdfBytes));
      if (this.undoStack.length > 8) this.undoStack.shift();
      this.redoStack = [];
    }
  }

  async undo(): Promise<void> {
    const prev = this.undoStack.pop();
    if (!prev || !this.fileName) return;
    if (this.pdfBytes) this.redoStack.push(new Uint8Array(this.pdfBytes));
    const doc = await this.pdfLib.loadDocument(prev, this.docPassword || undefined);
    const pseudoFile = new File([prev as BlobPart], this.fileName, { type: 'application/pdf' });
    this.applyLoadedDocument(pseudoFile, prev, doc, this.docPassword || undefined);
    this.scheduleRenderPreview();
  }

  async redo(): Promise<void> {
    const next = this.redoStack.pop();
    if (!next || !this.fileName) return;
    if (this.pdfBytes) this.undoStack.push(new Uint8Array(this.pdfBytes));
    const doc = await this.pdfLib.loadDocument(next, this.docPassword || undefined);
    const pseudoFile = new File([next as BlobPart], this.fileName, { type: 'application/pdf' });
    this.applyLoadedDocument(pseudoFile, next, doc, this.docPassword || undefined);
    this.scheduleRenderPreview();
  }

  private async applyPageChanges(): Promise<void> {
    if (!this.pdfDoc) return;
    this.pushUndo();
    this.loading = true;
    this.cdr.markForCheck();
    try {
      const rebuilt = await this.pdfLib.reorderPages(this.pdfDoc, this.pages);
      const bytes = await this.pdfLib.saveDocument(rebuilt);
      const pseudoFile = new File([bytes as BlobPart], this.fileName, { type: 'application/pdf' });
      this.applyLoadedDocument(pseudoFile, bytes, rebuilt, this.docPassword || undefined);
      this.outputBytes = new Uint8Array(bytes);
      pdfNotifySuccess(this.toast, 'Pages updated');
    } catch (error) {
      pdfNotifyError(this.toast, error instanceof Error ? error.message : 'Operation failed');
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
      if (this.hasDocument) {
        this.scheduleRenderPreview();
      }
    }
  }

  async runPrimaryAction(): Promise<void> {
    if (!this.canRunPrimaryAction) {
      if (!this.isCreationMode && this.mode !== 'screenshot-to-pdf' && this.mode !== 'image-to-pdf') {
        this.setValidationError('Upload a PDF first');
      }
      return;
    }
    if (!this.pdfDoc || !this.pdfBytes) {
      if (this.mode === 'text-to-pdf') return this.createFromText();
      if (this.mode === 'create-pdf-from-html') return this.createFromHtml();
      if (this.mode === 'tables-charts-to-pdf') return this.createTablePdf();
      if (this.mode === 'resume-invoice-generator') return this.createResumePdf();
      this.setValidationError('Upload a PDF first');
      return;
    }

    const validationError = this.validateForMode();
    if (validationError) {
      this.setValidationError(validationError, this.fieldErrors);
      return;
    }

    this.loading = true;
    this.clearValidation();
    this.cdr.markForCheck();
    try {
      let resultDoc = this.pdfDoc;
      let successText = 'PDF processed successfully';
      switch (this.mode) {
        case 'delete-pages':
          resultDoc = await this.pdfLib.deletePages(this.pdfDoc, this.pages, true);
          successText = 'Selected pages deleted';
          break;
        case 'extract-pages':
          resultDoc = await this.pdfLib.extractPages(this.pdfDoc, this.pages);
          successText = 'Pages extracted';
          break;
        case 'reorder-pages':
        case 'rotate-pages':
          resultDoc = await this.pdfLib.reorderPages(this.pdfDoc, this.pages);
          successText = this.mode === 'rotate-pages' ? 'Rotation applied' : 'Page order applied';
          break;
        case 'compress-pdf':
          this.outputBytes = new Uint8Array(await this.pdfLib.optimizePdf(this.pdfDoc));
          successText = 'PDF optimized (basic object-stream compression)';
          break;
        case 'pdf-metadata-editor':
          this.pdfLib.writeMetadata(this.pdfDoc, this.metadata);
          this.outputBytes = new Uint8Array(await this.pdfLib.saveDocument(this.pdfDoc));
          successText = 'Metadata updated';
          break;
        case 'fill-pdf-forms':
          for (const field of this.formFields) {
            this.pdfLib.fillFormField(this.pdfDoc, field.name, field.value);
          }
          this.outputBytes = new Uint8Array(await this.pdfLib.saveDocument(this.pdfDoc));
          successText = 'Form fields filled';
          break;
        case 'flatten-pdf-forms':
          await this.pdfLib.flattenForm(this.pdfDoc);
          this.outputBytes = new Uint8Array(await this.pdfLib.saveDocument(this.pdfDoc));
          successText = 'Form flattened';
          break;
        case 'password-protect-pdf':
          throw new Error(
            'pdf-lib does not support PDF encryption in the browser. Password protection requires a backend or commercial SDK.'
          );
        case 'add-watermark':
          await this.pdfLib.addWatermark(this.pdfDoc, {
            type: 'text',
            text: this.watermarkText,
            opacity: this.watermarkOpacity,
            rotation: -45,
          });
          this.outputBytes = new Uint8Array(await this.pdfLib.saveDocument(this.pdfDoc));
          successText = 'Watermark applied';
          break;
        case 'add-page-numbers':
          await this.pdfLib.addPageNumbers(this.pdfDoc, {
            position: this.pageNumberPosition,
            fontSize: this.pageNumberFontSize,
            startNumber: this.pageNumberStart,
            format: this.pageNumberFormat,
          });
          this.outputBytes = new Uint8Array(await this.pdfLib.saveDocument(this.pdfDoc));
          successText = 'Page numbers added';
          break;
        case 'annotate-pdf':
        case 'highlight-text':
          this.pdfLib.applyAnnotations(this.pdfDoc, this.annotations);
          this.outputBytes = new Uint8Array(await this.pdfLib.saveDocument(this.pdfDoc));
          this.annotations = [];
          successText = 'Annotations applied';
          break;
        case 'pdf-to-base64':
          this.base64Output = this.pdfLib.toBase64(this.pdfBytes);
          successText = 'Base64 encoded';
          break;
        default:
          this.outputBytes = new Uint8Array(await this.pdfLib.saveDocument(resultDoc));
      }
      if (this.mode !== 'pdf-to-base64' && this.mode !== 'compress-pdf' && !this.outputBytes?.length) {
        this.outputBytes = new Uint8Array(await this.pdfLib.saveDocument(resultDoc));
      }
      if (this.outputBytes?.length) {
        this.preview.clearCache();
        const rebuilt = await this.pdfLib.loadDocument(this.outputBytes, this.docPassword || undefined);
        this.pdfDoc = rebuilt;
        this.pdfBytes = this.outputBytes;
        if (this.mode === 'reorder-pages' || this.mode === 'rotate-pages') {
          this.pages = this.pdfDoc.getPageIndices().map((sourceIndex) => ({
            sourceIndex,
            rotation: 0,
            selected: false,
          }));
        }
        void this.refreshThumbnails();
        this.scheduleRenderPreview();
      }
      if (this.mode === 'pdf-to-base64' || this.extractedText) {
        /* keep */
      } else if (['delete-pages', 'extract-pages'].includes(this.mode) && this.outputBytes) {
        const pseudo = new File([this.outputBytes as BlobPart], this.outputFilename, { type: 'application/pdf' });
        this.applyLoadedDocument(pseudo, this.outputBytes, await this.pdfLib.loadDocument(this.outputBytes), this.docPassword);
      }
      pdfNotifySuccess(this.toast, successText);
    } catch (error) {
      pdfNotifyError(this.toast, error instanceof Error ? error.message : 'Processing failed');
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
      if (this.hasDocument && this.mode !== 'pdf-to-base64') {
        this.scheduleRenderPreview();
      }
    }
  }

  async extractText(): Promise<void> {
    if (!this.canExtractText) {
      pdfNotifyWarning(this.toast, 'Upload a PDF first');
      return;
    }
    if (!this.pdfBytes) return;
    this.loading = true;
    this.cdr.markForCheck();
    try {
      this.extractedText = await this.preview.extractAllText(this.pdfBytes);
      pdfNotifySuccess(this.toast, 'Text extracted (via PDF.js — layout may vary)');
    } catch (error) {
      pdfNotifyError(this.toast, error instanceof Error ? error.message : 'Extraction failed');
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  async createFromText(): Promise<void> {
    const err = this.validateCreationMode();
    if (err) {
      this.setValidationError(err, { plainTextInput: err });
      return;
    }
    const filenameErr = validateOutputFilename(this.outputFilename);
    if (filenameErr) {
      this.setValidationError(filenameErr, { outputFilename: filenameErr });
      return;
    }
    this.loading = true;
    this.clearValidation();
    this.cdr.markForCheck();
    try {
      const doc = await this.pdfLib.createFromText(this.plainTextInput);
      this.outputBytes = new Uint8Array(await this.pdfLib.saveDocument(doc));
      this.fileName = 'text-export.pdf';
      this.outputFilename = 'text-export.pdf';
      this.pdfDoc = doc;
      this.pdfBytes = this.outputBytes;
      this.pages = doc.getPageIndices().map((i) => ({ sourceIndex: i, rotation: 0, selected: false }));
      pdfNotifySuccess(this.toast, 'PDF created from text');
      this.scheduleRenderPreview();
    } catch (error) {
      pdfNotifyError(this.toast, error instanceof Error ? error.message : 'Failed');
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  async createFromHtml(): Promise<void> {
    const err = this.validateCreationMode();
    if (err) {
      this.setValidationError(err, { htmlInput: err });
      return;
    }
    const filenameErr = validateOutputFilename(this.outputFilename);
    if (filenameErr) {
      this.setValidationError(filenameErr, { outputFilename: filenameErr });
      return;
    }
    this.loading = true;
    this.clearValidation();
    this.cdr.markForCheck();
    try {
      const doc = await this.pdfLib.createFromPlainHtml(this.htmlInput);
      this.outputBytes = new Uint8Array(await this.pdfLib.saveDocument(doc));
      this.pdfDoc = doc;
      this.pdfBytes = this.outputBytes;
      this.fileName = 'html-export.pdf';
      this.outputFilename = 'html-export.pdf';
      pdfNotifySuccess(this.toast, 'PDF created (plain-text layout from HTML)');
      this.scheduleRenderPreview();
    } catch (error) {
      pdfNotifyError(this.toast, error instanceof Error ? error.message : 'Failed');
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  async createFromImages(files: File[]): Promise<void> {
    const err = validateImageFiles(files);
    if (err) {
      this.setValidationError(err);
      return;
    }
    const filenameErr = validateOutputFilename(this.outputFilename || 'images.pdf');
    if (filenameErr) {
      this.setValidationError(filenameErr, { outputFilename: filenameErr });
      return;
    }
    this.loading = true;
    this.clearValidation();
    this.cdr.markForCheck();
    try {
      const bytesArr: Uint8Array[] = [];
      const mimes: string[] = [];
      for (const f of files) {
        bytesArr.push(new Uint8Array(await f.arrayBuffer()));
        mimes.push(f.type);
      }
      const doc = await this.pdfLib.createFromImages(bytesArr, mimes);
      this.outputBytes = new Uint8Array(await this.pdfLib.saveDocument(doc));
      this.pdfDoc = doc;
      this.pdfBytes = this.outputBytes;
      this.fileName = 'images.pdf';
      this.outputFilename = 'images.pdf';
      pdfNotifySuccess(this.toast, 'PDF created from images');
      this.scheduleRenderPreview();
    } catch (error) {
      pdfNotifyError(this.toast, error instanceof Error ? error.message : 'Failed');
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  async createTablePdf(): Promise<void> {
    const err = this.validateCreationMode();
    if (err) {
      this.setValidationError(err, { tableRows: err });
      return;
    }
    const filenameErr = validateOutputFilename(this.outputFilename || 'table.pdf');
    if (filenameErr) {
      this.setValidationError(filenameErr, { outputFilename: filenameErr });
      return;
    }
    this.loading = true;
    this.clearValidation();
    this.cdr.markForCheck();
    try {
      const headers = this.tableHeaders.split(',').map((h) => h.trim());
      const rows = this.tableRows
        .split('\n')
        .filter(Boolean)
        .map((line) => line.split(',').map((c) => c.trim()));
      const doc = await this.pdfLib.createTablePdf(headers, rows, this.tableTitle);
      this.outputBytes = new Uint8Array(await this.pdfLib.saveDocument(doc));
      this.pdfDoc = doc;
      this.pdfBytes = this.outputBytes;
      this.fileName = 'table.pdf';
      this.outputFilename = this.outputFilename || 'table.pdf';
      pdfNotifySuccess(this.toast, 'Table PDF created');
      this.scheduleRenderPreview();
    } catch (error) {
      pdfNotifyError(this.toast, error instanceof Error ? error.message : 'Failed');
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  async createResumePdf(): Promise<void> {
    const err = this.validateCreationMode();
    if (err) {
      const field = err.includes('email') ? 'resumeEmail' : 'resumeName';
      this.setValidationError(err, { [field]: err });
      return;
    }
    const filenameErr = validateOutputFilename(this.outputFilename || `${this.resume.name.trim()}.pdf`);
    if (filenameErr) {
      this.setValidationError(filenameErr, { outputFilename: filenameErr });
      return;
    }
    this.loading = true;
    this.clearValidation();
    this.cdr.markForCheck();
    try {
      const doc = await this.pdfLib.createResumePdf(this.resume);
      this.outputBytes = new Uint8Array(await this.pdfLib.saveDocument(doc));
      this.pdfDoc = doc;
      this.pdfBytes = this.outputBytes;
      this.fileName = 'resume.pdf';
      this.outputFilename = `${this.resume.name.trim()}.pdf`;
      pdfNotifySuccess(this.toast, 'Resume PDF created');
      this.scheduleRenderPreview();
    } catch (error) {
      pdfNotifyError(this.toast, error instanceof Error ? error.message : 'Failed');
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  applyRangeSelection(): void {
    const rangeErr = validatePageRangeInput(this.pageRangeInput, this.totalPages);
    if (rangeErr) {
      this.setValidationError(rangeErr, { pageRangeInput: rangeErr });
      return;
    }
    const indices = parsePageRanges(this.pageRangeInput, this.totalPages);
    for (const p of this.pages) p.selected = indices.includes(p.sourceIndex);
    this.clearValidation();
    pdfNotifySuccess(this.toast, `Selected ${indices.length} page(s)`);
    this.cdr.markForCheck();
  }

  togglePlacementMode(): void {
    this.placementMode = !this.placementMode;
    this.cdr.markForCheck();
  }

  onCanvasClick(event: MouseEvent): void {
    if (!this.placementMode || !this.pdfDoc) return;
    const canvas = this.activePreviewCanvas();
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = ((event.clientX - rect.left) * scaleX) / (globalThis.devicePixelRatio ?? 1);
    const y = canvas.height / (globalThis.devicePixelRatio ?? 1) - (event.clientY - rect.top) * scaleY / (globalThis.devicePixelRatio ?? 1);

    if (this.mode === 'annotate-pdf') {
      if (!this.annotationText.trim()) {
        this.setValidationError(
          'Enter annotation text before placing on the preview',
          { annotationText: 'Annotation text is required' },
          { focusOptions: false },
        );
        return;
      }
      const fontErr = validateFontSize(this.annotationFontSize);
      if (fontErr) {
        this.setValidationError(fontErr, { annotationFontSize: fontErr }, { focusOptions: false });
        return;
      }
      this.annotations.push({
        type: 'text',
        pageIndex: this.currentPage - 1,
        x,
        y,
        text: this.annotationText,
        fontSize: this.annotationFontSize,
      });
      pdfNotifySuccess(this.toast, 'Annotation queued — click Apply to commit');
      this.clearFieldError('annotations');
    } else if (this.mode === 'highlight-text') {
      this.annotations.push({
        type: 'highlight',
        pageIndex: this.currentPage - 1,
        x,
        y: y - 14,
        width: 180,
        height: 18,
        opacity: 0.35,
      });
      pdfNotifySuccess(this.toast, 'Highlight queued — click Apply to commit');
      this.clearFieldError('annotations');
    }
    this.cdr.markForCheck();
  }

  downloadResult(): void {
    void this.downloadResultAsync();
  }

  /** Build PDF bytes reflecting current tool state (including un-applied form/metadata/page edits). */
  private async materializeDownloadBytes(): Promise<Uint8Array | null> {
    if (this.isCreationMode || this.mode === 'screenshot-to-pdf' || this.mode === 'image-to-pdf') {
      return this.outputBytes?.length ? cloneBytes(this.outputBytes) : null;
    }

    if (this.mode === 'pdf-to-base64') {
      return this.pdfBytes?.length ? cloneBytes(this.pdfBytes) : null;
    }

    if (!this.pdfDoc) {
      return this.pdfBytes?.length ? cloneBytes(this.pdfBytes) : null;
    }

    switch (this.mode) {
      case 'delete-pages': {
        if (!this.getSelectedPageCount()) {
          return new Uint8Array(await this.pdfLib.saveDocument(this.pdfDoc));
        }
        const doc = await this.pdfLib.deletePages(this.pdfDoc, this.pages, true);
        return new Uint8Array(await this.pdfLib.saveDocument(doc));
      }
      case 'extract-pages': {
        if (!this.getSelectedPageCount()) {
          return new Uint8Array(await this.pdfLib.saveDocument(this.pdfDoc));
        }
        const doc = await this.pdfLib.extractPages(this.pdfDoc, this.pages);
        return new Uint8Array(await this.pdfLib.saveDocument(doc));
      }
      case 'reorder-pages':
      case 'rotate-pages': {
        const doc = await this.pdfLib.reorderPages(this.pdfDoc, this.pages);
        return new Uint8Array(await this.pdfLib.saveDocument(doc));
      }
      case 'compress-pdf':
        return this.pdfLib.optimizePdf(this.pdfDoc);
      case 'pdf-metadata-editor': {
        this.pdfLib.writeMetadata(this.pdfDoc, this.metadata);
        return new Uint8Array(await this.pdfLib.saveDocument(this.pdfDoc));
      }
      case 'fill-pdf-forms': {
        for (const field of this.formFields) {
          this.pdfLib.fillFormField(this.pdfDoc, field.name, field.value);
        }
        return new Uint8Array(await this.pdfLib.saveDocument(this.pdfDoc));
      }
      case 'flatten-pdf-forms': {
        await this.pdfLib.flattenForm(this.pdfDoc);
        return new Uint8Array(await this.pdfLib.saveDocument(this.pdfDoc));
      }
      case 'add-watermark': {
        if (this.watermarkText.trim() && !this.outputBytes?.length) {
          await this.pdfLib.addWatermark(this.pdfDoc, {
            type: 'text',
            text: this.watermarkText,
            opacity: this.watermarkOpacity,
            rotation: -45,
          });
        }
        return new Uint8Array(await this.pdfLib.saveDocument(this.pdfDoc));
      }
      case 'annotate-pdf':
      case 'highlight-text': {
        if (this.annotations.length) {
          this.pdfLib.applyAnnotations(this.pdfDoc, this.annotations);
        }
        return new Uint8Array(await this.pdfLib.saveDocument(this.pdfDoc));
      }
      default:
        return new Uint8Array(await this.pdfLib.saveDocument(this.pdfDoc));
    }
  }

  private async downloadResultAsync(): Promise<void> {
    const name = this.outputFilename || this.fileName || 'document.pdf';
    const filenameErr = validateOutputFilename(name.endsWith('.pdf') ? name : `${name}.pdf`);
    if (filenameErr) {
      this.setValidationError(filenameErr, { outputFilename: filenameErr });
      return;
    }
    const downloadName = name.endsWith('.pdf') ? name : `${name}.pdf`;

    try {
      const bytes = await this.materializeDownloadBytes();
      if (!bytes?.length) {
        pdfNotifyWarning(this.toast, 'Nothing to download. Apply your changes or upload a PDF first.');
        return;
      }
      downloadBytes(bytes, downloadName);
      pdfNotifySuccess(this.toast, 'Download started');
    } catch (error) {
      pdfNotifyError(this.toast, error instanceof Error ? error.message : 'Download failed');
    }
  }

  copyBase64(): void {
    if (!this.base64Output) return;
    void navigator.clipboard.writeText(this.base64Output);
    pdfNotifySuccess(this.toast, 'Base64 copied');
  }

  downloadExtractedText(): void {
    if (this.extractedText) downloadText(this.extractedText, 'extracted-text.txt');
  }

  clearAll(): void {
    this.preview.clearCache();
    this.pdfBytes = null;
    this.pdfDoc = null;
    this.outputBytes = null;
    this.pages = [];
    this.thumbnails = [];
    this.fileName = '';
    this.fieldErrors = {};
    this.base64Output = '';
    this.extractedText = '';
    this.annotations = [];
    sessionStorage.removeItem(SESSION_KEY);
    this.cdr.markForCheck();
  }

  saveSession(): void {
    if (!this.pdfBytes || !this.fileName) return;
    try {
      const payload = {
        name: this.fileName,
        b64: this.pdfLib.toBase64(this.pdfBytes),
        mode: this.mode,
      };
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(payload));
    } catch {
      /* quota */
    }
  }

  formatFileSize = formatFileSize;

  primaryActionLabel(): string {
    const labels: Partial<Record<PdfToolMode, string>> = {
      'delete-pages': 'Delete selected',
      'extract-pages': 'Extract selected',
      'rotate-pages': 'Apply rotation',
      'reorder-pages': 'Apply order',
      'compress-pdf': 'Compress',
      'pdf-metadata-editor': 'Save metadata',
      'fill-pdf-forms': 'Fill & save',
      'flatten-pdf-forms': 'Flatten',
      'password-protect-pdf': 'Encrypt',
      'add-watermark': 'Apply watermark',
      'add-page-numbers': 'Add page numbers',
      'annotate-pdf': 'Apply annotations',
      'highlight-text': 'Apply highlights',
      'pdf-to-base64': 'Encode',
      'text-to-pdf': 'Create PDF',
      'create-pdf-from-html': 'Create PDF',
      'tables-charts-to-pdf': 'Create PDF',
      'resume-invoice-generator': 'Generate PDF',
    };
    return labels[this.mode] ?? 'Process';
  }
}
