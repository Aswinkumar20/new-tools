import type { IctToolSuggestion } from '../shared/ict-tool-suggestion.model';
import {
  DRAWING_PAD_BRUSH_MAX,
  DRAWING_PAD_BRUSH_MIN,
  DRAWING_PAD_CONTAINER_PADDING,
  DRAWING_PAD_FALLBACK_SIZE,
  DRAWING_PAD_HISTORY_LIMIT,
  DRAWING_PAD_MIN_SIZE
} from '../constants/drawing-pad.constants';
import type {
  CanvasPoint,
  CanvasStrokeStyle,
  DrawingHistoryState,
  DrawingTool
} from '../types/drawing-pad.types';

export function isValidDrawingHexColor(color: string): boolean {
  if (!color) {
    return false;
  }
  return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color);
}

export function resolveStrokeStyle(
  tool: DrawingTool,
  color: string,
  brushSize: number
): CanvasStrokeStyle {
  const clampedSize = Math.max(DRAWING_PAD_BRUSH_MIN, Math.min(DRAWING_PAD_BRUSH_MAX, brushSize));

  if (tool === 'eraser') {
    return {
      globalCompositeOperation: 'destination-out',
      strokeStyle: 'rgba(0,0,0,1)',
      lineWidth: clampedSize,
      lineCap: 'round',
      lineJoin: 'round'
    };
  }

  return {
    globalCompositeOperation: 'source-over',
    strokeStyle: isValidDrawingHexColor(color) ? color : '#000000',
    lineWidth: clampedSize,
    lineCap: 'round',
    lineJoin: 'round'
  };
}

export function applyStrokeStyle(ctx: CanvasRenderingContext2D, style: CanvasStrokeStyle): void {
  ctx.globalCompositeOperation = style.globalCompositeOperation;
  ctx.strokeStyle = style.strokeStyle;
  ctx.lineWidth = style.lineWidth;
  ctx.lineCap = style.lineCap;
  ctx.lineJoin = style.lineJoin;
}

export function computeCanvasPixelSize(
  containerWidth: number,
  containerHeight: number,
  padding: number = DRAWING_PAD_CONTAINER_PADDING,
  minSize: number = DRAWING_PAD_MIN_SIZE
): { width: number; height: number } {
  return {
    width: Math.max(containerWidth - padding, minSize),
    height: Math.max(containerHeight - padding, minSize)
  };
}

export function fallbackCanvasPixelSize(): { width: number; height: number } {
  return {
    width: DRAWING_PAD_FALLBACK_SIZE.width,
    height: DRAWING_PAD_FALLBACK_SIZE.height
  };
}

export function mapClientPointToCanvas(
  clientX: number,
  clientY: number,
  rect: DOMRect,
  canvasWidth: number,
  canvasHeight: number
): CanvasPoint {
  const scaleX = canvasWidth / rect.width;
  const scaleY = canvasHeight / rect.height;
  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top) * scaleY
  };
}

export function resolveEventClientPoint(
  event: MouseEvent | TouchEvent
): { clientX: number; clientY: number } | null {
  if (event instanceof MouseEvent) {
    return { clientX: event.clientX, clientY: event.clientY };
  }
  if (event instanceof TouchEvent) {
    const touch = event.touches.length > 0 ? event.touches[0] : event.changedTouches[0];
    if (touch) {
      return { clientX: touch.clientX, clientY: touch.clientY };
    }
  }
  return null;
}

export function appendDrawingHistory(
  history: readonly DrawingHistoryState[],
  historyIndex: number,
  nextState: DrawingHistoryState,
  limit: number = DRAWING_PAD_HISTORY_LIMIT
): { history: DrawingHistoryState[]; historyIndex: number } {
  const trimmed = history.slice(0, historyIndex + 1);
  const next = [...trimmed, nextState];

  if (next.length > limit) {
    next.shift();
    return { history: next, historyIndex: next.length - 1 };
  }

  return { history: next, historyIndex: next.length - 1 };
}

export function buildDrawingFilename(now: (() => number) = Date.now): string {
  return `drawing-${now()}.png`;
}

export function resolveDrawingPadSuggestion(options: {
  historyCount: number;
  tool: DrawingTool;
  color: string;
  hasDrawn: boolean;
}): IctToolSuggestion | null {
  const { historyCount, tool, color, hasDrawn } = options;

  if (!isValidDrawingHexColor(color)) {
    return {
      id: 'dp-color-invalid',
      title: 'Color value looks invalid',
      reason:
        'Use a #RGB or #RRGGBB value. Color Picker can help you pick a valid HEX for the brush.',
      actionLabel: 'Open Color Picker',
      path: '/image-color-tools/color-picker'
    };
  }

  if (tool === 'eraser' && hasDrawn) {
    return {
      id: 'dp-eraser',
      title: 'Erasing detail?',
      reason:
        'Eraser removes strokes with destination-out. Prefer Clear if you want a full white reset.',
      actionLabel: 'Open Color Picker',
      path: '/image-color-tools/color-picker'
    };
  }

  if (hasDrawn || historyCount > 1) {
    return {
      id: 'dp-export',
      title: 'Ready to export and refine?',
      reason:
        'Download your PNG, then Image Compressor or Image Resizer can prepare it for sharing.',
      actionLabel: 'Open Image Compressor',
      path: '/image-color-tools/image-compressor'
    };
  }

  return {
    id: 'dp-start',
    title: 'Pick a color, then draw',
    reason:
      'Start with Pen or Brush. Color Picker helps you choose HEX values beyond the native swatch.',
    actionLabel: 'Open Color Picker',
    path: '/image-color-tools/color-picker'
  };
}
