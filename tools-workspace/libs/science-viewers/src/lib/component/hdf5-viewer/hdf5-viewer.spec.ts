import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { By } from '@angular/platform-browser';
import { AssetService, Navigation, ToastService } from '@tools-workspace/features-home';
import { HDF5_SAMPLE_BASE64 } from '../../constants/hdf5-sample.data';
import { Hdf5ViewerComponent } from './hdf5-viewer';
import { createHdf5FileRecord, createSampleHdf5File } from '../../utils/hdf5-viewer.utils';
import { base64ToUint8Array } from '../../utils/science-file.utils';

@Component({ selector: 'lib-navigation', standalone: true, template: '' })
class StubNavigationComponent {}

describe('Hdf5ViewerComponent', () => {
  let component: Hdf5ViewerComponent;
  let fixture: ComponentFixture<Hdf5ViewerComponent>;
  let toast: { info: jest.Mock; error: jest.Mock; success: jest.Mock; warning: jest.Mock };

  beforeEach(async () => {
    if (typeof (globalThis as { ImageData?: unknown }).ImageData === 'undefined') {
      (globalThis as { ImageData: unknown }).ImageData = class {
        data: Uint8ClampedArray;
        width: number;
        height: number;
        constructor(dataOrW: Uint8ClampedArray | number, wOrH: number, h?: number) {
          if (typeof dataOrW === 'number') {
            this.width = dataOrW;
            this.height = wOrH;
            this.data = new Uint8ClampedArray(this.width * this.height * 4);
          } else {
            this.data = dataOrW;
            this.width = wOrH;
            this.height = h ?? 0;
          }
        }
      };
    }

    const ctx = {
      fillRect: jest.fn(),
      clearRect: jest.fn(),
      beginPath: jest.fn(),
      moveTo: jest.fn(),
      lineTo: jest.fn(),
      closePath: jest.fn(),
      stroke: jest.fn(),
      fill: jest.fn(),
      arc: jest.fn(),
      fillText: jest.fn(),
      strokeRect: jest.fn(),
      save: jest.fn(),
      restore: jest.fn(),
      translate: jest.fn(),
      scale: jest.fn(),
      setLineDash: jest.fn(),
      drawImage: jest.fn(),
      putImageData: jest.fn(),
      measureText: jest.fn(() => ({ width: 0 })),
      createLinearGradient: jest.fn(() => ({ addColorStop: jest.fn() })),
      createImageData: jest.fn((w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }))
    };
    Object.defineProperty(ctx, 'fillStyle', { set: jest.fn(), get: () => '#000' });
    Object.defineProperty(ctx, 'strokeStyle', { set: jest.fn(), get: () => '#000' });
    Object.defineProperty(ctx, 'lineWidth', { set: jest.fn(), get: () => 1 });
    Object.defineProperty(ctx, 'imageSmoothingEnabled', { set: jest.fn(), get: () => true });
    jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
    jest.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,xx');

    await TestBed.configureTestingModule({
      imports: [Hdf5ViewerComponent],
      providers: [
        provideRouter([]),
        { provide: AssetService, useValue: { getAssetPath: (p: string) => p } },
        {
          provide: ToastService,
          useValue: {
            info: jest.fn(),
            error: jest.fn(),
            success: jest.fn(),
            warning: jest.fn()
          }
        }
      ]
    })
      .overrideComponent(Hdf5ViewerComponent, {
        remove: { imports: [Navigation] },
        add: { imports: [StubNavigationComponent] }
      })
      .compileComponents();

    fixture = TestBed.createComponent(Hdf5ViewerComponent);
    component = fixture.componentInstance;
    toast = TestBed.inject(ToastService) as unknown as typeof toast;
    fixture.detectChanges();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function sampleBytes(): Uint8Array {
    return base64ToUint8Array(HDF5_SAMPLE_BASE64);
  }

  function loadSampleRecord(): void {
    const file = createSampleHdf5File();
    const record = createHdf5FileRecord(file, sampleBytes());
    component.files = [record];
    component.currentIndex = 0;
    component['syncFromCurrent']();
    fixture.detectChanges();
  }

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows upload suggestion when empty', () => {
    expect(component.primarySuggestion?.id).toBe('upload-h5');
  });

  it('loads sample via handleFiles and enables export', async () => {
    await component.loadSample();
    expect(component.files).toHaveLength(1);
    expect(component.currentFile?.name).toBe('sample-science.h5');
    expect(component.canExport).toBe(true);
    expect(component.parsed?.datasets.length).toBeGreaterThan(0);
    expect(component.preview).toBeTruthy();
    expect(toast.success).toHaveBeenCalled();
  });

  it('rejects unsupported files with toast and leaves state empty', async () => {
    await component.handleFiles([new File(['x'], 'data.nc', { lastModified: 1 })]);
    expect(component.files).toHaveLength(0);
    expect(toast.error).toHaveBeenCalled();
  });

  it('switches view modes and selects datasets', () => {
    loadSampleRecord();
    component.setViewMode('tree');
    expect(component.viewMode).toBe('tree');
    expect(component.flatTree.length).toBeGreaterThan(0);
    const ds = component.parsed!.datasets[0];
    component.selectNode({ path: ds.path, name: ds.path, kind: 'dataset', shape: ds.shape, dtype: ds.dtype });
    expect(component.selectedPath).toBe(ds.path);
    expect(component.viewMode).toBe('preview');
    component.setViewMode('attributes');
    expect(component.viewMode).toBe('attributes');
  });

  it('filters tree nodes', () => {
    loadSampleRecord();
    component.setViewMode('tree');
    component.treeQuery = '__none__';
    expect(component.flatTree).toHaveLength(0);
    component.treeQuery = 'temperature';
    expect(component.flatTree.some((n) => n.path.includes('temperature'))).toBe(true);
  });

  it('toggles colormap / invert and zooms', () => {
    loadSampleRecord();
    component.setColormap('viridis');
    expect(component.colormap).toBe('viridis');
    const before = component.invert;
    component.toggleInvert();
    expect(component.invert).toBe(!before);
    component.zoomIn();
    expect(component.zoom).toBeGreaterThan(1);
    component.resetZoom();
    expect(component.zoom).toBe(1);
  });

  it('setViewMode is a no-op when mode unchanged', () => {
    loadSampleRecord();
    component.viewMode = 'preview';
    component.setViewMode('preview');
    expect(component.viewMode).toBe('preview');
  });

  it('dismisses suggestion and restores after clearAll', async () => {
    const suggestion = component.primarySuggestion;
    expect(suggestion).toBeTruthy();
    component.dismissSuggestion(suggestion!.id);
    expect(component.primarySuggestion).toBeNull();

    await component.loadSample();
    component.clearAll();
    expect(component.files).toHaveLength(0);
    expect(component.primarySuggestion?.id).toBe('upload-h5');
    expect(component.viewMode).toBe('preview');
    expect(component.colormap).toBe('hot');
  });

  it('applySuggestion routes sample and upload actions', () => {
    const loadSpy = jest.spyOn(component, 'loadSample').mockResolvedValue(undefined);
    const openSpy = jest.spyOn(component, 'openFilePicker').mockImplementation(() => undefined);
    component.applySuggestion({ action: 'sample' });
    expect(loadSpy).toHaveBeenCalled();
    component.applySuggestion({ action: 'upload' });
    expect(openSpy).toHaveBeenCalled();
  });

  it('guards export when nothing loaded and closes export menu', () => {
    const event = { stopPropagation: jest.fn() } as unknown as Event;
    expect(component.canExport).toBe(false);
    component.toggleExportMenu(event);
    expect(component.showExportMenu).toBe(false);
    component.exportAs('summary-json', event);
    expect(toast.info).toHaveBeenCalledWith('Nothing to export');
  });

  it('exports summary json when a valid file is loaded', async () => {
    await component.loadSample();
    const event = { stopPropagation: jest.fn() } as unknown as Event;
    const createObjectURL = jest.fn(() => 'blob:mock');
    const revokeObjectURL = jest.fn();
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectURL });
    const click = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    component.exportAs('summary-json', event);
    expect(toast.success).toHaveBeenCalledWith('Export started');
    expect(createObjectURL).toHaveBeenCalled();
    click.mockRestore();
  });

  it('blocks png export outside preview', async () => {
    await component.loadSample();
    component.setViewMode('tree');
    fixture.detectChanges();
    const event = { stopPropagation: jest.fn() } as unknown as Event;
    component.exportAs('png', event);
    expect(toast.info).toHaveBeenCalledWith('Open Preview to export a PNG snapshot');
  });

  it('Escape closes export menu', async () => {
    await component.loadSample();
    component.showExportMenu = true;
    component.onKeydown(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(component.showExportMenu).toBe(false);
  });

  it('removeFile clears when last file removed and updates index otherwise', async () => {
    await component.loadSample();
    const second = createHdf5FileRecord(new File([sampleBytes()], 'second.h5', { lastModified: 2 }), sampleBytes());
    component.files = [...component.files, second];
    component.currentIndex = 1;
    const event = { stopPropagation: jest.fn() } as unknown as Event;
    component.removeFile(1, event);
    expect(component.files).toHaveLength(1);
    expect(component.currentIndex).toBe(0);

    component.removeFile(0, event);
    expect(component.files).toHaveLength(0);
    expect(component.currentIndex).toBe(-1);
  });

  it('shows sample suggestion after a hard load failure message', () => {
    component.errorMessage = 'bad.h5: Invalid HDF5';
    expect(component.primarySuggestion?.id).toBe('try-sample');
  });

  it('soft-fail unparseable dump disables export', async () => {
    const file = new File([new Uint8Array([1, 2, 3, 4])], 'bad.h5', { lastModified: 9 });
    await component.handleFiles([file]);
    expect(component.files).toHaveLength(1);
    expect(component.currentFile?.softFail).toBe(true);
    expect(component.canExport).toBe(false);
    expect(toast.warning).toHaveBeenCalled();
  });

  it('keeps scroll-owner structure for map wrap, tree, and sidebar', async () => {
    await component.loadSample();
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('.hdf5-map-wrap')).toBeTruthy();
    expect(root.querySelector('.hdf5-workspace')).toBeTruthy();
    expect(root.querySelector('.hdf5-sidebar')).toBeTruthy();
    expect(root.querySelector('.hdf5-footer-help')).toBeTruthy();
    component.setViewMode('tree');
    fixture.detectChanges();
    expect(root.querySelector('.hdf5-tree-view')).toBeTruthy();
  });

  it('collapses sidebar via toggle and keeps toolbar present', () => {
    loadSampleRecord();
    expect(fixture.debugElement.query(By.css('.hdf5-toolbar'))).toBeTruthy();
    component.toggleSidebar();
    fixture.detectChanges();
    expect(component.sidebarCollapsed).toBe(true);
    expect((fixture.nativeElement as HTMLElement).querySelector('.hdf5-workspace--sidebar-collapsed')).toBeTruthy();
    expect((fixture.nativeElement as HTMLElement).querySelector('.hdf5-sidebar')).toBeFalsy();
  });

  it('exposes related tools links in the DOM', () => {
    loadSampleRecord();
    const links = (fixture.nativeElement as HTMLElement).querySelectorAll('.hdf5-related');
    expect(links.length).toBe(component.relatedTools.length);
  });
});
