import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AssetService, Navigation, ToastService } from '@tools-workspace/features-home';
import { AltiumPcbViewerComponent } from './altium-pcb-viewer';
import { buildSampleAlBytes, createAlFileRecord, createSampleAlFile } from '../../utils/altium-pcb-viewer.utils';

@Component({ selector: 'lib-navigation', standalone: true, template: '' })
class StubNavigationComponent {}

describe('AltiumPcbViewerComponent', () => {
  let component: AltiumPcbViewerComponent;
  let fixture: ComponentFixture<AltiumPcbViewerComponent>;
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
      measureText: jest.fn(() => ({ width: 0 }))
    };
    jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
    jest.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,xx');

    await TestBed.configureTestingModule({
      imports: [AltiumPcbViewerComponent],
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
      .overrideComponent(AltiumPcbViewerComponent, {
        remove: { imports: [Navigation] },
        add: { imports: [StubNavigationComponent] }
      })
      .compileComponents();

    fixture = TestBed.createComponent(AltiumPcbViewerComponent);
    component = fixture.componentInstance;
    toast = TestBed.inject(ToastService) as unknown as typeof toast;
    fixture.detectChanges();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function loadSampleRecord(): void {
    const file = createSampleAlFile();
    const record = createAlFileRecord(file, buildSampleAlBytes());
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
    expect(component.currentFile?.name).toBe('power-module.pcbdoc');
    expect(component.canExport).toBe(true);
    expect(component.parsed?.layers.length).toBeGreaterThan(0);
    expect(toast.success).toHaveBeenCalled();
  });

  it('rejects unsupported files with toast and leaves state empty', async () => {
    await component.handleFiles([new File(['x'], 'note.doc', { lastModified: 1 })]);
    expect(component.files.length).toBe(0);
    expect(toast.error).toHaveBeenCalled();
  });

  it('clears selection and disables clear-selection when nothing selected', () => {
    loadSampleRecord();
    expect(component.hasSelection).toBe(true);
    component.clearSelection();
    expect(component.hasSelection).toBe(false);
    expect(component.selectedCopperId).toBe('');
    expect(component.selectedDesId).toBe('');
    expect(component.selectedLayerId).toBe('');
  });

  it('filters copper and repairs selection when filter removes current item', () => {
    loadSampleRecord();
    const first = component.filteredCoppers[0];
    expect(first).toBeTruthy();
    component.selectedCopperId = first.id;
    component.query = 'type:__none__';
    component.onFilterChange();
    expect(component.filteredCoppers.length).toBe(0);
    expect(component.selectedCopperId).toBe('');
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
    component.setViewMode('stack');
    expect(component.viewMode).toBe('stack');
    const before = component.sidebarCollapsed;
    component.toggleSidebar();
    expect(component.sidebarCollapsed).toBe(!before);
  });

  it('selectRow maps designator and copper rows to entity ids', () => {
    loadSampleRecord();
    component.setViewMode('table');
    const desRowIndex = component.filteredRows.findIndex(
      (r) => r.type === 'designator' || r.type === 'text' || r.type === 'component'
    );
    const copperRowIndex = component.filteredRows.findIndex(
      (r) => r.type === 'track' || r.type === 'via' || r.type === 'pad' || r.type === 'zone'
    );
    expect(desRowIndex).toBeGreaterThanOrEqual(0);
    expect(copperRowIndex).toBeGreaterThanOrEqual(0);

    component.selectRow(desRowIndex);
    expect(component.selectedDesId).toBeTruthy();
    component.selectRow(copperRowIndex);
    expect(component.selectedCopperId).toBeTruthy();
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

  it('applySuggestion routes sample and upload actions', async () => {
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
    const second = createAlFileRecord(
      new File([buildSampleAlBytes()], 'second.pcbdoc', { lastModified: 2 }),
      buildSampleAlBytes()
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
    component.errorMessage = 'bad.pcbdoc: Invalid Altium dump';
    expect(component.primarySuggestion?.id).toBe('sample-after-error');
  });

  it('insights reflect loaded file counts', async () => {
    expect(component.insights.files).toBe(0);
    await component.loadSample();
    expect(component.insights.files).toBe(1);
    expect(component.insights.groupCount).toBeGreaterThan(0);
  });
});
