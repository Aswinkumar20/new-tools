import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { By } from '@angular/platform-browser';
import { AssetService, Navigation, ToastService } from '@tools-workspace/features-home';
import { GEO_MODEL_SAMPLE } from '../../constants/geological-model-sample.data';
import { GeologicalModelViewerComponent } from './geological-model-viewer';
import { createGeoModelFileRecord, createSampleGeoModelFile } from '../../utils/geological-model-viewer.utils';

@Component({ selector: 'lib-navigation', standalone: true, template: '' })
class StubNavigationComponent {}

describe('GeologicalModelViewerComponent', () => {
  let component: GeologicalModelViewerComponent;
  let fixture: ComponentFixture<GeologicalModelViewerComponent>;
  let toast: { info: jest.Mock; error: jest.Mock; success: jest.Mock; warning: jest.Mock };

  beforeEach(async () => {
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
      measureText: jest.fn(() => ({ width: 0 })),
      createLinearGradient: jest.fn(() => ({ addColorStop: jest.fn() }))
    };
    Object.defineProperty(ctx, 'fillStyle', { set: jest.fn(), get: () => '#000' });
    Object.defineProperty(ctx, 'strokeStyle', { set: jest.fn(), get: () => '#000' });
    Object.defineProperty(ctx, 'font', { set: jest.fn(), get: () => '10px sans-serif' });
    Object.defineProperty(ctx, 'textAlign', { set: jest.fn(), get: () => 'left' });
    Object.defineProperty(ctx, 'lineWidth', { set: jest.fn(), get: () => 1 });
    jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
    jest.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,xx');

    await TestBed.configureTestingModule({
      imports: [GeologicalModelViewerComponent],
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
      .overrideComponent(GeologicalModelViewerComponent, {
        remove: { imports: [Navigation] },
        add: { imports: [StubNavigationComponent] }
      })
      .compileComponents();

    fixture = TestBed.createComponent(GeologicalModelViewerComponent);
    component = fixture.componentInstance;
    toast = TestBed.inject(ToastService) as unknown as typeof toast;
    fixture.detectChanges();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function sampleBytes(): Uint8Array {
    return new TextEncoder().encode(GEO_MODEL_SAMPLE);
  }

  function loadSampleRecord(): void {
    const file = createSampleGeoModelFile();
    const record = createGeoModelFileRecord(file, sampleBytes());
    component.files = [record];
    component.currentIndex = 0;
    component['resetViewForCurrent']();
    fixture.detectChanges();
  }

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows upload suggestion when empty', () => {
    expect(component.primarySuggestion?.id).toBe('upload-model');
  });

  it('loads sample via handleFiles and enables export', async () => {
    await component.loadSample();
    expect(component.files).toHaveLength(1);
    expect(component.currentFile?.name).toBe('sample-basin.json');
    expect(component.canExport).toBe(true);
    expect(component.parsed?.layers.length).toBe(6);
    expect(component.parsed?.wells.length).toBe(3);
    expect(component.parsed?.faults.length).toBe(2);
    expect(toast.success).toHaveBeenCalled();
  });

  it('rejects unsupported files with toast and leaves state empty', async () => {
    await component.handleFiles([new File(['x'], 'basin.sgy', { lastModified: 1 })]);
    expect(component.files).toHaveLength(0);
    expect(toast.error).toHaveBeenCalled();
  });

  it('filters layers and repairs selection when filter removes current item', () => {
    loadSampleRecord();
    const firstId = component.selectedLayerId;
    expect(firstId).toBeTruthy();
    component.query = '__none__';
    component.onFilterChange();
    expect(component.filteredLayers).toHaveLength(0);
    expect(component.selectedLayerId).toBe('');
  });

  it('selects layers and wells without no-op churn', () => {
    loadSampleRecord();
    const layerId = component.filteredLayers[1]?.id;
    const wellId = component.wells[1]?.id;
    expect(layerId).toBeTruthy();
    expect(wellId).toBeTruthy();
    component.selectLayer(layerId!);
    expect(component.selectedLayerId).toBe(layerId);
    component.selectLayer(layerId!);
    expect(component.selectedLayerId).toBe(layerId);
    component.selectWell(wellId!);
    expect(component.selectedWellId).toBe(wellId);
  });

  it('toggles layer visibility but keeps at least one visible', () => {
    loadSampleRecord();
    const ids = [...component.visibleIds];
    expect(ids.length).toBeGreaterThan(1);
    component.toggleLayer(ids[0]);
    expect(component.visibleIds.has(ids[0])).toBe(false);
    component.visibleIds = new Set([ids[1]]);
    component.toggleLayer(ids[1]);
    expect(component.visibleIds.has(ids[1])).toBe(true);
  });

  it('clamps exaggeration and fit resets to 1', () => {
    loadSampleRecord();
    component.setExaggeration(99);
    expect(component.exaggeration).toBe(8);
    component.setExaggeration(0.01);
    expect(component.exaggeration).toBe(0.25);
    component.setExaggeration(2);
    component.fitExaggeration();
    expect(component.exaggeration).toBe(1);
  });

  it('switches view modes and toggles sidebar', () => {
    loadSampleRecord();
    component.setViewMode('table');
    expect(component.viewMode).toBe('table');
    component.setViewMode('section');
    expect(component.viewMode).toBe('section');
    const before = component.sidebarCollapsed;
    component.toggleSidebar();
    expect(component.sidebarCollapsed).toBe(!before);
  });

  it('setViewMode is a no-op when mode unchanged', () => {
    loadSampleRecord();
    component.viewMode = 'map';
    component.setViewMode('map');
    expect(component.viewMode).toBe('map');
  });

  it('dismisses suggestion and restores after clearAll', async () => {
    const suggestion = component.primarySuggestion;
    expect(suggestion).toBeTruthy();
    component.dismissSuggestion(suggestion!.id);
    expect(component.primarySuggestion).toBeNull();

    await component.loadSample();
    component.clearAll();
    expect(component.files).toHaveLength(0);
    expect(component.primarySuggestion?.id).toBe('upload-model');
    expect(component.viewMode).toBe('map');
    expect(component.exaggeration).toBe(1);
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
    expect(toast.info).toHaveBeenCalledWith('Open Map or Section to export a PNG snapshot');
  });

  it('Escape closes export menu', async () => {
    await component.loadSample();
    component.showExportMenu = true;
    component.onKeydown(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(component.showExportMenu).toBe(false);
  });

  it('removeFile clears when last file removed and updates index otherwise', async () => {
    await component.loadSample();
    const second = createGeoModelFileRecord(new File([sampleBytes()], 'second.json', { lastModified: 2 }), sampleBytes());
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
    component.errorMessage = 'bad.json: Invalid geological model';
    expect(component.primarySuggestion?.id).toBe('try-sample');
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
    expect(root.querySelector('.geom-map-wrap')).toBeTruthy();
    expect(root.querySelector('.geom-workspace')).toBeTruthy();
    expect(root.querySelector('.geom-sidebar')).toBeTruthy();
    expect(root.querySelector('.geom-footer-help')).toBeTruthy();
    component.setViewMode('table');
    fixture.detectChanges();
    expect(root.querySelector('.geom-table')).toBeTruthy();
    component.setViewMode('column');
    fixture.detectChanges();
    expect(root.querySelector('.geom-column')).toBeTruthy();
  });

  it('collapses sidebar via toggle and keeps toolbar present', () => {
    loadSampleRecord();
    expect(fixture.debugElement.query(By.css('.geom-toolbar'))).toBeTruthy();
    component.toggleSidebar();
    fixture.detectChanges();
    expect(component.sidebarCollapsed).toBe(true);
    expect((fixture.nativeElement as HTMLElement).querySelector('.geom-workspace--sidebar-collapsed')).toBeTruthy();
    expect((fixture.nativeElement as HTMLElement).querySelector('.geom-sidebar')).toBeFalsy();
  });

  it('exposes metadata rows and related tools in the DOM', () => {
    loadSampleRecord();
    expect(component.metadataRows.length).toBeGreaterThan(0);
    expect(component.layerMetadataRows.length).toBeGreaterThan(0);
    expect(component.relatedTools.length).toBeGreaterThan(0);
    const links = (fixture.nativeElement as HTMLElement).querySelectorAll('.geom-related');
    expect(links.length).toBe(component.relatedTools.length);
  });
});
