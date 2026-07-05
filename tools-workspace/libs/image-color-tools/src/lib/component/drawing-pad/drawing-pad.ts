import { AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, HostListener, OnDestroy, ViewChild, WritableSignal, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Navigation, TooltipDirective, AssetService } from '@tools-workspace/features-home';

type DrawingTool = 'pen' | 'eraser' | 'brush';
type DrawingFormGroup = FormGroup<{
  tool: FormControl<DrawingTool>;
  color: FormControl<string>;
  brushSize: FormControl<number>;
  lineWidth: FormControl<number>;
}>;

interface DrawingState {
  imageData: ImageData | null;
}

@Component({
  selector: 'lib-drawing-pad',
  standalone: true,
  templateUrl: './drawing-pad.html',
  styleUrls: ['./drawing-pad.scss'],
  imports: [CommonModule, ReactiveFormsModule, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DrawingPadComponent implements AfterViewInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly cdr = inject(ChangeDetectorRef);
  readonly assetService = inject(AssetService);
  private resizeObserver?: ResizeObserver;

  @ViewChild('drawingCanvas', { static: false }) drawingCanvas!: ElementRef<HTMLCanvasElement>;

  readonly form: DrawingFormGroup = this.fb.group({
    tool: this.fb.control<DrawingTool>('pen', { nonNullable: true }),
    color: this.fb.control<string>('#007bff', {
      nonNullable: true,
      validators: [Validators.required]
    }),
    brushSize: this.fb.control<number>(10, {
      nonNullable: true,
      validators: [Validators.min(1), Validators.max(100)]
    }),
    lineWidth: this.fb.control<number>(2, {
      nonNullable: true,
      validators: [Validators.min(1), Validators.max(50)]
    })
  });

  readonly isDrawing = signal(false);
  readonly history: WritableSignal<DrawingState[]> = signal([]);
  readonly historyIndex: WritableSignal<number> = signal(-1);

  readonly canUndo = computed(() => this.historyIndex() > 0);
  readonly canRedo = computed(() => this.historyIndex() < this.history().length - 1);
  readonly currentTool = computed(() => this.form.controls.tool.value);
  readonly currentColor = computed(() => this.form.controls.color.value);
  readonly currentBrushSize = computed(() => this.form.controls.brushSize.value);

  private lastX = 0;
  private lastY = 0;
  private ctx: CanvasRenderingContext2D | null = null;
  private isInitialized = false;

  ngAfterViewInit(): void {
    // Initialize canvas after view is ready
    setTimeout(() => {
      this.initCanvas();
      this.setupResizeObserver();
      this.saveState();
      this.isInitialized = true;
      this.cdr.markForCheck();
    }, 100);
  }

  ngOnDestroy(): void {
    // Clean up resize observer
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
  }

  private setupResizeObserver(): void {
    const container = this.drawingCanvas?.nativeElement?.parentElement;
    if (!container || typeof ResizeObserver === 'undefined') {
      // Fallback to window resize if ResizeObserver is not available
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
      // Only use window resize if ResizeObserver is not available
      this.onResize();
    }
  }

  initCanvas(): void {
    const canvas = this.drawingCanvas?.nativeElement;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    this.ctx = ctx;

    // Set canvas size based on container
    this.resizeCanvas();

    // Set default styles
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = this.currentColor();
    ctx.lineWidth = this.currentBrushSize();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    this.updateCanvasStyle();
  }

  private resizeCanvas(): void {
    const canvas = this.drawingCanvas?.nativeElement;
    if (!canvas || !this.ctx) return;

    const container = canvas.parentElement;
    if (container) {
      const rect = container.getBoundingClientRect();
      const padding = 32; // Account for container padding
      const maxWidth = Math.max(rect.width - padding, 400);
      const maxHeight = Math.max(rect.height - padding, 400);
      
      // Maintain aspect ratio or use available space
      canvas.width = maxWidth;
      canvas.height = maxHeight;
      
      // Update CSS size to match container
      canvas.style.width = '100%';
      canvas.style.height = 'auto';
      canvas.style.maxWidth = `${maxWidth}px`;
      canvas.style.maxHeight = `${maxHeight}px`;
    } else {
      canvas.width = 800;
      canvas.height = 600;
    }
  }

  updateCanvasStyle(): void {
    const canvas = this.drawingCanvas?.nativeElement;
    if (!canvas || !this.ctx) return;

    const tool = this.currentTool();
    const color = this.currentColor();
    const size = this.currentBrushSize();

    if (tool === 'eraser') {
      this.ctx.globalCompositeOperation = 'destination-out';
      this.ctx.strokeStyle = 'rgba(0,0,0,1)';
    } else {
      this.ctx.globalCompositeOperation = 'source-over';
      // Ensure color is valid hex color, fallback to black if invalid
      const validColor = this.isValidHexColor(color) ? color : '#000000';
      this.ctx.strokeStyle = validColor;
    }

    this.ctx.lineWidth = Math.max(1, Math.min(100, size)); // Clamp between 1 and 100
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
  }

  private isValidHexColor(color: string): boolean {
    if (!color) return false;
    return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color);
  }

  onMouseDown(event: MouseEvent | TouchEvent): void {
    event.preventDefault();
    event.stopPropagation();
    
    this.isDrawing.set(true);

    const point = this.getEventPoint(event);
    if (!point) return;

    this.lastX = point.x;
    this.lastY = point.y;

    this.updateCanvasStyle();
    this.saveState();
    this.cdr.markForCheck();
  }

  onMouseMove(event: MouseEvent | TouchEvent): void {
    if (!this.isDrawing()) return;
    
    event.preventDefault();
    event.stopPropagation();

    const point = this.getEventPoint(event);
    if (!point || !this.ctx) return;

    this.ctx.beginPath();
    this.ctx.moveTo(this.lastX, this.lastY);
    this.ctx.lineTo(point.x, point.y);
    this.ctx.stroke();

    this.lastX = point.x;
    this.lastY = point.y;
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
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if (event instanceof MouseEvent) {
      return {
        x: (event.clientX - rect.left) * scaleX,
        y: (event.clientY - rect.top) * scaleY
      };
    } else if (event instanceof TouchEvent) {
      const touch = event.touches.length > 0 ? event.touches[0] : event.changedTouches[0];
      if (touch) {
        return {
          x: (touch.clientX - rect.left) * scaleX,
          y: (touch.clientY - rect.top) * scaleY
        };
      }
    }

    return null;
  }

  onToolChange(tool: DrawingTool): void {
    this.form.patchValue({ tool });
    this.updateCanvasStyle();
  }

  onColorChange(): void {
    if (this.ctx) {
      this.updateCanvasStyle();
      // Force update to show color change immediately
      this.cdr.markForCheck();
    }
  }

  onBrushSizeChange(): void {
    if (this.ctx) {
      this.updateCanvasStyle();
      // Force update to show brush size change immediately
      this.cdr.markForCheck();
    }
  }

  clearCanvas(): void {
    const canvas = this.drawingCanvas?.nativeElement;
    if (!canvas || !this.ctx) return;

    this.ctx.fillStyle = '#ffffff';
    this.ctx.fillRect(0, 0, canvas.width, canvas.height);
    this.saveState();
    this.cdr.markForCheck();
  }

  undo(): void {
    if (!this.canUndo()) return;

    const newIndex = this.historyIndex() - 1;
    this.historyIndex.set(newIndex);
    this.restoreState(this.history()[newIndex]);
    this.cdr.markForCheck();
  }

  redo(): void {
    if (!this.canRedo()) return;

    const newIndex = this.historyIndex() + 1;
    this.historyIndex.set(newIndex);
    this.restoreState(this.history()[newIndex]);
    this.cdr.markForCheck();
  }

  saveState(): void {
    const canvas = this.drawingCanvas?.nativeElement;
    if (!canvas || !this.ctx) return;

    const currentIndex = this.historyIndex();
    const imageData = this.ctx.getImageData(0, 0, canvas.width, canvas.height);

    // Remove any states after current index (if we're undoing and then drawing)
    const newHistory = this.history().slice(0, currentIndex + 1);
    newHistory.push({ imageData });

    // Limit history to 20 states
    if (newHistory.length > 20) {
      newHistory.shift();
      this.historyIndex.set(newHistory.length - 1);
    } else {
      this.historyIndex.set(newHistory.length - 1);
    }

    this.history.set(newHistory);
  }

  restoreState(state: DrawingState): void {
    const canvas = this.drawingCanvas?.nativeElement;
    if (!canvas || !this.ctx || !state.imageData) return;

    // Clear canvas first
    this.ctx.fillStyle = '#ffffff';
    this.ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Restore image data
    this.ctx.putImageData(state.imageData, 0, 0);
    this.updateCanvasStyle();
  }

  downloadCanvas(): void {
    const canvas = this.drawingCanvas?.nativeElement;
    if (!canvas) return;

    canvas.toBlob(
      (blob) => {
        if (!blob) return;

        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `drawing-${Date.now()}.png`;
        anchor.click();
        URL.revokeObjectURL(url);
      },
      'image/png',
      1.0
    );
  }

  onResize(): void {
    const canvas = this.drawingCanvas?.nativeElement;
    if (!canvas || !this.ctx) return;

    // Save current image if canvas has content
    let imageData: ImageData | null = null;
    if (canvas.width > 0 && canvas.height > 0) {
      try {
        imageData = this.ctx.getImageData(0, 0, canvas.width, canvas.height);
      } catch (e) {
        console.warn('Could not save canvas state during resize:', e);
      }
    }

    // Resize canvas
    this.resizeCanvas();

    // Restore image if we had one
    if (imageData) {
      this.ctx.fillStyle = '#ffffff';
      this.ctx.fillRect(0, 0, canvas.width, canvas.height);
      try {
        this.ctx.putImageData(imageData, 0, 0);
      } catch (e) {
        console.warn('Could not restore canvas state during resize:', e);
        // If restore fails, just clear the canvas
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
    } else {
      // Clear canvas if no previous content
      this.ctx.fillStyle = '#ffffff';
      this.ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    this.updateCanvasStyle();
    this.cdr.markForCheck();
  }
}
