import { defaultCad3dView, renderCad3d, type Cad3dSolid } from './cad-3d.utils';

function box(id: string): Cad3dSolid {
  return { id, name: id, kind: 'box', colorHex: '#60a5fa', cx: 0, cy: 0, cz: 0, sx: 1, sy: 1, sz: 1, r: 0, h: 1 };
}

function mockCanvas(): { canvas: HTMLCanvasElement; fillStyles: string[] } {
  const canvas = document.createElement('canvas');
  canvas.width = 160;
  canvas.height = 100;
  const fillStyles: string[] = [];
  const ctx = {
    fillRect: jest.fn(),
    beginPath: jest.fn(),
    moveTo: jest.fn(),
    lineTo: jest.fn(),
    closePath: jest.fn(),
    stroke: jest.fn(),
    fillText: jest.fn(),
    strokeRect: jest.fn(),
    set fillStyle(value: string) {
      fillStyles.push(value);
    },
    get fillStyle() {
      return fillStyles[fillStyles.length - 1] ?? '';
    },
    strokeStyle: '',
    lineWidth: 1,
    font: ''
  };
  jest.spyOn(canvas, 'getContext').mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
  return { canvas, fillStyles };
}

describe('cad-3d.utils theme-aware render', () => {
  it('does not crash with empty solids', () => {
    const { canvas } = mockCanvas();
    expect(() => renderCad3d(canvas, [], null, defaultCad3dView(), 'None', 'light')).not.toThrow();
    expect(() => renderCad3d(canvas, [], null, defaultCad3dView(), 'None', 'dark')).not.toThrow();
  });

  it('respects a passed background color', () => {
    const { canvas, fillStyles } = mockCanvas();
    renderCad3d(canvas, [box('a')], 'a', defaultCad3dView(), 'None', {
      background: '#102030',
      muted: '#8899aa',
      text: '#fff',
      hint: '#ccc',
      selection: '#ff0'
    });
    expect(fillStyles[0]).toBe('#102030');
  });
});
