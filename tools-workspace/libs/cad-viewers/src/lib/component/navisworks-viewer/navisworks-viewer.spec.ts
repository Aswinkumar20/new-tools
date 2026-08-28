import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AssetService, Navigation, ToastService } from '@tools-workspace/features-home';
import { NavisworksViewerComponent } from './navisworks-viewer';
import { buildSampleNwBytes, createNwFileRecord, createSampleNwFile } from '../../utils/navisworks-viewer.utils';

@Component({ selector: 'lib-navigation', standalone: true, template: '' })
class StubNavigationComponent {}

describe('NavisworksViewerComponent', () => {
  let component: NavisworksViewerComponent;
  let fixture: ComponentFixture<NavisworksViewerComponent>;
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
      imports: [NavisworksViewerComponent],
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
      .overrideComponent(NavisworksViewerComponent, {
        remove: { imports: [Navigation] },
        add: { imports: [StubNavigationComponent] }
      })
      .compileComponents();

    fixture = TestBed.createComponent(NavisworksViewerComponent);
    component = fixture.componentInstance;
    toast = TestBed.inject(ToastService) as unknown as typeof toast;
    fixture.detectChanges();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function loadSampleRecord(): void {
    const file = createSampleNwFile();
    const record = createNwFileRecord(file, buildSampleNwBytes());
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
    expect(component.currentFile?.name).toBe('campus-fed.nwd');
    expect(component.canExport).toBe(true);
    expect(component.parsed?.items.length).toBeGreaterThan(0);
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
    expect(component.selectedItemId).toBe('');
    expect(component.selectedModelId).toBe('');
    expect(component.selectedClashId).toBe('');
  });

  it('filters items and repairs selection when filter removes current item', () => {
    loadSampleRecord();
    const first = component.filteredItems[0];
    expect(first).toBeTruthy();
    component.selectedItemId = first.id;
    component.query = 'kind:__none__';
    component.onFilterChange();
    expect(component.filteredItems.length).toBe(0);
    expect(component.selectedItemId).toBe('');
  });

  it('isolates selected model and showAllModels restores visibility', () => {
    loadSampleRecord();
    const models = component.parsed!.models;
    expect(models.length).toBeGreaterThan(1);
    component.selectedModelId = models[0].id;
    component.isolateSelectedModel();
    expect(component.hiddenModelIds.size).toBe(models.length - 1);
    expect(component.isModelHidden(models[1].id)).toBe(true);
    component.showAllModels();
    expect(component.hiddenModelIds.size).toBe(0);
  });

  it('toggles model visibility without changing selection', () => {
    loadSampleRecord();
    const id = component.parsed!.models[0].id;
    const event = { stopPropagation: jest.fn() } as unknown as Event;
    component.toggleModelVisible(id, event);
    expect(event.stopPropagation).toHaveBeenCalled();
    expect(component.isModelHidden(id)).toBe(true);
    component.toggleModelVisible(id, event);
    expect(component.isModelHidden(id)).toBe(false);
  });

  it('switches view modes and toggles sidebar', () => {
    loadSampleRecord();
    component.setViewMode('table');
    expect(component.viewMode).toBe('table');
    component.setViewMode('clashes');
    expect(component.viewMode).toBe('clashes');
    const before = component.sidebarCollapsed;
    component.toggleSidebar();
    expect(component.sidebarCollapsed).toBe(!before);
  });

  it('selectRow maps row name to item/clash/model ids', () => {
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
    const second = createNwFileRecord(
      new File([buildSampleNwBytes()], 'second.nwd', { lastModified: 2 }),
      buildSampleNwBytes()
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
    component.errorMessage = 'bad.nwd: Invalid Navisworks dump';
    expect(component.primarySuggestion?.id).toBe('sample-after-error');
  });

  it('insights reflect loaded file counts', async () => {
    expect(component.insights.files).toBe(0);
    await component.loadSample();
    expect(component.insights.files).toBe(1);
  });

  it('hides items and clashes when model hidden', () => {
    loadSampleRecord();
    const model = component.parsed!.models[0];
    const beforeItems = component.visibleItems.length;
    const beforeClashes = component.visibleClashes.length;
    component.hiddenModelIds = new Set([model.id]);
    expect(component.visibleItems.length).toBeLessThanOrEqual(beforeItems);
    expect(component.visibleItems.every((i) => i.model !== model.id)).toBe(true);
    expect(component.visibleClashes.length).toBeLessThanOrEqual(beforeClashes);
  });

  it('selectClash links item and model when present', () => {
    loadSampleRecord();
    const clash = component.parsed!.clashes[0];
    expect(clash).toBeTruthy();
    component.selectClash(clash.id);
    expect(component.selectedClashId).toBe(clash.id);
    if (clash.itemA) expect(component.selectedItemId).toBeTruthy();
  });
});
