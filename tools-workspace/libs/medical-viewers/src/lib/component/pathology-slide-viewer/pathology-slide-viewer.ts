import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  PLATFORM_ID,
  ViewChild,
  inject
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  AssetService,
  Navigation,
  ToastService,
  TooltipDirective
} from '@tools-workspace/features-home';
import {
  PATHOLOGY_ACCEPT_ATTR,
  PATHOLOGY_FORMATS_HINT,
  PATHOLOGY_FORMATS_LABEL,
  PATHOLOGY_RELATED_TOOLS,
  PATHOLOGY_STAIN_PRESETS,
  PATHOLOGY_SUPPORTED_EXTENSIONS
} from '../../constants/pathology-slide-viewer.constants';
import type {
  PathologyAnnotation,
  PathologyAnnotationType,
  PathologyExportFormat,
  PathologyLoadedSlide
} from '../../types/pathology-slide-viewer.types';
import { canvasToPngDataUrl } from '../../utils/medical-image-render.utils';
import {
  applySlideDimensions,
  buildPyramidLevels,
  canExportPathology,
  clampAnnotationRect,
  computePathologyZoomFit,
  createAnnotationId,
  createPathologySlideRecord,
  createSamplePathologyFile,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  drawSlideToCanvas,
  exportAnnotationsJson,
  exportPathologySummaryJson,
  filterValidPathologyFiles,
  formatPathologyFileSize,
  loadImageFromBytes,
  mimeForSlideExtension,
  pickPyramidLevel,
  readPathologyFileBytes,
  resolvePathologySuggestion,
  screenToImage
} from '../../utils/pathology-slide-viewer.utils';

type AnnotationMode = 'none' | PathologyAnnotationType;

const ANNOTATION_COLOR = '#a21caf';

import {
  applyMedicalFullscreenToggle,
  isDocumentFullscreen,
  listenFullscreenChange
} from '../../utils/medical-fullscreen.utils';

