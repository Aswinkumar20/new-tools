import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  ViewChild,
  computed,
  inject,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Navigation, TooltipDirective, AssetService, ToastService } from '@tools-workspace/features-home';
import { Subscription } from 'rxjs';
import {
  DRAWING_PAD_BACKGROUND,
  DRAWING_PAD_BRUSH_MAX,
  DRAWING_PAD_BRUSH_MIN,
  DRAWING_PAD_DEFAULTS,
  DRAWING_PAD_INIT_DELAY_MS,
  DRAWING_PAD_LINE_MAX,
  DRAWING_PAD_RELATED_TOOLS
} from '../../constants/drawing-pad.constants';
import { ictDownloadBlob } from '../../shared/ict-download.util';
import type { IctRelatedToolLink } from '../../shared/ict-tool-suggestion.model';
import type {
  DrawingFormGroup,
  DrawingFormValues,
  DrawingHistoryState,
  DrawingTool
} from '../../types/drawing-pad.types';
import {
  appendDrawingHistory,
  applyStrokeStyle,
  buildDrawingFilename,
  computeCanvasPixelSize,
  fallbackCanvasPixelSize,
  mapClientPointToCanvas,
  resolveDrawingPadSuggestion,
  resolveEventClientPoint,
  resolveStrokeStyle
} from '../../utils/drawing-pad.utils';

