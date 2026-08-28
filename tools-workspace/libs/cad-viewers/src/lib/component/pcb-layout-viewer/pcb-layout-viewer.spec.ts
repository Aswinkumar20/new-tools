import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AssetService, Navigation, ToastService } from '@tools-workspace/features-home';
import { PcbLayoutViewerComponent } from './pcb-layout-viewer';
import { buildSamplePbBytes, createPbFileRecord, createSamplePbFile } from '../../utils/pcb-layout-viewer.utils';

@Component({ selector: 'lib-navigation', standalone: true, template: '' })
class StubNavigationComponent {}

describe('PcbLayoutViewerComponent', () => {
  let component: PcbLayoutViewerComponent;
  let fixture: ComponentFixture<PcbLayoutViewerComponent>;
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
    jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
    jest.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,xx');

    await TestBed.configureTestingModule({
      imports: [PcbLayoutViewerComponent],
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
      .overrideComponent(PcbLayoutViewerComponent, {
        remove: { imports: [Navigation] },
        add: { imports: [StubNavigationComponent] }
      })
      .compileComponents();

    fixture = TestBed.createComponent(PcbLayoutViewerComponent);
    component = fixture.componentInstance;
    toast = TestBed.inject(ToastService) as unknown as typeof toast;
    fixture.detectChanges();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function loadSampleRecord(): void {
    const file = createSamplePbFile();
    const record = createPbFileRecord(file, buildSamplePbBytes());
    component.files = [record];
    component.currentIndex = 0;
    component['resetViewForCurrent']();
    fixture.detectChanges();
  }

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows upload-or-sample suggestion when empty', () => {
    expect(component.primarySuggestion?.id).toBe('upload-or-sample');
  });

  it('loads sample via handleFiles and enables export', async () => {
    await component.loadSample();
    expect(component.files.length).toBe(1);
    expect(component.currentFile?.name).toBe('sensor-board.pcb');
    expect(component.canExport).toBe(true);
    expect(component.parsed?.traces.length).toBeGreaterThan(0);
    expect(toast.success).toHaveBeenCalled();
  });

  it('rejects unsupported files with toast and leaves state empty', async () => {
    await component.handleFiles([new File(['x'], 'note.doc', { lastModified: 1 })]);
    expect(component.files.length).toBe(0);
    expect(toast.error).toHaveBeenCalled();
  });

  it('clears selection', () => {
    loadSampleRecord();
    expect(component.hasSelection).toBe(true);
    component.clearSelection();
    expect(component.hasSelection).toBe(false);
    expect(component.selectedTraceId).toBe('');
    expect(component.selectedLayerId).toBe('');
    expect(component.selectedNetId).toBe('');
  });

  it('filters traces and repairs selection when filter removes current item', () => {
    loadSampleRecord();
    const first = component.filteredTraces[0];
    expect(first).toBeTruthy();
    component.selectedTraceId = first.id;
    component.query = 'type:__none__';
    component.onFilterChange();
    expect(component.filteredTraces.length).toBe(0);
    expect(component.selectedTraceId).toBe('');
  });

  it('isolates selected layer and showAllLayers restores visibility', () => {
    loadSampleRecord();
    const layers = component.parsed!.layers;
    expect(layers.length).toBeGreaterThan(1);
    component.selectedLayerId = layers[0].id;
    component.isolateSelected();
    expect(component.hiddenLayerIds.size).toBe(layers.length - 1);
    expect(component.isLayerHidden(layers[1].id)).toBe(true);
    component.showAllLayers();
    expect(component.hiddenLayerIds.size).toBe(0);
  });

  it('toggles layer visibility without changing selection', () => {
    loadSampleRecord();
    const id = component.parsed!.layers[0].id;
    const event = { stopPropagation: jest.fn() } as unknown as Event;
    component.toggleLayerVisible(id, event);
    expect(event.stopPropagation).toHaveBeenCalled();
    expect(component.isLayerHidden(id)).toBe(true);
    component.toggleLayerVisible(id, event);
    expect(component.isLayerHidden(id)).toBe(false);
  });

  it('switches view modes and toggles sidebar', () => {
    loadSampleRecord();
    component.setViewMode('table');
    expect(component.viewMode).toBe('table');
    component.setViewMode('nets');
    expect(component.viewMode).toBe('nets');
    const before = component.sidebarCollapsed;
    component.toggleSidebar();
    expect(component.sidebarCollapsed).toBe(!before);
  });

  it('selectRow maps row name to layer/net/trace ids', () => {
    loadSampleRecord();
    component.setViewMode('table');
    expect(component.filteredRows.length).toBeGreaterThan(0);
    component.selectRow(0);
    expect(component.hasSelection || component.selectedRowIndex === 0).toBe(true);
  });

  it('dismisses suggestion and restores after clearAll', async () => {
    const suggestion = component.primarySuggestion;
    expect(suggestion).toBeTruthy();
    component.dismissSuggestion(suggestion!.id);
    expect(component.primarySuggestion).toBeNull();

    await component.loadSample();
    component.clearAll();
    expect(component.files.length).toBe(0);
    expect(component.primarySuggestion?.id).toBe('upload-or-sample');
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

  it('removeFile clears when last file removed and updates index otherwise', async () => {
    await component.loadSample();
    const second = createPbFileRecord(
      new File([buildSamplePbBytes()], 'second.pcb', { lastModified: 2 }),
      buildSamplePbBytes()
    );
    component.files = [...component.files, second];
    component.currentIndex = 1;
    const event = { stopPropagation: jest.fn() } as unknown as Event;
    component.removeFile(1, event);
    expect(component.files.length).toBe(1);
    expect(component.currentIndex).toBe(0);

    component.removeFile(0, event);
    expect(component.files.length).toBe(0);
    expect(component.currentIndex).toBe(-1);
  });

  it('shows error suggestion after a hard load failure message', () => {
    component.errorMessage = 'bad.pcb: Invalid PCB dump';
    expect(component.primarySuggestion?.id).toBe('sample-after-error');
  });

  it('insights reflect loaded file counts', async () => {
    expect(component.insights.files).toBe(0);
    await component.loadSample();
    expect(component.insights.files).toBe(1);
  });

  it('hides traces in visibleTraces when layer hidden', () => {
    loadSampleRecord();
    const layer = component.parsed!.layers[0];
    const before = component.visibleTraces.length;
    component.hiddenLayerIds = new Set([layer.id]);
    expect(component.visibleTraces.length).toBeLessThanOrEqual(before);
    expect(
      component.visibleTraces.every((t) => t.layer !== layer.id && t.layer !== layer.name)
    ).toBe(true);
  });

  it('selectTrace links net and layer when present', () => {
    loadSampleRecord();
    const trace = component.parsed!.traces[0];
    expect(trace).toBeTruthy();
    component.selectTrace(trace.id);
    expect(component.selectedTraceId).toBe(trace.id);
    if (trace.net) expect(component.selectedNetId).toBeTruthy();
    if (trace.layer) expect(component.selectedLayerId).toBeTruthy();
  });

  it('setViewMode is a no-op when mode unchanged', () => {
    loadSampleRecord();
    component.viewMode = 'plot';
    component.setViewMode('plot');
    expect(component.viewMode).toBe('plot');
  });

  it('soft-fail empty dump disables export', async () => {
    const payload = new TextEncoder().encode(JSON.stringify({ layers: [], nets: [], traces: [] }));
    const file = new File([payload], 'empty.json', { lastModified: 9 });
    await component.handleFiles([file]);
    expect(component.files.length).toBe(1);
    expect(component.currentFile?.softFail).toBe(true);
    expect(component.canExport).toBe(false);
  });
});
