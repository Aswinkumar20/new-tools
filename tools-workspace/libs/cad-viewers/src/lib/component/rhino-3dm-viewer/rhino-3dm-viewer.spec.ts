import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AssetService, Navigation, ToastService } from '@tools-workspace/features-home';
import { Rhino3dmViewerComponent } from './rhino-3dm-viewer';
import { buildSampleRhBytes, createRhFileRecord, createSampleRhFile } from '../../utils/rhino-3dm-viewer.utils';

@Component({ selector: 'lib-navigation', standalone: true, template: '' })
class StubNavigationComponent {}

describe('Rhino3dmViewerComponent', () => {
  let component: Rhino3dmViewerComponent;
  let fixture: ComponentFixture<Rhino3dmViewerComponent>;
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
      imports: [Rhino3dmViewerComponent],
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
      .overrideComponent(Rhino3dmViewerComponent, {
        remove: { imports: [Navigation] },
        add: { imports: [StubNavigationComponent] }
      })
      .compileComponents();

    fixture = TestBed.createComponent(Rhino3dmViewerComponent);
    component = fixture.componentInstance;
    toast = TestBed.inject(ToastService) as unknown as typeof toast;
    fixture.detectChanges();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function loadSampleRecord(): void {
    const file = createSampleRhFile();
    const record = createRhFileRecord(file, buildSampleRhBytes());
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
    expect(component.currentFile?.name).toBe('faucet-body.3dm');
    expect(component.canExport).toBe(true);
    expect(component.parsed?.surfaces.length).toBeGreaterThan(0);
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
    expect(component.selectedSurfaceId).toBe('');
    expect(component.selectedLayerId).toBe('');
    expect(component.selectedInstanceId).toBe('');
  });

  it('filters surfaces and repairs selection when filter removes current item', () => {
    loadSampleRecord();
    const first = component.filteredSurfaces[0];
    expect(first).toBeTruthy();
    component.selectedSurfaceId = first.id;
    component.query = 'kind:__none__';
    component.onFilterChange();
    expect(component.filteredSurfaces.length).toBe(0);
    expect(component.selectedSurfaceId).toBe('');
  });

  it('toggles surface visibility', () => {
    loadSampleRecord();
    const id = component.parsed!.surfaces[0].id;
    const event = { stopPropagation: jest.fn() } as unknown as Event;
    component.toggleSurfaceVisible(id, event);
    expect(event.stopPropagation).toHaveBeenCalled();
    expect(component.isSurfaceHidden(id)).toBe(true);
    component.toggleSurfaceVisible(id, event);
    expect(component.isSurfaceHidden(id)).toBe(false);
  });

  it('hides surfaces and linked instances when surface hidden', () => {
    loadSampleRecord();
    const surface = component.parsed!.surfaces[0];
    const beforeSurfaces = component.visibleSurfaces.length;
    const beforeInstances = component.visibleInstances.length;
    component.hiddenSurfaceIds = new Set([surface.id]);
    expect(component.visibleSurfaces.length).toBeLessThan(beforeSurfaces);
    expect(component.visibleInstances.length).toBeLessThanOrEqual(beforeInstances);
    expect(component.visibleSurfaces.every((s) => s.id !== surface.id)).toBe(true);
  });

  it('switches view modes and toggles sidebar', () => {
    loadSampleRecord();
    component.setViewMode('table');
    expect(component.viewMode).toBe('table');
    component.setViewMode('preview');
    expect(component.viewMode).toBe('preview');
    const before = component.sidebarCollapsed;
    component.toggleSidebar();
    expect(component.sidebarCollapsed).toBe(!before);
  });

  it('selectRow maps row name to surface/layer/instance ids', () => {
    loadSampleRecord();
    component.setViewMode('table');
    expect(component.filteredRows.length).toBeGreaterThan(0);
    component.selectRow(0);
    expect(component.hasSelection || component.selectedRowIndex === 0).toBe(true);
  });

  it('selectInstance links surface and layer when present', () => {
    loadSampleRecord();
    const inst = component.parsed!.instances[0];
    expect(inst).toBeTruthy();
    component.selectInstance(inst.id);
    expect(component.selectedInstanceId).toBe(inst.id);
    if (inst.surface) expect(component.selectedSurfaceId).toBeTruthy();
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
    const second = createRhFileRecord(
      new File([buildSampleRhBytes()], 'second.3dm', { lastModified: 2 }),
      buildSampleRhBytes()
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
    component.errorMessage = 'bad.3dm: Invalid Rhino dump';
    expect(component.primarySuggestion?.id).toBe('sample-after-error');
  });

  it('insights reflect loaded file counts', async () => {
    expect(component.insights.files).toBe(0);
    await component.loadSample();
    expect(component.insights.files).toBe(1);
  });

  it('setViewMode is a no-op when mode unchanged', () => {
    loadSampleRecord();
    component.viewMode = 'surfaces';
    component.setViewMode('surfaces');
    expect(component.viewMode).toBe('surfaces');
  });

  it('soft-fail empty dump disables export', async () => {
    const payload = new TextEncoder().encode(JSON.stringify({ surfaces: [], layers: [], instances: [] }));
    const file = new File([payload], 'empty.json', { lastModified: 9 });
    await component.handleFiles([file]);
    expect(component.files.length).toBe(1);
    expect(component.currentFile?.softFail).toBe(true);
    expect(component.canExport).toBe(false);
  });
});
