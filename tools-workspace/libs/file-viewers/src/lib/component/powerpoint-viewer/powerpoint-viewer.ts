import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  ViewChild,
  inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Navigation, TooltipDirective, AssetService, ToastService } from '@tools-workspace/features-home';
import type { FvRelatedToolLink } from '../../shared/fv-tool-suggestion.model';
import {
  PPT_ACCEPT_ATTR,
  PPT_BASE_SLIDE_WIDTH_PX,
  PPT_DEFAULT_ZOOM,
  PPT_FULLSCREEN_BASE_WIDTH_PX,
  PPT_FULLSCREEN_EVENTS,
  PPT_MAX_FILE_SIZE_BYTES,
  PPT_MAX_FILE_SIZE_LABEL,
  PPT_MAX_ZOOM,
  PPT_MIN_ZOOM,
  PPT_RELATED_TOOLS,
  PPT_SUPPORTED_EXTENSIONS,
  PPT_TOAST_ERROR_MS,
  PPT_TOAST_WARNING_MS
} from '../../constants/powerpoint-viewer.constants';
import type { PresentationFile } from '../../types/powerpoint-viewer.types';
import { PresentationType } from '../../types/powerpoint-viewer.types';
import {
  createPresentationFileRecord,
  ensureReadableTextColor,
  escapePowerpointHtml,
  formatPowerpointFileSize,
  getPresentationTypeLabel,
  getSlidePreviewLabel,
  isFullscreenActive,
  loadJsZipLibrary,
  parsePptxManually,
  resolvePowerpointSuggestion,
  safeRevokeObjectUrl,
  stepPowerpointZoom,
  validatePresentationFiles
} from '../../utils/powerpoint-viewer.utils';

@Component({
  selector: 'lib-powerpoint-viewer',
  standalone: true,
  templateUrl: './powerpoint-viewer.html',
  styleUrls: ['./powerpoint-viewer.scss'],
  imports: [CommonModule, FormsModule, RouterLink, Navigation, TooltipDirective]
})
export class PowerpointViewerComponent implements OnInit, AfterViewInit, OnDestroy {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('slideContainer') slideContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('fullscreenContainer') fullscreenContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('fullscreenSlideContainer') fullscreenSlideContainer!: ElementRef<HTMLDivElement>;

  readonly acceptAttr = PPT_ACCEPT_ATTR;
  readonly relatedTools: ReadonlyArray<FvRelatedToolLink> = PPT_RELATED_TOOLS;
  readonly supportedFormats = PPT_SUPPORTED_EXTENSIONS;
  readonly maxFileSize = PPT_MAX_FILE_SIZE_BYTES;
  readonly maxFileSizeLabel = PPT_MAX_FILE_SIZE_LABEL;
  readonly minZoom = PPT_MIN_ZOOM;
  readonly maxZoom = PPT_MAX_ZOOM;

  presentationFiles: PresentationFile[] = [];
  currentFileIndex = -1;
  currentSlide = 1;
  totalSlides = 0;
  zoomLevel = PPT_DEFAULT_ZOOM;
  isFullscreen = false;
  loading = false;
  errorMessage = '';
  showDropZone = false;
  dismissedSuggestionId: string | null = null;
  private browserFullscreenActive = false;
  private lastParseHadWarnings = false;

  private readonly preventDefaultsFn = (e: Event) => this.preventDefaults(e);
  private readonly fullscreenChangeHandler = () => this.onFullscreenChange();

  constructor(private readonly cdr: ChangeDetectorRef) {}

  get currentPresentation(): PresentationFile | null {
    return this.currentFileIndex >= 0 && this.currentFileIndex < this.presentationFiles.length
      ? this.presentationFiles[this.currentFileIndex]
      : null;
  }

  get currentSlideTextItems(): string[] {
    const slide = this.currentPresentation?.slides[this.currentSlide - 1];
    if (!slide) {
      return [];
    }
    return slide.elements
      .filter((e) => e.type === 'text' && !!e.content?.trim())
      .map((e) => (e.content || '').trim());
  }

