import {
  buildCadInsightStats,
  clampCadZoom,
  filterValidCadFiles,
  fitCadView,
  pickCadEntityAtScreen,
  renderCadDrawing,
  resolveCadCanvasTheme,
  sizeCadCanvas,
  worldToScreen,
  type CadGeomEntity
} from './cad-file.utils';

function line(id: string, x: number, y: number, x2: number, y2: number): CadGeomEntity {
  return { id, type: 'line', layer: '0', colorHex: '#fff', x, y, x2, y2, r: 0, text: '', points: [] };
}

function mockCanvas(): { canvas: HTMLCanvasElement; fillStyles: string[] } {
  const canvas = document.createElement('canvas');
  canvas.width = 120;
  canvas.height = 80;
  const fillStyles: string[] = [];
  const ctx = {
    fillRect: jest.fn(),
    beginPath: jest.fn(),
    moveTo: jest.fn(),
    lineTo: jest.fn(),
    closePath: jest.fn(),
    stroke: jest.fn(),
    fill: jest.fn(),
    arc: jest.fn(),
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

describe('cad-file.utils viewer helpers', () => {
  it('sizes a canvas to its parent without a 360px cap', () => {
    const parent = document.createElement('div');
    Object.defineProperty(parent, 'clientWidth', { value: 900 });
    Object.defineProperty(parent, 'clientHeight', { value: 640 });
    const canvas = document.createElement('canvas');
    parent.appendChild(canvas);
    const size = sizeCadCanvas(canvas);
    expect(size).toEqual({ width: 900, height: 640 });
    expect(canvas.width).toBe(900);
    expect(canvas.height).toBe(640);
  });

  it('picks the nearest line in screen space', () => {
    const entities = [line('a', 0, 0, 10, 0), line('b', 0, 8, 10, 8)];
    const view = fitCadView(entities, 400, 300);
    const mid = worldToScreen(5, 0, view, 300);
    expect(pickCadEntityAtScreen(entities, view, 300, mid.x, mid.y)).toBe('a');
  });

  it('returns null when the click is far from geometry', () => {
    const entities = [line('a', 0, 0, 2, 0)];
    const view = fitCadView(entities, 400, 300);
    expect(pickCadEntityAtScreen(entities, view, 300, 390, 10, 8)).toBeNull();
  });
});

describe('filterValidCadFiles', () => {
  const options = {
    extensions: ['.dxf', '.json', '.txt'] as const,
    maxBytes: 64 * 1024 * 1024,
    formatsLabel: '.dxf, .json, .txt',
    gzipReason: 'Compressed DXF files are not supported — decompress first'
  };

  it('rejects empty, huge, gzip, wrong extension, and duplicates; accepts supported types', () => {
    const ok = new File(['ISO-10303'], 'shop.dxf', { lastModified: 1 });
    const dup = new File(['ISO-10303'], 'shop.dxf', { lastModified: 1 });
    const empty = new File(['x'], 'empty.dxf', { lastModified: 2 });
    Object.defineProperty(empty, 'size', { value: 0 });
    const huge = new File(['x'], 'huge.dxf', { lastModified: 3 });
    Object.defineProperty(huge, 'size', { value: 65 * 1024 * 1024 });
    const { accepted, rejected } = filterValidCadFiles(
      [ok, dup, empty, huge, new File(['x'], 'note.doc', { lastModified: 4 }), new File(['x'], 'plan.dxf.gz', { lastModified: 5 })],
      options
    );
    expect(accepted).toEqual([ok]);
    expect(rejected.some((item) => item.reason.includes('Duplicate'))).toBe(true);
    expect(rejected.some((item) => /empty/i.test(item.reason))).toBe(true);
    expect(rejected.some((item) => item.reason.includes('too large'))).toBe(true);
    expect(rejected.some((item) => item.reason.includes('Unsupported'))).toBe(true);
    expect(rejected.some((item) => item.reason.includes('Compressed'))).toBe(true);
  });
});

describe('cad theme + zoom helpers', () => {
  it('clamps zoom and rejects NaN or non-positive scales', () => {
    expect(clampCadZoom(2)).toBe(2);
    expect(clampCadZoom(0)).toBe(0.05);
    expect(clampCadZoom(-4)).toBe(0.05);
    expect(clampCadZoom(Number.NaN)).toBe(0.05);
    expect(clampCadZoom(999, 0.08, 12)).toBe(12);
  });

  it('resolves explicit light/dark canvas colors', () => {
    expect(resolveCadCanvasTheme('dark').background).toBe('#0f172a');
    expect(resolveCadCanvasTheme('light').background).toBe('#f1f5f9');
    expect(resolveCadCanvasTheme({ background: '#abc' }).background).toBe('#abc');
  });

  it('renders empty entities without crashing and respects passed background', () => {
    const empty = mockCanvas();
    expect(() =>
      renderCadDrawing(empty.canvas, [], null, { scale: 1, offsetX: 0, offsetY: 0 }, undefined, 'light')
    ).not.toThrow();
    const themed = mockCanvas();
    renderCadDrawing(themed.canvas, [line('a', 0, 0, 4, 0)], 'a', fitCadView([line('a', 0, 0, 4, 0)], 120, 80), undefined, {
      background: '#112233',
      muted: '#8899aa',
      text: '#fff',
      hint: '#ccc',
      selection: '#ff0'
    });
    expect(themed.fillStyles[0]).toBe('#112233');
  });

  it('builds insight stats from parsed layers/entities', () => {
    const stats = buildCadInsightStats(
      { layers: [{ id: '1' }, { id: '2' }], entities: [{ id: 'e' }], units: 'mm' },
      1,
      2048,
      ['note'],
      (n) => `${n}B`
    );
    expect(stats.files).toBe(1);
    expect(stats.groupLabel).toBe('Layers');
    expect(stats.groupCount).toBe(2);
    expect(stats.itemLabel).toBe('Entities');
    expect(stats.itemCount).toBe(1);
    expect(stats.sizeLabel).toBe('Size');
    expect(stats.sizeValue).toBe('2048B');
    expect(stats.warningCount).toBe(1);
  });
});
