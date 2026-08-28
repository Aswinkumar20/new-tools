import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { By } from '@angular/platform-browser';
import { AssetService, Navigation, ToastService } from '@tools-workspace/features-home';
import { CLIMATE_JSON_SAMPLE } from '../../constants/climate-sample.data';
import { ClimateDataViewerComponent } from './climate-data-viewer';
import { createClimateFileRecord, createSampleClimateFile } from '../../utils/climate-data-viewer.utils';

@Component({ selector: 'lib-navigation', standalone: true, template: '' })
class StubNavigationComponent {}

describe('ClimateDataViewerComponent', () => {
  let component: ClimateDataViewerComponent;
  let fixture: ComponentFixture<ClimateDataViewerComponent>;
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
      ellipse: jest.fn(),
      fillText: jest.fn(),
      strokeRect: jest.fn(),
      save: jest.fn(),
      restore: jest.fn(),
      translate: jest.fn(),
      scale: jest.fn(),
      setLineDash: jest.fn(),
      drawImage: jest.fn(),
      measureText: jest.fn(() => ({ width: 0 })),
      createLinearGradient: jest.fn(() => ({ addColorStop: jest.fn() })),
      createImageData: jest.fn((w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h })),
      putImageData: jest.fn()
    };
    jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
    jest.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,xx');

    await TestBed.configureTestingModule({
      imports: [ClimateDataViewerComponent],
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
      .overrideComponent(ClimateDataViewerComponent, {
        remove: { imports: [Navigation] },
        add: { imports: [StubNavigationComponent] }
      })
      .compileComponents();

    fixture = TestBed.createComponent(ClimateDataViewerComponent);
    component = fixture.componentInstance;
    toast = TestBed.inject(ToastService) as unknown as typeof toast;
    fixture.detectChanges();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function sampleBytes(): Uint8Array {
    return new TextEncoder().encode(CLIMATE_JSON_SAMPLE);
  }

  function loadSampleRecord(): void {
    const file = createSampleClimateFile();
    const record = createClimateFileRecord(file, sampleBytes());
    component.files = [record];
    component.currentIndex = 0;
    component['resetViewForCurrent']();
    fixture.detectChanges();
  }

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows upload suggestion when empty', () => {
    expect(component.primarySuggestion?.id).toBe('upload-or-sample');
  });

  it('loads sample via handleFiles and enables export', async () => {
    await component.loadSample();
    expect(component.files).toHaveLength(1);
    expect(component.currentFile?.name).toBe('sample-ethiopia-tas.json');
    expect(component.canExport).toBe(true);
    expect(component.parsed?.nx).toBe(8);
    expect(component.parsed?.stations.length).toBe(3);
    expect(toast.success).toHaveBeenCalled();
  });

  it('rejects unsupported files with toast and leaves state empty', async () => {
    await component.handleFiles([new File(['x'], 'field.sgy', { lastModified: 1 })]);
    expect(component.files).toHaveLength(0);
    expect(toast.error).toHaveBeenCalled();
  });

  it('filters stations and repairs selection when filter removes current item', () => {
    loadSampleRecord();
    component.selectedStationId = component.parsed!.stations[1].id;
    component.query = '__none__';
    component.onFilterChange();
    expect(component.filteredStations).toHaveLength(0);
    expect(component.selectedStationId).toBe('');
  });

  it('selects station, steps time, and changes colormap', () => {
    loadSampleRecord();
    const target = component.parsed!.stations[2];
    component.selectStation(target.id);
    expect(component.selectedStationId).toBe(target.id);
    expect(component.selectedStation?.id).toBe(target.id);
    component.stepTime(1);
    expect(component.timeIndex).toBe(1);
    component.setColormap('hot');
    expect(component.colormap).toBe('hot');
    component.setColormap('hot');
    expect(component.colormap).toBe('hot');
  });

  it('zooms map and fits without no-op thrash', () => {
    loadSampleRecord();
    const before = component.zoom;
    component.zoomIn();
    expect(component.zoom).toBeGreaterThan(before);
    component.fitZoom();
    expect(component.zoom).toBe(1);
    component.fitZoom();
    expect(component.zoom).toBe(1);
  });

  it('toggles invert and switches view modes', () => {
    loadSampleRecord();
    expect(component.invert).toBe(false);
    component.toggleInvert();
    expect(component.invert).toBe(true);
    component.setViewMode('stations');
    expect(component.viewMode).toBe('stations');
    component.setViewMode('stations');
    expect(component.viewMode).toBe('stations');
    component.setViewMode('table');
    expect(component.viewMode).toBe('table');
    expect(component.tableRows.length).toBeGreaterThan(0);
  });

  it('dismisses suggestion and restores after clearAll', async () => {
    const suggestion = component.primarySuggestion;
    expect(suggestion).toBeTruthy();
    component.dismissSuggestion(suggestion!.id);
    expect(component.primarySuggestion).toBeNull();

    await component.loadSample();
    component.clearAll();
    expect(component.files).toHaveLength(0);
    expect(component.primarySuggestion?.id).toBe('upload-or-sample');
    expect(component.showExportMenu).toBe(false);
    expect(component.colormap).toBe('viridis');
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

  it('blocks png export outside canvas views', async () => {
    await component.loadSample();
    component.setViewMode('table');
    fixture.detectChanges();
    const event = { stopPropagation: jest.fn() } as unknown as Event;
    component.exportAs('png', event);
    expect(toast.info).toHaveBeenCalledWith('Open Map or Time series to export a PNG snapshot');
  });

  it('removeFile clears when last file removed and updates index otherwise', async () => {
    await component.loadSample();
    const second = createClimateFileRecord(new File([sampleBytes()], 'second.json', { lastModified: 2 }), sampleBytes());
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
    component.errorMessage = 'bad.json: Invalid climate data';
    expect(component.primarySuggestion?.id).toBe('sample-after-error');
  });

  it('soft-fail unparseable dump disables export', async () => {
    const file = new File(['hello world'], 'bad.json', { lastModified: 9 });
    await component.handleFiles([file]);
    expect(component.files).toHaveLength(1);
    expect(component.currentFile?.softFail).toBe(true);
    expect(component.canExport).toBe(false);
    expect(toast.warning).toHaveBeenCalled();
  });

  it('keeps scroll-owner structure for map wrap, table, and sidebar', async () => {
    await component.loadSample();
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('.climate-map-wrap')).toBeTruthy();
    expect(root.querySelector('.climate-workspace')).toBeTruthy();
    expect(root.querySelector('.climate-sidebar')).toBeTruthy();
    component.setViewMode('table');
    fixture.detectChanges();
    expect(root.querySelector('.climate-table')).toBeTruthy();
  });

  it('collapses sidebar via toggle and keeps toolbar present', () => {
    loadSampleRecord();
    expect(fixture.debugElement.query(By.css('.climate-toolbar'))).toBeTruthy();
    component.toggleSidebar();
    fixture.detectChanges();
    expect(component.sidebarCollapsed).toBe(true);
    expect((fixture.nativeElement as HTMLElement).querySelector('.climate-workspace--sidebar-collapsed')).toBeTruthy();
    expect((fixture.nativeElement as HTMLElement).querySelector('.climate-sidebar')).toBeFalsy();
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
    expect(component.nt).toBe(24);
  });
});