  get primarySuggestion() {
    const suggestion = resolvePowerpointSuggestion({
      hasFiles: this.presentationFiles.length > 0,
      hasError: !!this.errorMessage,
      slideCount: this.currentPresentation?.totalSlides || this.totalSlides,
      currentSize: this.currentPresentation?.size ?? 0,
      hasParseWarnings: this.lastParseHadWarnings
    });
    if (!suggestion || this.dismissedSuggestionId === suggestion.id) {
      return null;
    }
    return suggestion;
  }

  ngOnInit(): void {
    this.setupDragAndDrop();
    this.setupFullscreenListeners();
  }

  ngAfterViewInit(): void {
    loadJsZipLibrary().catch(() => undefined);
  }

  ngOnDestroy(): void {
    this.cleanup();
  }

  dismissSuggestion(suggestionId: string): void {
    this.dismissedSuggestionId = suggestionId;
    this.cdr.detectChanges();
  }

  setupDragAndDrop(): void {
    if (typeof document === 'undefined') {
      return;
    }
    for (const eventName of ['dragenter', 'dragover', 'dragleave', 'drop']) {
      document.addEventListener(eventName, this.preventDefaultsFn, false);
      document.body.addEventListener(eventName, this.preventDefaultsFn, false);
    }
  }

  setupFullscreenListeners(): void {
    if (typeof document === 'undefined') {
      return;
    }
    for (const eventName of PPT_FULLSCREEN_EVENTS) {
      document.addEventListener(eventName, this.fullscreenChangeHandler);
    }
  }

  preventDefaults(e: Event): void {
    e.preventDefault();
    e.stopPropagation();
  }

  onDragEnter(): void {
    this.showDropZone = true;
  }

  onDragLeave(): void {
    this.showDropZone = false;
  }