@Component({
  selector: 'lib-drawing-pad',
  standalone: true,
  templateUrl: './drawing-pad.html',
  styleUrls: ['./drawing-pad.scss'],
  imports: [CommonModule, ReactiveFormsModule, RouterLink, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DrawingPadComponent implements AfterViewInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly toast = inject(ToastService);
  readonly assetService = inject(AssetService);
  private resizeObserver?: ResizeObserver;
  private formSubscription?: Subscription;

  @ViewChild('drawingCanvas', { static: false }) drawingCanvas!: ElementRef<HTMLCanvasElement>;

  readonly form: DrawingFormGroup = this.fb.group({
    tool: this.fb.control<DrawingTool>(DRAWING_PAD_DEFAULTS.tool, { nonNullable: true }),
    color: this.fb.control<string>(DRAWING_PAD_DEFAULTS.color, {
      nonNullable: true,
      validators: [Validators.required]
    }),
    brushSize: this.fb.control<number>(DRAWING_PAD_DEFAULTS.brushSize, {
      nonNullable: true,
      validators: [Validators.min(DRAWING_PAD_BRUSH_MIN), Validators.max(DRAWING_PAD_BRUSH_MAX)]
    }),
    lineWidth: this.fb.control<number>(DRAWING_PAD_DEFAULTS.lineWidth, {
      nonNullable: true,
      validators: [Validators.min(DRAWING_PAD_BRUSH_MIN), Validators.max(DRAWING_PAD_LINE_MAX)]
    })
  });

  readonly formSnapshot = signal<DrawingFormValues>(this.form.getRawValue());
  readonly isDrawing = signal(false);
  readonly history = signal<DrawingHistoryState[]>([]);
  readonly historyIndex = signal(-1);
  private readonly dismissedSuggestionId = signal<string | null>(null);
  private readonly hasDrawn = signal(false);

  readonly relatedTools: ReadonlyArray<IctRelatedToolLink> = DRAWING_PAD_RELATED_TOOLS;

  readonly canUndo = computed(() => this.historyIndex() > 0);
  readonly canRedo = computed(() => this.historyIndex() < this.history().length - 1);
  readonly currentTool = computed(() => this.formSnapshot().tool);
  readonly currentColor = computed(() => this.formSnapshot().color);
  readonly currentBrushSize = computed(() => this.formSnapshot().brushSize);

  readonly primarySuggestion = computed(() => {
    const snapshot = this.formSnapshot();
    const suggestion = resolveDrawingPadSuggestion({
      historyCount: this.history().length,
      tool: snapshot.tool,
      color: snapshot.color,
      hasDrawn: this.hasDrawn()
    });
    if (!suggestion || this.dismissedSuggestionId() === suggestion.id) {
      return null;
    }
    return suggestion;
  });

  private lastX = 0;
  private lastY = 0;
  private ctx: CanvasRenderingContext2D | null = null;
  private isInitialized = false;

  constructor() {
    this.formSubscription = this.form.valueChanges.subscribe(() => {
      this.formSnapshot.set(this.form.getRawValue());
    });
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      this.initCanvas();
      this.setupResizeObserver();
      this.saveState();
      this.isInitialized = true;
      this.cdr.markForCheck();
    }, DRAWING_PAD_INIT_DELAY_MS);
  }

  ngOnDestroy(): void {
    this.formSubscription?.unsubscribe();
    this.resizeObserver?.disconnect();
  }

  private setupResizeObserver(): void {
    const container = this.drawingCanvas?.nativeElement?.parentElement;
    if (!container || typeof ResizeObserver === 'undefined') {
      return;
    }

    this.resizeObserver = new ResizeObserver(() => {
      if (this.isInitialized) {
        this.onResize();
      }
    });

    this.resizeObserver.observe(container);
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    if (this.isInitialized && !this.resizeObserver) {
      this.onResize();
    }
  }

  initCanvas(): void {
    const canvas = this.drawingCanvas?.nativeElement;
    if (!canvas) {
      return;
    }

    let ctx: CanvasRenderingContext2D | null = null;
    try {
      ctx = canvas.getContext('2d');
    } catch {
      return;
    }
    if (!ctx) {
      return;
    }

    this.ctx = ctx;
    this.resizeCanvas();
    ctx.fillStyle = DRAWING_PAD_BACKGROUND;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    this.updateCanvasStyle();
  }

  private resizeCanvas(): void {
    const canvas = this.drawingCanvas?.nativeElement;
    if (!canvas || !this.ctx) {
      return;
    }

    const container = canvas.parentElement;
    if (container) {
      const rect = container.getBoundingClientRect();
      const size = computeCanvasPixelSize(rect.width, rect.height);
      canvas.width = size.width;
      canvas.height = size.height;
      canvas.style.width = '100%';
      canvas.style.height = 'auto';
      canvas.style.maxWidth = `${size.width}px`;
      canvas.style.maxHeight = `${size.height}px`;
    } else {
      const size = fallbackCanvasPixelSize();
      canvas.width = size.width;
      canvas.height = size.height;
    }
  }

  updateCanvasStyle(): void {
    if (!this.ctx) {
      return;
    }
    const snapshot = this.formSnapshot();
    applyStrokeStyle(
      this.ctx,
      resolveStrokeStyle(snapshot.tool, snapshot.color, snapshot.brushSize)
    );
  }

  onMouseDown(event: MouseEvent | TouchEvent): void {
    event.preventDefault();
    event.stopPropagation();

    this.isDrawing.set(true);

    const point = this.getEventPoint(event);
    if (!point) {
      return;
    }

    this.lastX = point.x;
    this.lastY = point.y;

    this.updateCanvasStyle();
    this.saveState();
    this.cdr.markForCheck();
  }

  onMouseMove(event: MouseEvent | TouchEvent): void {
    if (!this.isDrawing()) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const point = this.getEventPoint(event);
    if (!point || !this.ctx) {
      return;
    }

    this.ctx.beginPath();
    this.ctx.moveTo(this.lastX, this.lastY);
    this.ctx.lineTo(point.x, point.y);
    this.ctx.stroke();

    this.lastX = point.x;
    this.lastY = point.y;
    this.hasDrawn.set(true);
  }

  onMouseUp(event: MouseEvent | TouchEvent): void {
    event.preventDefault();
    event.stopPropagation();

    if (this.isDrawing()) {
      this.isDrawing.set(false);
      this.saveState();
      this.cdr.markForCheck();
    }
  }

  onMouseLeave(): void {
    if (this.isDrawing()) {
      this.isDrawing.set(false);
      this.cdr.markForCheck();
    }
  }

  getEventPoint(event: MouseEvent | TouchEvent): { x: number; y: number } | null {
    const canvas = this.drawingCanvas?.nativeElement;
    if (!canvas) {
      return null;
    }

    const client = resolveEventClientPoint(event);
    if (!client) {
      return null;
    }

    const rect = canvas.getBoundingClientRect();
    return mapClientPointToCanvas(
      client.clientX,
      client.clientY,
      rect,
      canvas.width,
      canvas.height
    );
  }

  onToolChange(tool: DrawingTool): void {
    this.form.patchValue({ tool });
    this.formSnapshot.set(this.form.getRawValue());
    this.updateCanvasStyle();
  }

  onColorChange(): void {
    this.formSnapshot.set(this.form.getRawValue());
    if (this.ctx) {
      this.updateCanvasStyle();
      this.cdr.markForCheck();
    }
  }

  onBrushSizeChange(): void {
    this.formSnapshot.set(this.form.getRawValue());
    if (this.ctx) {
      this.updateCanvasStyle();
      this.cdr.markForCheck();
    }
  }

  clearCanvas(): void {
    const canvas = this.drawingCanvas?.nativeElement;
    if (!canvas || !this.ctx) {
      return;
    }

    this.ctx.fillStyle = DRAWING_PAD_BACKGROUND;
    this.ctx.fillRect(0, 0, canvas.width, canvas.height);
    this.saveState();
    this.cdr.markForCheck();
  }

  undo(): void {
    if (!this.canUndo()) {
      return;
    }

    const newIndex = this.historyIndex() - 1;
    this.historyIndex.set(newIndex);
    this.restoreState(this.history()[newIndex]);
    this.cdr.markForCheck();
  }

  redo(): void {
    if (!this.canRedo()) {
      return;
    }

    const newIndex = this.historyIndex() + 1;
    this.historyIndex.set(newIndex);
    this.restoreState(this.history()[newIndex]);
    this.cdr.markForCheck();
  }

  saveState(): void {
    const canvas = this.drawingCanvas?.nativeElement;
    if (!canvas || !this.ctx) {
      return;
    }

    let imageData: ImageData | null = null;
    try {
      imageData = this.ctx.getImageData(0, 0, canvas.width, canvas.height);
    } catch {
      return;
    }

    const next = appendDrawingHistory(this.history(), this.historyIndex(), { imageData });
    this.history.set(next.history);
    this.historyIndex.set(next.historyIndex);
  }

  restoreState(state: DrawingHistoryState): void {
    const canvas = this.drawingCanvas?.nativeElement;
    if (!canvas || !this.ctx || !state.imageData) {
      return;
    }

    this.ctx.fillStyle = DRAWING_PAD_BACKGROUND;
    this.ctx.fillRect(0, 0, canvas.width, canvas.height);
    this.ctx.putImageData(state.imageData, 0, 0);
    this.updateCanvasStyle();
  }

  downloadCanvas(): void {
    const canvas = this.drawingCanvas?.nativeElement;
    if (!canvas) {
      return;
    }

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          this.toast.error('Unable to export drawing');
          return;
        }
        ictDownloadBlob(this.toast, blob, buildDrawingFilename(), 'Drawing');
      },
      'image/png',
      1.0
    );
  }

  onResize(): void {
    const canvas = this.drawingCanvas?.nativeElement;
    if (!canvas || !this.ctx) {
      return;
    }

    let imageData: ImageData | null = null;
    if (canvas.width > 0 && canvas.height > 0) {
      try {
        imageData = this.ctx.getImageData(0, 0, canvas.width, canvas.height);
      } catch {
        imageData = null;
      }
    }

    this.resizeCanvas();

    if (imageData) {
      this.ctx.fillStyle = DRAWING_PAD_BACKGROUND;
      this.ctx.fillRect(0, 0, canvas.width, canvas.height);
      try {
        this.ctx.putImageData(imageData, 0, 0);
      } catch {
        this.ctx.fillStyle = DRAWING_PAD_BACKGROUND;
        this.ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
    } else {
      this.ctx.fillStyle = DRAWING_PAD_BACKGROUND;
      this.ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    this.updateCanvasStyle();
    this.cdr.markForCheck();
  }

  dismissSuggestion(suggestionId: string): void {
    this.dismissedSuggestionId.set(suggestionId);
  }
}
