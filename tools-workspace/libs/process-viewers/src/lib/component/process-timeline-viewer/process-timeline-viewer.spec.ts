import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { By } from '@angular/platform-browser';
import { AssetService, Navigation, ToastService } from '@tools-workspace/features-home';
import { PROCESS_TIMELINE_CSV_SAMPLE } from '../../constants/process-timeline-sample.data';
import { ProcessTimelineViewerComponent } from './process-timeline-viewer';
import { createProcessTimelineFileRecord, createSampleProcessTimelineFile } from '../../utils/process-timeline-viewer.utils';

@Component({ selector: 'lib-navigation', standalone: true, template: '' })
class StubNavigationComponent {}

describe('ProcessTimelineViewerComponent', () => {
  let component: ProcessTimelineViewerComponent;
  let fixture: ComponentFixture<ProcessTimelineViewerComponent>;
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
    jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
    jest.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,xx');

    await TestBed.configureTestingModule({
      imports: [ProcessTimelineViewerComponent],
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
      .overrideComponent(ProcessTimelineViewerComponent, {
        remove: { imports: [Navigation] },
        add: { imports: [StubNavigationComponent] }
      })
      .compileComponents();

    fixture = TestBed.createComponent(ProcessTimelineViewerComponent);
    component = fixture.componentInstance;
    toast = TestBed.inject(ToastService) as unknown as typeof toast;
    fixture.detectChanges();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function sampleBytes(): Uint8Array {
    return new TextEncoder().encode(PROCESS_TIMELINE_CSV_SAMPLE);
  }

  function loadSampleRecord(): void {
    const file = createSampleProcessTimelineFile();
    const record = createProcessTimelineFileRecord(file, sampleBytes());
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
    expect(component.files).toHaveLength(1);
    expect(component.currentFile?.name).toBe('sample-warehouse-timeline.csv');
    expect(component.canExport).toBe(true);
    expect(component.parsed?.items.length).toBe(16);
    expect(component.parsed?.caseLanes.length).toBe(4);
    expect(toast.success).toHaveBeenCalled();
  });

  it('rejects unsupported files with toast and leaves state empty', async () => {
    await component.handleFiles([new File(['x'], 'note.doc', { lastModified: 1 })]);
    expect(component.files).toHaveLength(0);
    expect(toast.error).toHaveBeenCalled();
  });

  it('filters events and repairs selection when filter removes current item', () => {
    loadSampleRecord();
    const first = component.filteredItems[0];
    expect(first).toBeTruthy();
    component.selectedItemId = first.id;
    component.query = 'activity:__none__';
    component.onFilterChange();
    expect(component.filteredItems).toHaveLength(0);
    expect(component.selectedItemId).toBe('');
  });

  it('filters case lanes and repairs selection in gantt mode', () => {
    loadSampleRecord();
    component.setViewMode('gantt');
    const first = component.filteredCaseLanes[0];
    component.selectedLaneId = first.id;
    component.query = 'case:__none__';
    component.onFilterChange();
    expect(component.filteredCaseLanes).toHaveLength(0);
    expect(component.selectedLaneId).toBe('');
  });

  it('filters resource lanes and repairs selection in lanes mode', () => {
    loadSampleRecord();
    component.setViewMode('lanes');
    const first = component.filteredResourceLanes[0];
    component.selectedLaneId = first.id;
    component.query = 'resource:__none__';
    component.onFilterChange();
    expect(component.filteredResourceLanes).toHaveLength(0);
    expect(component.selectedLaneId).toBe('');
  });

  it('selects event and lane', () => {
    loadSampleRecord();
    const item = component.parsed!.items[0];
    component.selectItem(item.id);
    expect(component.selectedItemId).toBe(item.id);
    const lane = component.parsed!.caseLanes[0];
    component.selectLane(lane.id);
    expect(component.selectedLaneId).toBe(lane.id);
  });

  it('switches view modes and toggles sidebar', () => {
    loadSampleRecord();
    component.setViewMode('table');
    expect(component.viewMode).toBe('table');
    component.setViewMode('gantt');
    expect(component.viewMode).toBe('gantt');
    const before = component.sidebarCollapsed;
    component.toggleSidebar();
    expect(component.sidebarCollapsed).toBe(!before);
  });

  it('setViewMode is a no-op when mode unchanged', () => {
    loadSampleRecord();
    component.viewMode = 'gantt';
    component.setViewMode('gantt');
    expect(component.viewMode).toBe('gantt');
  });

  it('setViewMode switches lane selection when moving between gantt and lanes', () => {
    loadSampleRecord();
    const caseLaneId = component.filteredCaseLanes[0]?.id;
    const resourceLaneId = component.filteredResourceLanes[0]?.id;
    expect(caseLaneId).toBeTruthy();
    expect(resourceLaneId).toBeTruthy();
    component.setViewMode('lanes');
    expect(component.selectedLaneId).toBe(resourceLaneId);
    component.setViewMode('gantt');
    expect(component.selectedLaneId).toBe(caseLaneId);
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
    const second = createProcessTimelineFileRecord(new File([sampleBytes()], 'second.csv', { lastModified: 2 }), sampleBytes());
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

  it('shows error suggestion after a hard load failure message', () => {
    component.errorMessage = 'bad.csv: Invalid timeline';
    expect(component.primarySuggestion?.id).toBe('sample-after-error');
  });

  it('soft-fail unparseable dump disables export', async () => {
    const file = new File(['hello world'], 'bad.csv', { lastModified: 9 });
    await component.handleFiles([file]);
    expect(component.files).toHaveLength(1);
    expect(component.currentFile?.softFail).toBe(true);
    expect(component.canExport).toBe(false);
    expect(toast.warning).toHaveBeenCalled();
  });

  it('keeps scroll-owner structure for map wrap, cards, table, and sidebar', async () => {
    await component.loadSample();
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('.ptl-map-wrap')).toBeTruthy();
    expect(root.querySelector('.ptl-workspace')).toBeTruthy();
    expect(root.querySelector('.ptl-sidebar')).toBeTruthy();
    component.setViewMode('table');
    fixture.detectChanges();
    expect(root.querySelector('.ptl-table')).toBeTruthy();
  });

  it('collapses sidebar via toggle and keeps toolbar present', () => {
    loadSampleRecord();
    expect(fixture.debugElement.query(By.css('.ptl-toolbar'))).toBeTruthy();
    component.toggleSidebar();
    fixture.detectChanges();
    expect(component.sidebarCollapsed).toBe(true);
    expect((fixture.nativeElement as HTMLElement).querySelector('.ptl-workspace--sidebar-collapsed')).toBeTruthy();
    expect((fixture.nativeElement as HTMLElement).querySelector('.ptl-sidebar')).toBeFalsy();
  });
});