  onDrop(e: DragEvent): void {
    this.showDropZone = false;
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      void this.processFiles(Array.from(files));
    }
  }

  openFileDialog(): void {
    this.fileInput?.nativeElement.click();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      void this.processFiles(Array.from(input.files));
    }
  }

  async processFiles(files: File[]): Promise<void> {
    this.errorMessage = '';
    this.loading = true;
    this.dismissedSuggestionId = null;
    this.lastParseHadWarnings = false;
    this.cdr.detectChanges();

    const { validFiles, errors } = validatePresentationFiles(files, {
      maxFileSize: this.maxFileSize,
      formatFileSize: formatPowerpointFileSize
    });

    for (const msg of errors) {
      this.toast.error(msg);
    }

    if (errors.length > 0) {
      this.errorMessage = errors.join('\n');
    }

    for (const file of validFiles) {
      try {
        const url = URL.createObjectURL(file);
        let slides;
        let slideWidthEmu;
        let slideHeightEmu;
        const metadata: PresentationFile['metadata'] = {};

        try {
          await loadJsZipLibrary();
          const parsed = await parsePptxManually(file);
          slides = parsed.slides;
          slideWidthEmu = parsed.slideWidthEmu;
          slideHeightEmu = parsed.slideHeightEmu;

          if (parsed.warnings.length > 0) {
            this.lastParseHadWarnings = true;
          }
          this.toastParseWarnings(parsed.warnings);

          if (slides.length === 0) {
            throw new Error('No slides could be extracted from this presentation.');
          }
        } catch (error) {
          const msg = `${file.name}: ${error instanceof Error ? error.message : 'Failed to parse PPTX file. The file may be corrupted or unsupported.'}`;
          errors.push(msg);
          this.toast.error(msg, PPT_TOAST_ERROR_MS);
          this.errorMessage = errors.join('\n');
          safeRevokeObjectUrl(url);
          continue;
        }

        const presentationFile = createPresentationFileRecord(
          file,
          url,
          slides,
          slideWidthEmu,
          slideHeightEmu,
          metadata
        );

        this.presentationFiles.push(presentationFile);
        this.cdr.detectChanges();

        if (this.currentFileIndex === -1) {
          this.currentFileIndex = this.presentationFiles.length - 1;
          this.currentSlide = 1;
          this.totalSlides = presentationFile.totalSlides;
          requestAnimationFrame(() => {
            setTimeout(() => void this.loadPresentation(presentationFile), 50);
          });
        } else {
          this.toast.success(`Loaded ${file.name} (${slides.length} slides)`);
        }
      } catch (error) {
        const msg = `${file.name}: Failed to load presentation - ${error instanceof Error ? error.message : 'Unknown error'}`;
        errors.push(msg);
        this.toast.error(msg);
      }
    }

    this.loading = false;
    if (errors.length > 0) {
      this.errorMessage = errors.join('\n');
    }

    if (this.fileInput?.nativeElement) {
      this.fileInput.nativeElement.value = '';
    }

    this.cdr.detectChanges();
  }

  closeError(): void {
    this.errorMessage = '';
    this.cdr.detectChanges();
  }

  private toastParseWarnings(warnings: string[]): void {
    for (const warning of warnings) {
      if (/failed to parse/i.test(warning)) {
        this.toast.error(warning, PPT_TOAST_ERROR_MS);
      } else {
        this.toast.warning(warning, PPT_TOAST_WARNING_MS);
      }
    }
  }

  onFullscreenChange(): void {
    const currentlyFullscreen = isFullscreenActive();

    if (!currentlyFullscreen && this.browserFullscreenActive) {
      this.browserFullscreenActive = false;
      if (this.isFullscreen) {
        this.isFullscreen = false;
        setTimeout(() => this.renderSlide(), 50);
        this.cdr.detectChanges();
      }
    }
  }

  toggleFullscreen(): void {
    if (this.isFullscreen) {
      this.exitFullscreen();
    } else {
      this.enterFullscreen();
    }
  }

  enterFullscreen(): void {
    if (!this.currentPresentation) {
      return;
    }

    this.isFullscreen = true;
    this.cdr.detectChanges();

    requestAnimationFrame(() => {
      setTimeout(() => {
        this.renderSlide();
        const container = this.fullscreenContainer?.nativeElement;
        if (!container) {
          return;
        }

        const requestFs =
          container.requestFullscreen?.bind(container) ||
          (
            container as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void }
          ).webkitRequestFullscreen?.bind(container) ||
          (
            container as HTMLElement & { mozRequestFullScreen?: () => Promise<void> | void }
          ).mozRequestFullScreen?.bind(container) ||
          (
            container as HTMLElement & { msRequestFullscreen?: () => Promise<void> | void }
          ).msRequestFullscreen?.bind(container);

        if (requestFs) {
          Promise.resolve(requestFs())
            .then(() => {
              this.browserFullscreenActive = true;
              setTimeout(() => this.renderSlide(), 100);
            })
            .catch(() => {
              this.browserFullscreenActive = false;
            });
        }
      }, 40);
    });
  }

  exitFullscreen(): void {
    this.isFullscreen = false;
    this.browserFullscreenActive = false;

    const doc = document as Document & {
      webkitFullscreenElement?: Element | null;
      webkitExitFullscreen?: () => Promise<void> | void;
      mozCancelFullScreen?: () => Promise<void> | void;
      msExitFullscreen?: () => Promise<void> | void;
    };

    if (document.fullscreenElement || doc.webkitFullscreenElement) {
      const exitFs =
        document.exitFullscreen?.bind(document) ||
        doc.webkitExitFullscreen?.bind(document) ||
        doc.mozCancelFullScreen?.bind(document) ||
        doc.msExitFullscreen?.bind(document);
      const result = exitFs?.();
      if (result && typeof (result as Promise<void>).catch === 'function') {
        (result as Promise<void>).catch(() => undefined);
      }
    }

    setTimeout(() => this.renderSlide(), 60);
    this.cdr.detectChanges();
  }

  async loadPresentation(presentationFile: PresentationFile): Promise<void> {
    if (!presentationFile || presentationFile.slides.length === 0) {
      this.errorMessage = 'Presentation has no slides';
      this.toast.error('Presentation has no slides');
      this.cdr.detectChanges();
      return;
    }

    this.currentSlide = 1;
    this.totalSlides = presentationFile.totalSlides;
    this.cdr.detectChanges();

    await new Promise((resolve) => setTimeout(resolve, 80));
    this.renderSlide();
    requestAnimationFrame(() => {
      setTimeout(() => this.renderSlide(), 120);
    });
  }

  selectPresentation(index: number): Promise<void> {
    if (index >= 0 && index < this.presentationFiles.length) {
      this.currentFileIndex = index;
      const pres = this.presentationFiles[index];
      this.currentSlide = 1;
      this.totalSlides = pres.totalSlides;
      return this.loadPresentation(pres);
    }
    return Promise.resolve();
  }

  previousSlide(): void {
    if (this.currentSlide > 1) {
      this.currentSlide--;
      this.renderSlide();
    }
  }

  nextSlide(): void {
    if (this.currentSlide < this.totalSlides) {
      this.currentSlide++;
      this.renderSlide();
    }
  }

  goToSlide(slideNumber: number | string): void {
    const n =
      typeof slideNumber === 'string' ? Number.parseInt(slideNumber, 10) : Number(slideNumber);
    if (!Number.isFinite(n)) {
      return;
    }
    this.currentSlide = Math.max(1, Math.min(n, this.totalSlides || 1));
    this.renderSlide();
  }

  getSlideAspectRatio(): string {
    const pres = this.currentPresentation;
    if (!pres) {
      return '16 / 9';
    }
    return `${pres.slideWidthEmu} / ${pres.slideHeightEmu}`;
  }

  getSlidePreviewLabel(index: number): string {
    return getSlidePreviewLabel(this.currentPresentation?.slides[index], index);
  }

  private getSlideRenderWidth(fullscreen: boolean): number {
    const scale = this.zoomLevel / 100;
    const base = fullscreen ? PPT_FULLSCREEN_BASE_WIDTH_PX : PPT_BASE_SLIDE_WIDTH_PX;
    return Math.round(base * scale);
  }

  renderSlide(): void {
    if (!this.currentPresentation) {
      return;
    }

    const slideIndex = this.currentSlide - 1;
    if (slideIndex < 0 || slideIndex >= this.currentPresentation.slides.length) {
      return;
    }

    const slide = this.currentPresentation.slides[slideIndex];
    const aspect = this.getSlideAspectRatio();

    const paint = (container: HTMLElement | undefined, fullscreen: boolean): void => {
      if (!container) {
        if (fullscreen === this.isFullscreen) {
          setTimeout(() => this.renderSlide(), 50);
        }
        return;
      }

      const slideWidth = this.getSlideRenderWidth(fullscreen);
      const fontScale = slideWidth / PPT_BASE_SLIDE_WIDTH_PX;
      const bg = slide.background || '#ffffff';
      const parts: string[] = [];

      parts.push(
        `<div class="ppt-stage${fullscreen ? ' ppt-stage--fullscreen' : ''}" ` +
          `style="display:flex;align-items:flex-start;justify-content:center;width:max-content;min-width:100%;min-height:100%;padding:1.5rem;box-sizing:border-box;">` +
          `<div class="ppt-slide" style="position:relative;flex:0 0 auto;width:${slideWidth}px;aspect-ratio:${aspect};` +
          `background:${bg};overflow:visible;border-radius:4px;` +
          `box-shadow:0 1px 2px rgba(15,23,42,.08),0 18px 40px rgba(15,23,42,.22);` +
          `font-family:Calibri,'Segoe UI',Arial,sans-serif;">`
      );

      const sorted = [...slide.elements].sort((a, b) => {
        const az = a.type === 'shape' ? 0 : a.type === 'image' ? 1 : 2;
        const bz = b.type === 'shape' ? 0 : b.type === 'image' ? 1 : 2;
        return az - bz;
      });

      for (const element of sorted) {
        const x = Number.isFinite(element.x) ? element.x : 0;
        const y = Number.isFinite(element.y) ? element.y : 0;
        const w = Math.max(Number.isFinite(element.width) ? element.width : 20, 2);
        const h = Math.max(Number.isFinite(element.height) ? element.height : 6, 2);
        const box =
          `position:absolute;left:${x}%;top:${y}%;width:${w}%;` + `box-sizing:border-box;z-index:1;`;

        if (element.type === 'image' && element.imageData) {
          parts.push(
            `<div class="ppt-el ppt-el--image" style="${box}height:${h}%;overflow:hidden;">` +
              `<img src="${element.imageData}" alt="" style="display:block;width:100%;height:100%;object-fit:contain;" /></div>`
          );
        } else if (element.type === 'shape') {
          const shapeBg = element.style?.background || 'transparent';
          parts.push(
            `<div class="ppt-el ppt-el--shape" style="${box}height:${h}%;background:${shapeBg};"></div>`
          );
        } else if (element.type === 'text') {
          const style = element.style || {};
          const fontSize = Math.max(11, Math.round((style.fontSize || 16) * fontScale));
          const fontWeight = style.fontWeight || '400';
          const color = ensureReadableTextColor(style.color || '#1e293b', style.background || bg);
          const align = style.textAlign || 'left';
          const textBg = style.background ? `background:${style.background};` : '';
          parts.push(
            `<div class="ppt-el ppt-el--text" style="${box}min-height:${h}%;height:auto;overflow:visible;` +
              `${textBg}padding:1.5% 2%;line-height:1.3;white-space:pre-wrap;word-break:break-word;` +
              `font-size:${fontSize}px;font-weight:${fontWeight};color:${color};text-align:${align};z-index:2;">` +
              `<div style="width:100%;">${escapePowerpointHtml(element.content || '').replace(/\n/g, '<br>')}</div></div>`
          );
        }
      }

      if (slide.parseError || slide.elements.length === 0) {
        const statusTitle = slide.parseError ? 'Slide could not be parsed' : 'No extractable content';
        const statusDetail = slide.parseError
          ? escapePowerpointHtml(slide.parseError)
          : 'This slide has no text, images, or shapes the viewer can extract.';
        parts.push(
          `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;` +
            `padding:8%;box-sizing:border-box;background:rgba(248,250,252,.92);z-index:5;">` +
            `<div style="max-width:28rem;text-align:center;font-family:system-ui,sans-serif;">` +
            `<p style="margin:0 0 .5rem;font-size:14px;font-weight:700;color:#991b1b;letter-spacing:.02em;text-transform:uppercase;">Viewer notice</p>` +
            `<p style="margin:0 0 .35rem;font-size:16px;font-weight:600;color:#0f172a;">${statusTitle}</p>` +
            `<p style="margin:0;font-size:13px;line-height:1.45;color:#64748b;">${statusDetail}</p>` +
            `</div></div>`
        );
      }

      parts.push('</div></div>');
      container.innerHTML = parts.join('');

      requestAnimationFrame(() => {
        if (fullscreen) {
          container.scrollTop = Math.max(0, (container.scrollHeight - container.clientHeight) / 2);
          container.scrollLeft = Math.max(0, (container.scrollWidth - container.clientWidth) / 2);
        } else {
          container.scrollTop = 0;
          container.scrollLeft = 0;
        }
      });
    };

    paint(this.slideContainer?.nativeElement, false);
    if (this.isFullscreen) {
      paint(this.fullscreenSlideContainer?.nativeElement, true);
    }

    this.cdr.detectChanges();
  }

  zoomIn(): void {
    if (this.zoomLevel < PPT_MAX_ZOOM) {
      this.zoomLevel = stepPowerpointZoom(this.zoomLevel, 1);
      this.renderSlide();
    }
  }

  zoomOut(): void {
    if (this.zoomLevel > PPT_MIN_ZOOM) {
      this.zoomLevel = stepPowerpointZoom(this.zoomLevel, -1);
      this.renderSlide();
    }
  }

  resetZoom(): void {
    this.zoomLevel = PPT_DEFAULT_ZOOM;
    this.renderSlide();
  }

  fitToWidth(): void {
    this.zoomLevel = PPT_DEFAULT_ZOOM;
    this.renderSlide();
  }

  downloadPresentation(): void {
    if (!this.currentPresentation) {
      return;
    }

    const link = document.createElement('a');
    link.href = this.currentPresentation.url;
    link.download = this.currentPresentation.name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    this.toast.info(`Downloaded ${this.currentPresentation.name}`);
  }

  printPresentation(): void {
    if (!this.currentPresentation) {
      return;
    }

    const slideIndex = this.currentSlide - 1;
    if (slideIndex < 0 || slideIndex >= this.currentPresentation.slides.length) {
      return;
    }

    const slide = this.currentPresentation.slides[slideIndex];
    const aspect = this.getSlideAspectRatio();
    const parts: string[] = [
      `<div class="ppt-slide" style="position:relative;aspect-ratio:${aspect};width:100%;max-width:960px;margin:0 auto;background:${slide.background || '#fff'};overflow:hidden;">`
    ];

    for (const element of slide.elements) {
      const box =
        `position:absolute;left:${element.x}%;top:${element.y}%;width:${Math.max(element.width, 1)}%;height:${Math.max(element.height, 1)}%;`;
      if (element.type === 'image' && element.imageData) {
        parts.push(
          `<div style="${box}"><img src="${element.imageData}" style="width:100%;height:100%;object-fit:contain;" /></div>`
        );
      } else if (element.type === 'shape') {
        parts.push(
          `<div style="${box}background:${element.style?.background || 'transparent'};"></div>`
        );
      } else if (element.type === 'text') {
        const s = element.style || {};
        parts.push(
          `<div style="${box}font-size:${s.fontSize || 16}px;font-weight:${s.fontWeight || 400};color:${s.color || '#111'};text-align:${s.textAlign || 'left'};` +
            `${s.background ? `background:${s.background};` : ''}overflow:hidden;padding:2%;box-sizing:border-box;">` +
            `${escapePowerpointHtml(element.content || '').replace(/\n/g, '<br>')}</div>`
        );
      }
    }
    parts.push('</div>');

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>${escapePowerpointHtml(this.currentPresentation.name)} - Slide ${this.currentSlide}</title>
            <style>
              body { margin: 0; padding: 24px; font-family: Calibri, Arial, sans-serif; background: #f1f5f9; }
              @media print { body { background: #fff; padding: 0; } }
            </style>
          </head>
          <body>${parts.join('')}</body>
        </html>
      `);
      printWindow.document.close();
      printWindow.onload = () => {
        printWindow.print();
      };
    }
  }

  removePresentation(index: number): void {
    if (index < 0 || index >= this.presentationFiles.length) {
      return;
    }

    const presFile = this.presentationFiles[index];
    safeRevokeObjectUrl(presFile.url);

    this.presentationFiles.splice(index, 1);

    if (this.currentFileIndex === index) {
      if (this.presentationFiles.length > 0) {
        this.currentFileIndex = Math.min(index, this.presentationFiles.length - 1);
        void this.loadPresentation(this.presentationFiles[this.currentFileIndex]);
      } else {
        this.currentFileIndex = -1;
        this.currentSlide = 1;
        this.totalSlides = 0;
        if (this.slideContainer?.nativeElement) {
          this.slideContainer.nativeElement.innerHTML = '';
        }
      }
    } else if (this.currentFileIndex > index) {
      this.currentFileIndex--;
    }

    this.cdr.detectChanges();
  }

  clearAll(): void {
    if (this.isFullscreen) {
      this.exitFullscreen();
    }

    for (const presFile of this.presentationFiles) {
      safeRevokeObjectUrl(presFile.url);
    }

    this.presentationFiles = [];
    this.currentFileIndex = -1;
    this.currentSlide = 1;
    this.totalSlides = 0;
    this.dismissedSuggestionId = null;
    this.lastParseHadWarnings = false;

    if (this.slideContainer?.nativeElement) {
      this.slideContainer.nativeElement.innerHTML = '';
    }

    if (this.fullscreenSlideContainer?.nativeElement) {
      this.fullscreenSlideContainer.nativeElement.innerHTML = '';
    }

    this.cdr.detectChanges();
  }

  formatFileSize(bytes: number): string {
    return formatPowerpointFileSize(bytes);
  }

  getPresentationTypeLabel(type: PresentationType): string {
    return getPresentationTypeLabel(type);
  }

  @HostListener('document:keydown', ['$event'])
  onKeyDown(e: KeyboardEvent): void {
    const target = e.target as HTMLElement;
    if (
      target &&
      (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
    ) {
      return;
    }

    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      this.previousSlide();
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      this.nextSlide();
    } else if (e.key === 'Escape' && this.isFullscreen) {
      this.exitFullscreen();
    }
  }

  cleanup(): void {
    if (this.isFullscreen) {
      this.exitFullscreen();
    }

    for (const eventName of ['dragenter', 'dragover', 'dragleave', 'drop']) {
      document.removeEventListener(eventName, this.preventDefaultsFn, false);
      document.body.removeEventListener(eventName, this.preventDefaultsFn, false);
    }

    for (const eventName of PPT_FULLSCREEN_EVENTS) {
      document.removeEventListener(eventName, this.fullscreenChangeHandler);
    }

    this.clearAll();
  }
}
