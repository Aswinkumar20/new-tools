import {
  appendDrawingHistory,
  buildDrawingFilename,
  computeCanvasPixelSize,
  fallbackCanvasPixelSize,
  isValidDrawingHexColor,
  mapClientPointToCanvas,
  resolveDrawingPadSuggestion,
  resolveStrokeStyle
} from './drawing-pad.utils';

describe('drawing-pad.utils', () => {
  describe('color and stroke style', () => {
    it('validates hex and resolves pen vs eraser styles', () => {
      expect(isValidDrawingHexColor('#007bff')).toBe(true);
      expect(isValidDrawingHexColor('red')).toBe(false);

      const pen = resolveStrokeStyle('pen', '#007bff', 10);
      expect(pen.globalCompositeOperation).toBe('source-over');
      expect(pen.strokeStyle).toBe('#007bff');
      expect(pen.lineWidth).toBe(10);

      const eraser = resolveStrokeStyle('eraser', '#007bff', 200);
      expect(eraser.globalCompositeOperation).toBe('destination-out');
      expect(eraser.lineWidth).toBe(100);
    });
  });

  describe('geometry and history', () => {
    it('computes canvas sizes and maps points', () => {
      expect(computeCanvasPixelSize(500, 500)).toEqual({ width: 468, height: 468 });
      expect(fallbackCanvasPixelSize()).toEqual({ width: 800, height: 600 });
      expect(
        mapClientPointToCanvas(10, 20, { left: 0, top: 0, width: 100, height: 50 } as DOMRect, 200, 100)
      ).toEqual({ x: 20, y: 40 });
    });

    it('appends history and trims to the limit', () => {
      const first = appendDrawingHistory([], -1, { imageData: null }, 2);
      expect(first.historyIndex).toBe(0);
      const second = appendDrawingHistory(first.history, first.historyIndex, { imageData: null }, 2);
      const third = appendDrawingHistory(second.history, second.historyIndex, { imageData: null }, 2);
      expect(third.history).toHaveLength(2);
      expect(third.historyIndex).toBe(1);
      expect(buildDrawingFilename(() => 99)).toBe('drawing-99.png');
    });
  });

  describe('resolveDrawingPadSuggestion', () => {
    it('guides invalid color, export, and idle states', () => {
      expect(
        resolveDrawingPadSuggestion({
          historyCount: 0,
          tool: 'pen',
          color: 'bad',
          hasDrawn: false
        })?.id
      ).toBe('dp-color-invalid');

      expect(
        resolveDrawingPadSuggestion({
          historyCount: 3,
          tool: 'pen',
          color: '#007bff',
          hasDrawn: true
        })?.id
      ).toBe('dp-export');

      expect(
        resolveDrawingPadSuggestion({
          historyCount: 1,
          tool: 'pen',
          color: '#007bff',
          hasDrawn: false
        })?.id
      ).toBe('dp-start');
    });
  });
});
