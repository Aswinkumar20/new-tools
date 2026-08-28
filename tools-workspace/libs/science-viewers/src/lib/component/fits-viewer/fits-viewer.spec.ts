import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { By } from '@angular/platform-browser';
import { AssetService, Navigation, ToastService } from '@tools-workspace/features-home';
import { FITS_SAMPLE_BASE64 } from '../../constants/fits-sample.data';
import { FitsViewerComponent } from './fits-viewer';
import { createFitsFileRecord, createSampleFitsFile } from '../../utils/fits-viewer.utils';
import { base64ToUint8Array } from '../../utils/science-file.utils';

@Component({ selector: 'lib-navigation', standalone: true, template: '' })
class StubNavigationComponent {}

describe('FitsViewerComponent', () => {
  let component: FitsViewerComponent;
  let fixture: ComponentFixture<FitsViewerComponent>;
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
    Object.defineProperty(ctx, 'imageSmoothingEnabled', { set: jest.fn(), get: () => true });
    jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
    jest.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,xx');

    await TestBed.configureTestingModule({
      imports: [FitsViewerComponent],
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
      .overrideComponent(FitsViewerComponent, {
        remove: { imports: [Navigation] },
        add: { imports: [StubNavigationComponent] }
      })
      .compileComponents();

    fixture = TestBed.createComponent(FitsViewerComponent);
    component = fixture.componentInstance;
    toast = TestBed.inject(ToastService) as unknown as typeof toast;
    fixture.detectChanges();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function sampleBytes(): Uint8Array {
    return base64ToUint8Array(FITS_SAMPLE_BASE64);
  }

  function loadSampleRecord(): void {
    const file = createSampleFitsFile();
    const record = createFitsFileRecord(file, sampleBytes());
    component.files = [record];
    component.currentIndex = 0;
    component['syncFromCurrent']();
    fixture.detectChanges();
  }

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows upload suggestion when empty', () => {
    expect(component.primarySuggestion?.id).toBe('upload-fits');
  });

  it('loads sample via handleFiles and enables export', async () => {
    await component.loadSample();
    expect(component.files).toHaveLength(1);
    expect(component.currentFile?.name).toBe('sample-starfield.fits');
    expect(component.canExport).toBe(true);
    expect(component.preview?.shape).toEqual([8, 8]);
    expect(toast.success).toHaveBeenCalled();
  });

  it('rejects unsupported files with toast and leaves state empty', async () => {
    await component.handleFiles([new File(['x'], 'image.png', { lastModified: 1 })]);
    expect(component.files).toHaveLength(0);
    expect(toast.error).toHaveBeenCalled();
  });

  it('filters header cards by query', () => {
    loadSampleRecord();
    component.headerQuery = 'CTYPE';
    expect(component.filteredHeaderCards.every((c) => /ctype/i.test(c.keyword + c.value + c.comment))).toBe(true);
  });

  it('changes colormap, invert, and zoom', () => {
    loadSampleRecord();
    component.setColormap('viridis');
    expect(component.colormap).toBe('viridis');
    component.setColormap('viridis');
    expect(component.colormap).toBe('viridis');
    expect(component.invert).toBe(false);
    component.toggleInvert();
    expect(component.invert).toBe(true);
    const before = component.zoom;
    component.zoomIn();
    expect(component.zoom).toBeGreaterThan(before);
    component.resetZoom();
    expect(component.zoom).toBe(1);
  });

  it('switches view modes and toggles sidebar', () => {
    loadSampleRecord();
    component.setViewMode('header');
    expect(component.viewMode).toBe('header');
    component.setViewMode('header');
    expect(component.viewMode).toBe('header');
    component.setViewMode('wcs');
    expect(component.viewMode).toBe('wcs');
    expect(component.wcsInfo).toBeTruthy();
    const before = component.sidebarCollapsed;
    component.toggleSidebar();
    expect(component.sidebarCollapsed).toBe(!before);
  });

  it('selectHdu is a no-op when unchanged', () => {
    loadSampleRecord();
    const idx = component.selectedHduIndex;
    component.selectHdu(idx);
    expect(component.selectedHduIndex).toBe(idx);
  });

  it('dismisses suggestion and restores after clearAll', async () => {
    const suggestion = component.primarySuggestion;
    expect(suggestion).toBeTruthy();
    component.dismissSuggestion(suggestion!.id);
    expect(component.primarySuggestion).toBeNull();

    await component.loadSample();
    component.clearAll();
    expect(component.files).toHaveLength(0);
    expect(component.primarySuggestion?.id).toBe('upload-fits');
    expect(component.showExportMenu).toBe(false);
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
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: jest.fn() });
    const click = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    component.exportAs('summary-json', event);
    expect(toast.success).toHaveBeenCalledWith('Export started');
    expect(createObjectURL).toHaveBeenCalled();
    click.mockRestore();
  });

  it('blocks png export outside preview view', async () => {
    await component.loadSample();
    component.setViewMode('header');
    fixture.detectChanges();
    const event = { stopPropagation: jest.fn() } as unknown as Event;
    component.exportAs('png', event);
    expect(toast.info).toHaveBeenCalledWith('Open Preview view to export a PNG snapshot');
  });

  it('removeFile clears when last file removed and updates index otherwise', async () => {
    await component.loadSample();
    const second = createFitsFileRecord(new File([sampleBytes()], 'second.fits', { lastModified: 2 }), sampleBytes());
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
    component.errorMessage = 'bad.fits: Invalid FITS';
    expect(component.primarySuggestion?.id).toBe('try-sample');
  });

  it('soft-fail unparseable dump disables export', async () => {
    const file = new File([new Uint8Array([1, 2, 3, 4])], 'bad.fits', { lastModified: 9 });
    await component.handleFiles([file]);
    expect(component.files).toHaveLength(1);
    expect(component.currentFile?.softFail).toBe(true);
    expect(component.canExport).toBe(false);
    expect(toast.warning).toHaveBeenCalled();
  });

  it('keeps scroll-owner structure for map wrap, header, and sidebar', async () => {
    await component.loadSample();
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('.fits-map-wrap')).toBeTruthy();
    expect(root.querySelector('.fits-workspace')).toBeTruthy();
    expect(root.querySelector('.fits-sidebar')).toBeTruthy();
    component.setViewMode('header');
    fixture.detectChanges();
    expect(root.querySelector('.fits-header-view')).toBeTruthy();
  });

  it('collapses sidebar via toggle and keeps toolbar present', () => {
    loadSampleRecord();
    expect(fixture.debugElement.query(By.css('.fits-toolbar'))).toBeTruthy();
    component.toggleSidebar();
    fixture.detectChanges();
    expect(component.sidebarCollapsed).toBe(true);
    expect((fixture.nativeElement as HTMLElement).querySelector('.fits-workspace--sidebar-collapsed')).toBeTruthy();
    expect((fixture.nativeElement as HTMLElement).querySelector('.fits-sidebar')).toBeFalsy();
  });

  it('closes export menu on Escape', async () => {
    await component.loadSample();
    component.showExportMenu = true;
    component.onKeydown(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(component.showExportMenu).toBe(false);
  });

  it('metadata and histogram derive from loaded sample', () => {
    loadSampleRecord();
    expect(component.metadataRows.length).toBeGreaterThan(0);
    expect(component.histogramBars.length).toBeGreaterThan(0);
  });
});
