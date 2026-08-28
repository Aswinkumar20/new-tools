import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { By } from '@angular/platform-browser';
import { AssetService, Navigation, ToastService } from '@tools-workspace/features-home';
import { GRIB_SAMPLE_BASE64 } from '../../constants/grib-sample.data';
import { GribViewerComponent } from './grib-viewer';
import { createGribFileRecord, createSampleGribFile } from '../../utils/grib-viewer.utils';
import { base64ToUint8Array } from '../../utils/science-file.utils';

@Component({ selector: 'lib-navigation', standalone: true, template: '' })
class StubNavigationComponent {}

describe('GribViewerComponent', () => {
  let component: GribViewerComponent;
  let fixture: ComponentFixture<GribViewerComponent>;
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
      imports: [GribViewerComponent],
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
      .overrideComponent(GribViewerComponent, {
        remove: { imports: [Navigation] },
        add: { imports: [StubNavigationComponent] }
      })
      .compileComponents();

    fixture = TestBed.createComponent(GribViewerComponent);
    component = fixture.componentInstance;
    toast = TestBed.inject(ToastService) as unknown as typeof toast;
    fixture.detectChanges();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function sampleBytes(): Uint8Array {
    return base64ToUint8Array(GRIB_SAMPLE_BASE64);
  }

  function loadSampleRecord(): void {
    const file = createSampleGribFile();
    const record = createGribFileRecord(file, sampleBytes());
    component.files = [record];
    component.currentIndex = 0;
    component['syncFromCurrent']();
    fixture.detectChanges();
  }

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows upload suggestion when empty', () => {
    expect(component.primarySuggestion?.id).toBe('upload-grib');
  });

  it('loads sample via handleFiles and enables export', async () => {
    await component.loadSample();
    expect(component.files).toHaveLength(1);
    expect(component.currentFile?.name).toBe('sample-weather.grib2');
    expect(component.canExport).toBe(true);
    expect(component.parsed?.messages.length).toBeGreaterThan(0);
    expect(component.field).toBeTruthy();
    expect(toast.success).toHaveBeenCalled();
  });

  it('rejects unsupported files with toast and leaves state empty', async () => {
    await component.handleFiles([new File(['x'], 'weather.nc', { lastModified: 1 })]);
    expect(component.files).toHaveLength(0);
    expect(toast.error).toHaveBeenCalled();
  });

  it('selects messages and toggles colormap / invert', () => {
    loadSampleRecord();
    const messages = component.parsed!.messages;
    expect(messages.length).toBeGreaterThan(0);
    component.selectMessage(messages[0].index);
    expect(component.selectedMessageIndex).toBe(messages[0].index);
    component.setColormap('hot');
    expect(component.colormap).toBe('hot');
    component.setColormap('hot');
    expect(component.colormap).toBe('hot');
    const before = component.invert;
    component.toggleInvert();
    expect(component.invert).toBe(!before);
  });

  it('zooms in/out, fit, and reset', () => {
    loadSampleRecord();
    const start = component.zoom;
    component.zoomIn();
    expect(component.zoom).toBeGreaterThan(start);
    component.zoomOut();
    component.resetZoom();
    expect(component.zoom).toBe(1);
    component.fitZoom();
    expect(component.zoom).toBeGreaterThan(0);
  });

  it('toggles sidebar', () => {
    loadSampleRecord();
    const before = component.sidebarCollapsed;
    component.toggleSidebar();
    expect(component.sidebarCollapsed).toBe(!before);
  });

  it('dismisses suggestion and restores after clearAll', async () => {
    const suggestion = component.primarySuggestion;
    expect(suggestion).toBeTruthy();
    component.dismissSuggestion(suggestion!.id);
    expect(component.primarySuggestion).toBeNull();

    await component.loadSample();
    component.clearAll();
    expect(component.files).toHaveLength(0);
    expect(component.primarySuggestion?.id).toBe('upload-grib');
    expect(component.colormap).toBe('viridis');
    expect(component.invert).toBe(false);
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

  it('Escape closes export menu', async () => {
    await component.loadSample();
    component.showExportMenu = true;
    component.onKeydown(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(component.showExportMenu).toBe(false);
  });

  it('removeFile clears when last file removed and updates index otherwise', async () => {
    await component.loadSample();
    const second = createGribFileRecord(new File([sampleBytes()], 'second.grib2', { lastModified: 2 }), sampleBytes());
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
    component.errorMessage = 'bad.grib2: Invalid GRIB';
    expect(component.primarySuggestion?.id).toBe('try-sample');
  });

  it('soft-fail unparseable dump disables export', async () => {
    const file = new File([new Uint8Array([1, 2, 3, 4])], 'bad.grib2', { lastModified: 9 });
    await component.handleFiles([file]);
    expect(component.files).toHaveLength(1);
    expect(component.currentFile?.softFail).toBe(true);
    expect(component.canExport).toBe(false);
    expect(toast.warning).toHaveBeenCalled();
  });

  it('keeps scroll-owner structure for map wrap and sidebar', async () => {
    await component.loadSample();
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('.grib-map-wrap')).toBeTruthy();
    expect(root.querySelector('.grib-workspace')).toBeTruthy();
    expect(root.querySelector('.grib-sidebar')).toBeTruthy();
    expect(root.querySelector('.grib-footer-help')).toBeTruthy();
    expect(component.metadataRows.length).toBeGreaterThan(0);
    expect(component.histogramBars.length).toBeGreaterThan(0);
  });

  it('collapses sidebar via toggle and keeps toolbar present', () => {
    loadSampleRecord();
    expect(fixture.debugElement.query(By.css('.grib-toolbar'))).toBeTruthy();
    component.toggleSidebar();
    fixture.detectChanges();
    expect(component.sidebarCollapsed).toBe(true);
    expect((fixture.nativeElement as HTMLElement).querySelector('.grib-workspace--sidebar-collapsed')).toBeTruthy();
    expect((fixture.nativeElement as HTMLElement).querySelector('.grib-sidebar')).toBeFalsy();
  });

  it('exposes related tools links in the DOM', () => {
    loadSampleRecord();
    const links = (fixture.nativeElement as HTMLElement).querySelectorAll('.grib-related');
    expect(links.length).toBe(component.relatedTools.length);
  });
});
