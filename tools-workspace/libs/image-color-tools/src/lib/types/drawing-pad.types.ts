import type { FormControl, FormGroup } from '@angular/forms';

export type DrawingTool = 'pen' | 'eraser' | 'brush';

export type DrawingFormGroup = FormGroup<{
  tool: FormControl<DrawingTool>;
  color: FormControl<string>;
  brushSize: FormControl<number>;
  lineWidth: FormControl<number>;
}>;

export interface DrawingFormValues {
  tool: DrawingTool;
  color: string;
  brushSize: number;
  lineWidth: number;
}

export interface DrawingHistoryState {
  imageData: ImageData | null;
}

export interface CanvasPoint {
  x: number;
  y: number;
}

export interface DrawingPadDefaults {
  tool: DrawingTool;
  color: string;
  brushSize: number;
  lineWidth: number;
}

export interface CanvasStrokeStyle {
  globalCompositeOperation: GlobalCompositeOperation;
  strokeStyle: string;
  lineWidth: number;
  lineCap: CanvasLineCap;
  lineJoin: CanvasLineJoin;
}
