import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { By } from '@angular/platform-browser';
import { AssetService, Navigation, ToastService } from '@tools-workspace/features-home';
import { PROCESS_MINING_XES_SAMPLE } from '../../constants/process-mining-sample.data';
import { ProcessMiningViewerComponent } from './process-mining-viewer';
import { createProcessMiningFileRecord, createSampleProcessMiningFile } from '../../utils/process-mining-viewer.utils';

@Component({ selector: 'lib-navigation', standalone: true, template: '' })
class StubNavigationComponent {}

describe('ProcessMiningViewerComponent', () => {
  let component: ProcessMiningViewerComponent;
  let fixture: ComponentFixture<ProcessMiningViewerComponent>;
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
      imports: [ProcessMiningViewerComponent],
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
      .overrideComponent(ProcessMiningViewerComponent, {
        remove: { imports: [Navigation] },
        add: { imports: [StubNavigationComponent] }
      })
      .compileComponents();

    fixture = TestBed.createComponent(ProcessMiningViewerComponent);
    component = fixture.componentInstance;
    toast = TestBed.inject(ToastService) as unknown as typeof toast;
    fixture.detectChanges();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function sampleBytes(): Uint8Array {
    return new TextEncoder().encode(PROCESS_MINING_XES_SAMPLE);
  }

  function loadSampleRecord(): void {
    const file = createSampleProcessMiningFile();
    const record = createProcessMiningFileRecord(file, sampleBytes());
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
    expect(component.currentFile?.name).toBe('sample-order-mining.xes');
    expect(component.canExport).toBe(true);
    expect(component.parsed?.cases).toBe(8);
    expect(component.parsed?.events).toBe(42);
    expect(component.parsed?.variants.length).toBe(3);
    expect(toast.success).toHaveBeenCalled();
  });

  it('rejects unsupported files with toast and leaves state empty', async () => {
    await component.handleFiles([new File(['x'], 'note.doc', { lastModified: 1 })]);
    expect(component.files).toHaveLength(0);
    expect(toast.error).toHaveBeenCalled();
  });

  it('filters variants and repairs selection when filter removes current item', () => {
    loadSampleRecord();
    const first = component.filteredVariants[0];
    expect(first).toBeTruthy();
    component.selectedVariantId = first.id;
    component.query = 'variant:__none__';
    component.onFilterChange();
    expect(component.filteredVariants).toHaveLength(0);
    expect(component.selectedVariantId).toBe('');
  });

  it('filters activities and repairs selection in activities mode', () => {
    loadSampleRecord();
    component.setViewMode('activities');
    const first = component.filteredActivities[0];
    component.selectedActivityId = first.id;
    component.query = 'activity:__none__';
    component.onFilterChange();
    expect(component.filteredActivities).toHaveLength(0);
    expect(component.selectedActivityId).toBe('');
  });

  it('filters DFG edges and repairs selection in dfg mode', () => {
    loadSampleRecord();
    component.setViewMode('dfg');
    const first = component.filteredDfg[0];
    component.selectedDfgId = first.id;
    component.query = '__none__';
    component.onFilterChange();
    expect(component.filteredDfg).toHaveLength(0);
    expect(component.selectedDfgId).toBe('');
  });

  it('selects variant, activity, and DFG edge', () => {
    loadSampleRecord();
    const variant = component.parsed!.variants[0];
    component.selectVariant(variant.id);
    expect(component.selectedVariantId).toBe(variant.id);
    const activity = component.parsed!.activities[0];
    component.selectActivity(activity.id);
    expect(component.selectedActivityId).toBe(activity.id);
    const edge = component.parsed!.dfg[0];
    component.selectDfg(edge.id);
    expect(component.selectedDfgId).toBe(edge.id);
  });

  it('switches view modes and toggles sidebar', () => {
    loadSampleRecord();
    component.setViewMode('table');
    expect(component.viewMode).toBe('table');
    component.setViewMode('variants');
    expect(component.viewMode).toBe('variants');
    const before = component.sidebarCollapsed;
    component.toggleSidebar();
    expect(component.sidebarCollapsed).toBe(!before);
  });

  it('setViewMode is a no-op when mode unchanged', () => {
    loadSampleRecord();
    component.viewMode = 'variants';
    component.setViewMode('variants');
    expect(component.viewMode).toBe('variants');
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
    const second = createProcessMiningFileRecord(new File([sampleBytes()], 'second.xes', { lastModified: 2 }), sampleBytes());
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
    component.errorMessage = 'bad.xes: Invalid process mining file';
    expect(component.primarySuggestion?.id).toBe('sample-after-error');
  });

  it('soft-fail unparseable dump disables export', async () => {
    const file = new File(['hello world'], 'bad.xes', { lastModified: 9 });
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
    expect(root.querySelector('.pmine-map-wrap')).toBeTruthy();
    expect(root.querySelector('.pmine-workspace')).toBeTruthy();
    expect(root.querySelector('.pmine-sidebar')).toBeTruthy();
    component.setViewMode('table');
    fixture.detectChanges();
    expect(root.querySelector('.pmine-table')).toBeTruthy();
  });

  it('collapses sidebar via toggle and keeps toolbar present', () => {
    loadSampleRecord();
    expect(fixture.debugElement.query(By.css('.pmine-toolbar'))).toBeTruthy();
    component.toggleSidebar();
    fixture.detectChanges();
    expect(component.sidebarCollapsed).toBe(true);
    expect((fixture.nativeElement as HTMLElement).querySelector('.pmine-workspace--sidebar-collapsed')).toBeTruthy();
    expect((fixture.nativeElement as HTMLElement).querySelector('.pmine-sidebar')).toBeFalsy();
  });
});
