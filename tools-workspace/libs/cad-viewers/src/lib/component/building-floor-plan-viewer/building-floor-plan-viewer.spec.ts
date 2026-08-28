import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AssetService, Navigation, ToastService } from '@tools-workspace/features-home';
import { BuildingFloorPlanViewerComponent } from './building-floor-plan-viewer';
import { buildSampleFpBytes, createFpFileRecord, createSampleFpFile } from '../../utils/building-floor-plan-viewer.utils';

@Component({ selector: 'lib-navigation', standalone: true, template: '' })
class StubNavigationComponent {}

describe('BuildingFloorPlanViewerComponent', () => {
  let component: BuildingFloorPlanViewerComponent;
  let fixture: ComponentFixture<BuildingFloorPlanViewerComponent>;
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
      imports: [BuildingFloorPlanViewerComponent],
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
      .overrideComponent(BuildingFloorPlanViewerComponent, {
        remove: { imports: [Navigation] },
        add: { imports: [StubNavigationComponent] }
      })
      .compileComponents();

    fixture = TestBed.createComponent(BuildingFloorPlanViewerComponent);
    component = fixture.componentInstance;
    toast = TestBed.inject(ToastService) as unknown as typeof toast;
    fixture.detectChanges();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function loadSampleRecord(): void {
    const file = createSampleFpFile();
    const record = createFpFileRecord(file, buildSampleFpBytes());
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
    expect(component.currentFile?.name).toBe('hotel-l3.ifc');
    expect(component.canExport).toBe(true);
    expect(component.parsed?.levels.length).toBeGreaterThan(0);
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
    expect(component.selectedSpaceId).toBe('');
    expect(component.selectedLevelId).toBe('');
    expect(component.selectedRoomId).toBe('');
  });

  it('filters spaces and repairs selection when filter removes current item', () => {
    loadSampleRecord();
    const first = component.filteredSpaces[0];
    expect(first).toBeTruthy();
    component.selectedSpaceId = first.id;
    component.query = 'kind:__none__';
    component.onFilterChange();
    expect(component.filteredSpaces.length).toBe(0);
    expect(component.selectedSpaceId).toBe('');
  });

  it('isolates selected level and showAllLevels restores visibility', () => {
    loadSampleRecord();
    const levels = component.parsed!.levels;
    expect(levels.length).toBeGreaterThan(1);
    component.selectedLevelId = levels[0].id;
    component.isolateSelectedLevel();
    expect(component.hiddenLevelIds.size).toBe(levels.length - 1);
    expect(component.isLevelHidden(levels[1].name)).toBe(true);
    component.showAllLevels();
    expect(component.hiddenLevelIds.size).toBe(0);
  });

  it('toggles level visibility without changing selection', () => {
    loadSampleRecord();
    const name = component.parsed!.levels[0].name;
    const event = { stopPropagation: jest.fn() } as unknown as Event;
    component.toggleLevelVisible(name, event);
    expect(event.stopPropagation).toHaveBeenCalled();
    expect(component.isLevelHidden(name)).toBe(true);
    component.toggleLevelVisible(name, event);
    expect(component.isLevelHidden(name)).toBe(false);
  });

  it('switches view modes and toggles sidebar', () => {
    loadSampleRecord();
    component.setViewMode('table');
    expect(component.viewMode).toBe('table');
    component.setViewMode('rooms');
    expect(component.viewMode).toBe('rooms');
    const before = component.sidebarCollapsed;
    component.toggleSidebar();
    expect(component.sidebarCollapsed).toBe(!before);
  });

  it('selectRow maps row name to space/level/room ids', () => {
    loadSampleRecord();
    component.setViewMode('table');
    expect(component.filteredRows.length).toBeGreaterThan(0);
    component.selectRow(0);
    expect(component.hasSelection || component.selectedRowIndex === 0).toBe(true);
  });

  it('selectRoom links a matching space when present', () => {
    loadSampleRecord();
    const room = component.filteredRooms[0];
    expect(room).toBeTruthy();
    component.selectRoom(room.id);
    expect(component.selectedRoomId).toBe(room.id);
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
    const second = createFpFileRecord(
      new File([buildSampleFpBytes()], 'second.ifc', { lastModified: 2 }),
      buildSampleFpBytes()
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
    component.errorMessage = 'bad.ifc: Invalid floor-plan dump';
    expect(component.primarySuggestion?.id).toBe('sample-after-error');
  });

  it('insights reflect loaded file counts', async () => {
    expect(component.insights.files).toBe(0);
    await component.loadSample();
    expect(component.insights.files).toBe(1);
  });

  it('hides spaces for hidden levels in visibleSpaces', () => {
    loadSampleRecord();
    const levelName = component.parsed!.levels[0].name;
    const before = component.visibleSpaces.length;
    component.hiddenLevelIds = new Set([levelName]);
    expect(component.visibleSpaces.length).toBeLessThanOrEqual(before);
    expect(component.visibleSpaces.every((s) => s.level !== levelName)).toBe(true);
  });
});
