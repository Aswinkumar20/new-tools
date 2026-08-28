import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { By } from '@angular/platform-browser';
import { AssetService, Navigation, ToastService } from '@tools-workspace/features-home';
import { MMAP_MARKDOWN_SAMPLE } from '../../constants/mind-map-viewer-sample.data';
import { MindMapViewerComponent } from './mind-map-viewer';
import { createMmapFileRecord, createSampleMmapFile } from '../../utils/mind-map-viewer.utils';

@Component({ selector: 'lib-navigation', standalone: true, template: '' })
class StubNavigationComponent {}

describe('MindMapViewerComponent', () => {
  let component: MindMapViewerComponent;
  let fixture: ComponentFixture<MindMapViewerComponent>;
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
      arcTo: jest.fn(),
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
      imports: [MindMapViewerComponent],
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
      .overrideComponent(MindMapViewerComponent, {
        remove: { imports: [Navigation] },
        add: { imports: [StubNavigationComponent] }
      })
      .compileComponents();

    fixture = TestBed.createComponent(MindMapViewerComponent);
    component = fixture.componentInstance;
    toast = TestBed.inject(ToastService) as unknown as typeof toast;
    fixture.detectChanges();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function sampleBytes(): Uint8Array {
    return new TextEncoder().encode(MMAP_MARKDOWN_SAMPLE);
  }

  function loadSampleRecord(): void {
    const file = createSampleMmapFile();
    const record = createMmapFileRecord(file, sampleBytes());
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
    expect(component.currentFile?.name).toBe('sample-shop-mind.md');
    expect(component.canExport).toBe(true);
    expect(component.parsed?.nodes.length).toBe(7);
    expect(toast.success).toHaveBeenCalled();
  });

  it('rejects unsupported files with toast and leaves state empty', async () => {
    await component.handleFiles([new File(['x'], 'note.doc', { lastModified: 1 })]);
    expect(component.files.length).toBe(0);
    expect(toast.error).toHaveBeenCalled();
  });

  it('filters nodes and repairs selection when filter removes current item', () => {
    loadSampleRecord();
    const first = component.tableNodes[0];
    expect(first).toBeTruthy();
    component.viewMode = 'table';
    component.selectedNodeId = first.id;
    component.query = 'node:__none__';
    component.onFilterChange();
    expect(component.tableNodes.length).toBe(0);
    expect(component.selectedNodeId).toBe('');
  });

  it('selects node and toggles collapse', () => {
    loadSampleRecord();
    const customer = component.parsed!.nodes.find((n) => n.label === 'Customer');
    expect(customer).toBeTruthy();
    component.selectNode(customer!.id);
    expect(component.selectedNodeId).toBe(customer!.id);
    component.toggleCollapse(customer!.id);
    expect(component.parsed!.nodes.find((n) => n.id === customer!.id)?.collapsed).toBe(true);
  });

  it('expandAll and collapseAll update tree state', () => {
    loadSampleRecord();
    component.collapseAll();
    const collapsible = component.parsed!.nodes.filter((n) => n.childIds.length && n.id !== component.parsed!.rootId);
    expect(collapsible.every((n) => n.collapsed)).toBe(true);
    component.expandAll();
    expect(component.parsed!.nodes.every((n) => !n.collapsed)).toBe(true);
  });

  it('switches view modes and toggles sidebar', () => {
    loadSampleRecord();
    component.setViewMode('outline');
    expect(component.viewMode).toBe('outline');
    component.setViewMode('table');
    expect(component.viewMode).toBe('table');
    const before = component.sidebarCollapsed;
    component.toggleSidebar();
    expect(component.sidebarCollapsed).toBe(!before);
  });

  it('setViewMode is a no-op when mode unchanged', () => {
    loadSampleRecord();
    component.viewMode = 'diagram';
    component.setViewMode('diagram');
    expect(component.viewMode).toBe('diagram');
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
    const second = createMmapFileRecord(new File([sampleBytes()], 'second.md', { lastModified: 2 }), sampleBytes());
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
    component.errorMessage = 'bad.md: Invalid mind map';
    expect(component.primarySuggestion?.id).toBe('sample-after-error');
  });

  it('insights reflect loaded file counts', async () => {
    expect(component.insights.files).toBe(0);
    await component.loadSample();
    expect(component.insights.files).toBe(1);
  });

  it('soft-fail unparseable dump disables export', async () => {
    const file = new File(['hello world'], 'bad.md', { lastModified: 9 });
    await component.handleFiles([file]);
    expect(component.files.length).toBe(1);
    expect(component.currentFile?.softFail).toBe(true);
    expect(component.canExport).toBe(false);
    expect(toast.warning).toHaveBeenCalled();
  });

  it('keeps scroll-owner structure for map wrap, outline, table, and sidebar', async () => {
    await component.loadSample();
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('.mmap-map-wrap')).toBeTruthy();
    expect(root.querySelector('.mmap-workspace')).toBeTruthy();
    expect(root.querySelector('.mmap-sidebar')).toBeTruthy();
    component.setViewMode('outline');
    fixture.detectChanges();
    expect(root.querySelector('.mmap-outline')).toBeTruthy();
    component.setViewMode('table');
    fixture.detectChanges();
    expect(root.querySelector('.mmap-table')).toBeTruthy();
  });

  it('collapses sidebar via toggle and keeps toolbar present', () => {
    loadSampleRecord();
    expect(fixture.debugElement.query(By.css('.mmap-toolbar'))).toBeTruthy();
    component.toggleSidebar();
    fixture.detectChanges();
    expect(component.sidebarCollapsed).toBe(true);
    expect((fixture.nativeElement as HTMLElement).querySelector('.mmap-workspace--sidebar-collapsed')).toBeTruthy();
    expect((fixture.nativeElement as HTMLElement).querySelector('.mmap-sidebar')).toBeFalsy();
  });
});