@Component({
  selector: 'lib-pathology-slide-viewer',
  standalone: true,
  templateUrl: './pathology-slide-viewer.html',
  styleUrls: ['./pathology-slide-viewer.scss'],
  imports: [CommonModule, RouterLink, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PathologySlideViewerComponent implements AfterViewInit, OnDestroy {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);
  private readonly hostEl = inject(ElementRef<HTMLElement>);
  private unlistenFullscreen: (() => void) | null = null;

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('canvasHost') canvasHost!: ElementRef<HTMLCanvasElement>;

  readonly acceptAttr = PATHOLOGY_ACCEPT_ATTR;
  readonly relatedTools = PATHOLOGY_RELATED_TOOLS;
  readonly supportedExtensions = PATHOLOGY_SUPPORTED_EXTENSIONS;
  readonly formatsLabel = PATHOLOGY_FORMATS_LABEL;
  readonly formatsHint = PATHOLOGY_FORMATS_HINT;
  readonly stainPresets = PATHOLOGY_STAIN_PRESETS;
  readonly annotationModes: ReadonlyArray<{ id: AnnotationMode; label: string }> = [
    { id: 'none', label: 'Navigate' },
    { id: 'point', label: 'Point' },
    { id: 'rectangle', label: 'Rectangle' }
  ];

  slides: PathologyLoadedSlide[] = [];
  currentSlideIndex = -1;
  loading = false;
  errorMessage = '';
  showDropZone = false;
  showExportMenu = false;
  isFullscreen = false;
  sidebarCollapsed = false;
  dismissedSuggestionId: string | null = null;

  annotationMode: AnnotationMode = 'none';
  brightness = 1;
  contrast = 1;
  activeStainId: string | null = 'he-default';
  zoom = 1;

  private slideImages = new Map<string, HTMLImageElement>();
  private annotationsBySlide = new Map<string, PathologyAnnotation[]>();
  private dragDepth = 0;
  private resizeObserver: ResizeObserver | null = null;
  private panX = 0;
  private panY = 0;
  private fitZoomLevel = 1;
  panning = false;
  private panStartX = 0;
  private panStartY = 0;
  private panOriginX = 0;
  private panOriginY = 0;
  private panDidMove = false;
  private rectDragStart: { x: number; y: number } | null = null;
  rectPreview: { x: number; y: number; width: number; height: number } | null = null;

  get currentSlide(): PathologyLoadedSlide | null {
    return this.currentSlideIndex >= 0 ? this.slides[this.currentSlideIndex] ?? null : null;
  }

  get canExport(): boolean {
    return canExportPathology(this.currentSlide);
  }

  get canPan(): boolean {
    return this.annotationMode === 'none' && this.zoom > this.fitZoomLevel * 1.001;
  }

  get warnings(): string[] {
    return this.currentSlide?.warnings ?? [];
  }

  get currentAnnotations(): PathologyAnnotation[] {
    const slide = this.currentSlide;
    if (!slide) return [];
    return this.annotationsBySlide.get(slide.id) ?? [];
  }

  get primarySuggestion() {
    const suggestion = resolvePathologySuggestion({
      hasSlides: this.slides.length > 0,
      hasError: !!this.errorMessage
    });
    if (!suggestion || suggestion.id === this.dismissedSuggestionId) {
      return null;
    }
    return suggestion;
  }

  get slideLabel(): string {
    const slide = this.currentSlide;
    if (!slide || slide.fullWidth <= 0) return '';
    return `${slide.fullWidth}×${slide.fullHeight}`;
  }

  get pyramidLevelLabel(): string {
    const slide = this.currentSlide;
    if (!slide || slide.fullWidth <= 0) return '';
    const levels = buildPyramidLevels(slide.fullWidth, slide.fullHeight);
    const level = pickPyramidLevel(levels, this.zoom);
    return `Pyramid L${level.level} · ${level.width}×${level.height} · ${level.downsample}×`;
  }

  ngAfterViewInit(): void {
    if (!this.isBrowser) return;
    this.observeCanvasResize();
    this.unlistenFullscreen = listenFullscreenChange(() => {
      if (!isDocumentFullscreen() && this.isFullscreen) {
        this.isFullscreen = false;
        this.cdr.markForCheck();
      }
    });
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.unlistenFullscreen?.();
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    if (this.showExportMenu) {
      this.showExportMenu = false;
      this.cdr.markForCheck();
    }
  }

  @HostListener('window:dragenter', ['$event'])
  onWindowDragEnter(event: DragEvent): void {
    if (!this.isFileDrag(event)) return;
    event.preventDefault();
    this.dragDepth += 1;
    if (!this.showDropZone) {
      this.showDropZone = true;
      this.cdr.markForCheck();
    }
  }

  @HostListener('window:dragover', ['$event'])
  onWindowDragOver(event: DragEvent): void {
    if (!this.isFileDrag(event)) return;
    event.preventDefault();
  }

  @HostListener('window:dragleave', ['$event'])
  onWindowDragLeave(event: DragEvent): void {
    if (!this.isFileDrag(event)) return;
    event.preventDefault();
    this.dragDepth = Math.max(0, this.dragDepth - 1);
    if (this.dragDepth === 0 && this.showDropZone) {
      this.showDropZone = false;
      this.cdr.markForCheck();
    }
  }

  @HostListener('window:drop', ['$event'])
  async onWindowDrop(event: DragEvent): Promise<void> {
    if (!this.isFileDrag(event)) return;
    event.preventDefault();
    this.dragDepth = 0;
    this.showDropZone = false;
    const files = event.dataTransfer?.files;
    if (files?.length) {
      await this.handleFiles(Array.from(files));
    }
    this.cdr.markForCheck();
  }

  @HostListener('window:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (!this.currentSlide || this.isTypingTarget(event.target)) return;

    if (event.key === '+' || event.key === '=') {
      event.preventDefault();
      this.zoomIn();
    } else if (event.key === '-' || event.key === '_') {
      event.preventDefault();
      this.zoomOut();
    } else if (event.key.toLowerCase() === 'f') {
      event.preventDefault();
      this.fitZoom();
    } else if (event.key === 'Escape' && this.isFullscreen) {
      event.preventDefault();
      this.toggleFullscreen();
    }
  }

  trackBySlideId(_index: number, slide: PathologyLoadedSlide): string {
    return slide.id;
  }

  trackByAnnotationId(_index: number, annotation: PathologyAnnotation): string {
    return annotation.id;
  }

  trackByWarning(_index: number, warning: string): string {
    return warning;
  }

  formatSize(bytes: number): string {
    return formatPathologyFileSize(bytes);
  }

  openFilePicker(): void {
    this.fileInput?.nativeElement?.click();
  }

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    await this.handleFiles(Array.from(input.files));
    input.value = '';
  }

  async handleFiles(files: File[]): Promise<void> {
    const { accepted, rejected } = filterValidPathologyFiles(files);
    for (const item of rejected) {
      this.toast.error(`${item.name}: ${item.reason}`);
    }
    if (accepted.length === 0) {
      this.cdr.markForCheck();
      return;
    }

    this.loading = true;
    this.errorMessage = '';
    this.cdr.markForCheck();

    try {
      const loaded: PathologyLoadedSlide[] = [];
      for (const file of accepted) {
        try {
          const bytes = await readPathologyFileBytes(file);
          let record = createPathologySlideRecord(file, bytes);
          const img = await loadImageFromBytes(bytes, mimeForSlideExtension(record.extension));
          const w = img.naturalWidth || img.width;
          const h = img.naturalHeight || img.height;
          if (w <= 0 || h <= 0) {
            throw new Error('Image has no pixel dimensions');
          }
          record = applySlideDimensions(record, w, h);
          this.slideImages.set(record.id, img);
          loaded.push(record);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Invalid pathology slide';
          this.errorMessage = `${file.name}: ${message}`;
          this.toast.error(this.errorMessage);
        }
      }

      if (loaded.length) {
        const merged = [...this.slides, ...loaded];
        const byId = new Map<string, PathologyLoadedSlide>();
        for (const item of merged) {
          byId.set(item.id, item);
        }
        this.slides = Array.from(byId.values());
        this.currentSlideIndex = Math.min(
          Math.max(0, this.slides.length - loaded.length),
          this.slides.length - 1
        );
        this.applyDefaultStain();
        this.fitZoom();
        this.renderCanvas();
        const current = this.currentSlide;
        if (current) {
          this.toast.success(`Loaded ${current.name}`);
          if (current.warnings.length) {
            this.toast.info(`${current.warnings.length} note(s) about this slide`);
          }
        }
      }
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : 'Failed to load pathology slide';
      this.toast.error(this.errorMessage);
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  async loadSample(): Promise<void> {
    await this.handleFiles([createSamplePathologyFile()]);
  }

  selectSlide(index: number): void {
    if (index < 0 || index >= this.slides.length || index === this.currentSlideIndex) {
      return;
    }
    this.currentSlideIndex = index;
    this.rectPreview = null;
    this.rectDragStart = null;
    this.fitZoom();
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  removeSlide(index: number, event: Event): void {
    event.stopPropagation();
    if (index < 0 || index >= this.slides.length) return;
    const removed = this.slides[index];
    this.slideImages.delete(removed.id);
    this.annotationsBySlide.delete(removed.id);
    const next = this.slides.filter((_, i) => i !== index);
    this.slides = next;
    if (next.length === 0) {
      this.clearAll();
      return;
    }
    if (this.currentSlideIndex >= next.length) {
      this.currentSlideIndex = next.length - 1;
    } else if (index < this.currentSlideIndex) {
      this.currentSlideIndex -= 1;
    }
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  clearAll(): void {
    this.slides = [];
    this.currentSlideIndex = -1;
    this.errorMessage = '';
    this.slideImages.clear();
    this.annotationsBySlide.clear();
    this.rectPreview = null;
    this.rectDragStart = null;
    this.clearCanvas();
    this.cdr.markForCheck();
  }

  dismissSuggestion(id: string): void {
    this.dismissedSuggestionId = id;
    this.cdr.markForCheck();
  }

  applySuggestion(suggestion: { id: string }): void {
    if (suggestion.id === 'try-sample') {
      void this.loadSample();
    } else if (suggestion.id === 'upload') {
      this.openFilePicker();
    }
  }

  setAnnotationMode(mode: AnnotationMode): void {
    this.annotationMode = mode;
    this.rectPreview = null;
    this.rectDragStart = null;
    this.cdr.markForCheck();
  }

  deleteAnnotation(id: string): void {
    const slide = this.currentSlide;
    if (!slide) return;
    const next = this.currentAnnotations.filter((a) => a.id !== id);
    this.annotationsBySlide.set(slide.id, next);
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  applyStainPreset(presetId: string): void {
    const preset = this.stainPresets.find((p) => p.id === presetId);
    if (!preset) return;
    this.brightness = preset.brightness;
    this.contrast = preset.contrast;
    this.activeStainId = preset.id;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  onBrightnessChange(event: Event): void {
    this.brightness = Number((event.target as HTMLInputElement).value);
    this.activeStainId = null;
    this.renderCanvas();
  }

  onContrastChange(event: Event): void {
    this.contrast = Number((event.target as HTMLInputElement).value);
    this.activeStainId = null;
    this.renderCanvas();
  }

  toggleSidebar(): void {
    this.sidebarCollapsed = !this.sidebarCollapsed;
    this.cdr.markForCheck();
    setTimeout(() => this.renderCanvas(), 220);
  }

  toggleExportMenu(event: Event): void {
    event.stopPropagation();
    this.showExportMenu = !this.showExportMenu;
    this.cdr.markForCheck();
  }

  exportAs(format: PathologyExportFormat, event?: Event): void {
    event?.stopPropagation();
    this.showExportMenu = false;
    const current = this.currentSlide;
    if (!current) {
      this.toast.error('Nothing to export');
      return;
    }
    const base = current.name.replace(/\.[^.]+$/, '') || 'pathology-slide';
    try {
      if (format === 'original') {
        downloadBinaryFile(current.bytes, current.name, mimeForSlideExtension(current.extension));
        this.toast.success('Exported original file');
      } else if (format === 'annotations-json') {
        downloadTextFile(
          exportAnnotationsJson(this.currentAnnotations, current.name, {
            width: current.fullWidth,
            height: current.fullHeight
          }),
          `${base}-annotations.json`,
          'application/json'
        );
        this.toast.success('Exported annotations JSON');
      } else if (format === 'summary-json') {
        downloadTextFile(
          exportPathologySummaryJson(current, this.currentAnnotations.length),
          `${base}-summary.json`,
          'application/json'
        );
        this.toast.success('Exported summary JSON');
      } else if (format === 'png') {
        const canvas = this.canvasHost?.nativeElement;
        const url = canvas ? canvasToPngDataUrl(canvas) : null;
        if (!url) {
          this.toast.error('PNG snapshot unavailable');
        } else {
          downloadDataUrl(url, `${base}-snapshot.png`);
          this.toast.success('Exported PNG snapshot');
        }
      }
    } catch (error) {
      this.toast.error(error instanceof Error ? error.message : 'Export failed');
    }
    this.cdr.markForCheck();
  }

  zoomIn(): void {
    this.zoom = Math.min(32, this.zoom * 1.15);
    this.renderCanvas();
  }

  zoomOut(): void {
    this.zoom = Math.max(0.02, this.zoom / 1.15);
    this.renderCanvas();
  }

  fitZoom(): void {
    const canvas = this.canvasHost?.nativeElement;
    const slide = this.currentSlide;
    if (!canvas || !slide || slide.fullWidth <= 0) {
      this.zoom = 1;
      this.fitZoomLevel = 1;
      return;
    }
    const rect = canvas.parentElement?.getBoundingClientRect();
    const vw = Math.max(320, Math.floor(rect?.width ?? 800));
    const vh = Math.max(240, Math.floor(rect?.height ?? 560));
    this.zoom = computePathologyZoomFit(vw, vh, slide.fullWidth, slide.fullHeight);
    this.fitZoomLevel = this.zoom;
    this.panX = 0;
    this.panY = 0;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  resetZoom(): void {
    this.zoom = 1;
    this.panX = 0;
    this.panY = 0;
    this.renderCanvas();
  }

  async toggleFullscreen(): Promise<void> {
    if (!this.isBrowser) {
      this.isFullscreen = !this.isFullscreen;
      this.cdr.markForCheck();
      return;
    }
    const result = await applyMedicalFullscreenToggle(this.hostEl.nativeElement, this.isFullscreen);
    this.isFullscreen = result.active;
    this.cdr.markForCheck();
    setTimeout(() => this.fitZoom(), 80);
  }

  onCanvasMouseDown(event: MouseEvent): void {
    const slide = this.currentSlide;
    const canvas = this.canvasHost?.nativeElement;
    if (!slide || !canvas || slide.fullWidth <= 0) return;

    if (this.annotationMode === 'rectangle') {
      event.preventDefault();
      const hit = this.imageCoordsFromEvent(event);
      if (!hit) return;
      this.rectDragStart = hit;
      this.rectPreview = { x: hit.x, y: hit.y, width: 1, height: 1 };
      this.panDidMove = false;
      return;
    }

    if (this.annotationMode === 'none' && this.canPan) {
      event.preventDefault();
      this.panning = true;
      this.panDidMove = false;
      this.panStartX = event.clientX;
      this.panStartY = event.clientY;
      this.panOriginX = this.panX;
      this.panOriginY = this.panY;
    }
  }

  onCanvasMouseMove(event: MouseEvent): void {
    if (this.annotationMode === 'rectangle' && this.rectDragStart) {
      const hit = this.imageCoordsFromEvent(event);
      if (!hit) return;
      const x0 = this.rectDragStart.x;
      const y0 = this.rectDragStart.y;
      const x1 = hit.x;
      const y1 = hit.y;
      const slide = this.currentSlide!;
      this.rectPreview = clampAnnotationRect(
        Math.min(x0, x1),
        Math.min(y0, y1),
        Math.abs(x1 - x0),
        Math.abs(y1 - y0),
        slide.fullWidth,
        slide.fullHeight
      );
      this.renderCanvas();
      return;
    }

    if (!this.panning) return;
    const dx = event.clientX - this.panStartX;
    const dy = event.clientY - this.panStartY;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
      this.panDidMove = true;
    }
    this.panX = this.panOriginX + dx;
    this.panY = this.panOriginY + dy;
    this.renderCanvas();
  }

  onCanvasMouseUp(): void {
    if (this.annotationMode === 'rectangle' && this.rectDragStart && this.rectPreview) {
      const preview = this.rectPreview;
      if (preview.width > 3 && preview.height > 3) {
        this.addAnnotation({
          type: 'rectangle',
          x: preview.x,
          y: preview.y,
          width: preview.width,
          height: preview.height
        });
      }
      this.rectDragStart = null;
      this.rectPreview = null;
      this.renderCanvas();
      this.cdr.markForCheck();
      return;
    }

    this.panning = false;
  }

  onCanvasMouseLeave(): void {
    this.panning = false;
    if (this.rectDragStart) {
      this.rectDragStart = null;
      this.rectPreview = null;
      this.renderCanvas();
    }
  }

  onCanvasClick(event: MouseEvent): void {
    if (this.panDidMove) {
      this.panDidMove = false;
      return;
    }
    if (this.annotationMode === 'point') {
      this.tryAddPointFromEvent(event);
    }
  }

  private tryAddPointFromEvent(event: MouseEvent): void {
    const hit = this.imageCoordsFromEvent(event);
    if (!hit) return;
    this.addAnnotation({ type: 'point', x: hit.x, y: hit.y });
  }

  private addAnnotation(partial: {
    type: PathologyAnnotationType;
    x: number;
    y: number;
    width?: number;
    height?: number;
  }): void {
    const slide = this.currentSlide;
    if (!slide) return;
    const count = this.currentAnnotations.length + 1;
    const label =
      partial.type === 'point' ? `Point ${count}` : `Region ${count}`;
    const annotation: PathologyAnnotation = {
      id: createAnnotationId(),
      type: partial.type,
      label,
      x: Math.round(partial.x),
      y: Math.round(partial.y),
      width: partial.width != null ? Math.round(partial.width) : undefined,
      height: partial.height != null ? Math.round(partial.height) : undefined,
      color: ANNOTATION_COLOR
    };
    const next = [...this.currentAnnotations, annotation];
    this.annotationsBySlide.set(slide.id, next);
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  private imageCoordsFromEvent(event: MouseEvent): { x: number; y: number } | null {
    const slide = this.currentSlide;
    const canvas = this.canvasHost?.nativeElement;
    if (!slide || !canvas || slide.fullWidth <= 0) return null;
    const rect = canvas.getBoundingClientRect();
    return screenToImage(
      event.clientX - rect.left,
      event.clientY - rect.top,
      { zoom: this.zoom, panX: this.panX, panY: this.panY },
      canvas.width,
      canvas.height,
      slide.fullWidth,
      slide.fullHeight
    );
  }

  private applyDefaultStain(): void {
    const preset = this.stainPresets.find((p) => p.id === 'he-default');
    if (!preset) return;
    this.brightness = preset.brightness;
    this.contrast = preset.contrast;
    this.activeStainId = preset.id;
  }

  private renderCanvas(): void {
    if (!this.isBrowser) return;
    const canvas = this.canvasHost?.nativeElement;
    const slide = this.currentSlide;
    if (!canvas) return;

    const rect = canvas.parentElement?.getBoundingClientRect();
    const width = Math.max(320, Math.floor(rect?.width ?? 800));
    const height = Math.max(240, Math.floor(rect?.height ?? 560));
    canvas.width = width;
    canvas.height = height;

    let ctx: CanvasRenderingContext2D | null = null;
    try {
      ctx = canvas.getContext('2d');
    } catch {
      return;
    }
    if (!ctx) return;

    const image = slide ? this.slideImages.get(slide.id) : null;
    if (!slide || !image || slide.fullWidth <= 0) {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '14px ui-sans-serif, system-ui, sans-serif';
      ctx.fillText('Load a pathology slide to preview', 24, 40);
      this.cdr.markForCheck();
      return;
    }

    drawSlideToCanvas(canvas, image, {
      zoom: this.zoom,
      panX: this.panX,
      panY: this.panY,
      brightness: this.brightness,
      contrast: this.contrast
    });
    this.drawAnnotations(ctx, canvas, slide);
    this.cdr.markForCheck();
  }

  private drawAnnotations(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    slide: PathologyLoadedSlide
  ): void {
    const viewport = { zoom: this.zoom, panX: this.panX, panY: this.panY };
    const toScreen = (ix: number, iy: number) =>
      this.imageToScreen(ix, iy, viewport, canvas, slide.fullWidth, slide.fullHeight);

    for (const ann of this.currentAnnotations) {
      ctx.save();
      ctx.strokeStyle = ann.color;
      ctx.fillStyle = ann.color;
      ctx.lineWidth = 2;
      if (ann.type === 'point') {
        const p = toScreen(ann.x, ann.y);
        ctx.beginPath();
        ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      } else if (ann.type === 'rectangle' && ann.width != null && ann.height != null) {
        const tl = toScreen(ann.x, ann.y);
        ctx.strokeRect(tl.x, tl.y, ann.width * this.zoom, ann.height * this.zoom);
      }
      ctx.restore();
    }

    if (this.rectPreview) {
      const tl = toScreen(this.rectPreview.x, this.rectPreview.y);
      ctx.save();
      ctx.setLineDash([6, 4]);
      ctx.strokeStyle = ANNOTATION_COLOR;
      ctx.lineWidth = 2;
      ctx.strokeRect(tl.x, tl.y, this.rectPreview.width * this.zoom, this.rectPreview.height * this.zoom);
      ctx.restore();
    }
  }

  private imageToScreen(
    imageX: number,
    imageY: number,
    viewport: { zoom: number; panX: number; panY: number },
    canvas: HTMLCanvasElement,
    imageWidth: number,
    imageHeight: number
  ): { x: number; y: number } {
    const drawW = imageWidth * viewport.zoom;
    const drawH = imageHeight * viewport.zoom;
    const ox = (canvas.width - drawW) / 2 + viewport.panX;
    const oy = (canvas.height - drawH) / 2 + viewport.panY;
    return {
      x: ox + imageX * viewport.zoom,
      y: oy + imageY * viewport.zoom
    };
  }

  private clearCanvas(): void {
    const canvas = this.canvasHost?.nativeElement;
    if (!canvas || typeof canvas.getContext !== 'function') return;
    if (typeof process !== 'undefined' && process.env['JEST_WORKER_ID']) {
      return;
    }
    let ctx: CanvasRenderingContext2D | null = null;
    try {
      ctx = canvas.getContext('2d');
    } catch {
      return;
    }
    if (!ctx) return;
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, canvas.width || 1, canvas.height || 1);
  }

  private observeCanvasResize(): void {
    const host = this.canvasHost?.nativeElement?.parentElement;
    if (!host || typeof ResizeObserver === 'undefined') return;
    this.resizeObserver = new ResizeObserver(() => this.renderCanvas());
    this.resizeObserver.observe(host);
  }

  private isTypingTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    const tag = target.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
  }

  private isFileDrag(event: DragEvent): boolean {
    const types = event.dataTransfer?.types;
    if (!types) return false;
    return Array.from(types).includes('Files');
  }
}
