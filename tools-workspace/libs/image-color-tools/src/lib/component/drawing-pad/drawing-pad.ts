import { ChangeDetectionStrategy, Component, ElementRef, ViewChild, WritableSignal, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Navigation } from '@tools-workspace/features-home';

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
  imports: [CommonModule, ReactiveFormsModule, Navigation],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DrawingPadComponent {
  private readonly fb = inject(FormBuilder);

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

  constructor() {
    // Initialize canvas after view init
    setTimeout(() => {
      this.initCanvas();
      this.saveState();
    }, 0);
  }

  initCanvas(): void {
    const canvas = this.drawingCanvas?.nativeElement;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    this.ctx = ctx;

    // Set canvas size
    const container = canvas.parentElement;
    if (container) {
      const rect = container.getBoundingClientRect();
      canvas.width = Math.max(rect.width - 32, 400);
      canvas.height = Math.max(400, rect.height - 32);
    } else {
      canvas.width = 800;
      canvas.height = 600;
    }

    // Set default styles
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = this.currentColor();
    ctx.lineWidth = this.currentBrushSize();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    this.updateCanvasStyle();
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
      this.ctx.strokeStyle = color;
    }

    this.ctx.lineWidth = size;
  }

  onMouseDown(event: MouseEvent | TouchEvent): void {
    event.preventDefault();
    this.isDrawing.set(true);

    const point = this.getEventPoint(event);
    if (!point) return;

    this.lastX = point.x;
    this.lastY = point.y;

    this.updateCanvasStyle();
    this.saveState();
  }

  onMouseMove(event: MouseEvent | TouchEvent): void {
    event.preventDefault();

    if (!this.isDrawing()) return;

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
    this.isDrawing.set(false);
    this.saveState();
  }

  onMouseLeave(): void {
    this.isDrawing.set(false);
  }

  getEventPoint(event: MouseEvent | TouchEvent): { x: number; y: number } | null {
    const canvas = this.drawingCanvas?.nativeElement;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();

    if (event instanceof MouseEvent) {
      return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
      };
    } else if (event instanceof TouchEvent && event.touches.length > 0) {
      return {
        x: event.touches[0].clientX - rect.left,
        y: event.touches[0].clientY - rect.top
      };
    }

    return null;
  }

  onToolChange(tool: DrawingTool): void {
    this.form.patchValue({ tool });
    this.updateCanvasStyle();
  }

  onColorChange(): void {
    this.updateCanvasStyle();
  }

  onBrushSizeChange(): void {
    this.updateCanvasStyle();
  }

  clearCanvas(): void {
    const canvas = this.drawingCanvas?.nativeElement;
    if (!canvas || !this.ctx) return;

    this.ctx.fillStyle = '#ffffff';
    this.ctx.fillRect(0, 0, canvas.width, canvas.height);
    this.saveState();
  }

  undo(): void {
    if (!this.canUndo()) return;

    const newIndex = this.historyIndex() - 1;
    this.historyIndex.set(newIndex);
    this.restoreState(this.history()[newIndex]);
  }

  redo(): void {
    if (!this.canRedo()) return;

    const newIndex = this.historyIndex() + 1;
    this.historyIndex.set(newIndex);
    this.restoreState(this.history()[newIndex]);
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

    // Save current image
    const imageData = this.ctx.getImageData(0, 0, canvas.width, canvas.height);

    // Resize canvas
    const container = canvas.parentElement;
    if (container) {
      const rect = container.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = Math.max(400, rect.height);
    }

    // Restore image
    this.ctx.fillStyle = '#ffffff';
    this.ctx.fillRect(0, 0, canvas.width, canvas.height);
    this.ctx.putImageData(imageData, 0, 0);

    this.updateCanvasStyle();
  }
}
