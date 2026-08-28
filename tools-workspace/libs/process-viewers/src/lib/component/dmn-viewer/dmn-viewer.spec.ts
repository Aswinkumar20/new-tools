import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { By } from '@angular/platform-browser';
import { AssetService, Navigation, ToastService } from '@tools-workspace/features-home';
import { DMN_XML_SAMPLE } from '../../constants/dmn-sample.data';
import { DmnViewerComponent } from './dmn-viewer';
import { createDmnFileRecord, createSampleDmnFile } from '../../utils/dmn-viewer.utils';

@Component({ selector: 'lib-navigation', standalone: true, template: '' })
class StubNavigationComponent {}

describe('DmnViewerComponent', () => {
  let component: DmnViewerComponent;
  let fixture: ComponentFixture<DmnViewerComponent>;
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
      imports: [DmnViewerComponent],
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
      .overrideComponent(DmnViewerComponent, {
        remove: { imports: [Navigation] },
        add: { imports: [StubNavigationComponent] }
      })
      .compileComponents();

    fixture = TestBed.createComponent(DmnViewerComponent);
    component = fixture.componentInstance;
    toast = TestBed.inject(ToastService) as unknown as typeof toast;
    fixture.detectChanges();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function sampleBytes(): Uint8Array {
    return new TextEncoder().encode(DMN_XML_SAMPLE);
  }

  function loadSampleRecord(): void {
    const file = createSampleDmnFile();
    const record = createDmnFileRecord(file, sampleBytes());
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
    expect(component.currentFile?.name).toBe('sample-loan-approval.dmn');
    expect(component.canExport).toBe(true);
    expect(component.parsed?.tables.length).toBe(2);
    expect(component.parsed?.rules.length).toBe(6);
    expect(component.parsed?.nodes.length).toBeGreaterThan(0);
    expect(toast.success).toHaveBeenCalled();
  });

  it('rejects unsupported files with toast and leaves state empty', async () => {
    await component.handleFiles([new File(['x'], 'note.doc', { lastModified: 1 })]);
    expect(component.files.length).toBe(0);
    expect(toast.error).toHaveBeenCalled();
  });

  it('filters tables and repairs selection when filter removes current item', () => {
    loadSampleRecord();
    const first = component.filteredTables[0];
    expect(first).toBeTruthy();
    component.selectedTableId = first.id;
    component.query = 'policy:__none__';
    component.onFilterChange();
    expect(component.filteredTables.length).toBe(0);
    expect(component.selectedTableId).toBe('');
  });

  it('filters DRD nodes and repairs selection in drd mode', () => {
    loadSampleRecord();
    component.setViewMode('drd');
    const first = component.filteredNodes[0];
    component.selectedNodeId = first.id;
    component.query = 'kind:__none__';
    component.onFilterChange();
    expect(component.filteredNodes.length).toBe(0);
    expect(component.selectedNodeId).toBe('');
  });

  it('filters rules and repairs selection in rules mode', () => {
    loadSampleRecord();
    component.setViewMode('rules');
    const first = component.filteredRules[0];
    component.selectedRuleId = first.id;
    component.query = 'table:__none__';
    component.onFilterChange();
    expect(component.filteredRules.length).toBe(0);
    expect(component.selectedRuleId).toBe('');
  });

  it('selects table, rule, and node', () => {
    loadSampleRecord();
    const table = component.parsed!.tables[0];
    component.selectTable(table.id);
    expect(component.selectedTableId).toBe(table.id);
    const rule = component.parsed!.rules[0];
    component.selectRule(rule.id);
    expect(component.selectedRuleId).toBe(rule.id);
    const node = component.parsed!.nodes[0];
    component.selectNode(node.id);
    expect(component.selectedNodeId).toBe(node.id);
  });

  it('switches view modes and toggles sidebar', () => {
    loadSampleRecord();
    component.setViewMode('table');
    expect(component.viewMode).toBe('table');
    component.setViewMode('tables');
    expect(component.viewMode).toBe('tables');
    const before = component.sidebarCollapsed;
    component.toggleSidebar();
    expect(component.sidebarCollapsed).toBe(!before);
  });

  it('setViewMode is a no-op when mode unchanged', () => {
    loadSampleRecord();
    component.viewMode = 'tables';
    component.setViewMode('tables');
    expect(component.viewMode).toBe('tables');
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

  it('selectTable links first rule for that table', () => {
    loadSampleRecord();
    const table = component.parsed!.tables[0];
    component.selectTable(table.id);
    const linked = component.filteredRules.find((r) => r.tableId === table.id);
    if (linked) expect(component.selectedRuleId).toBe(linked.id);
  });

  it('removeFile clears when last file removed and updates index otherwise', async () => {
    await component.loadSample();
    const second = createDmnFileRecord(new File([sampleBytes()], 'second.dmn', { lastModified: 2 }), sampleBytes());
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
    component.errorMessage = 'bad.dmn: Invalid DMN model';
    expect(component.primarySuggestion?.id).toBe('sample-after-error');
  });

  it('soft-fail unparseable dump disables export', async () => {
    const file = new File(['hello world'], 'bad.dmn', { lastModified: 9 });
    await component.handleFiles([file]);
    expect(component.files.length).toBe(1);
    expect(component.currentFile?.softFail).toBe(true);
    expect(component.canExport).toBe(false);
    expect(toast.warning).toHaveBeenCalled();
  });

  it('keeps scroll-owner structure for map wrap, cards, table, and sidebar', async () => {
    await component.loadSample();
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('.dmn-map-wrap')).toBeTruthy();
    expect(root.querySelector('.dmn-workspace')).toBeTruthy();
    expect(root.querySelector('.dmn-sidebar')).toBeTruthy();
    component.setViewMode('table');
    fixture.detectChanges();
    expect(root.querySelector('.dmn-table')).toBeTruthy();
  });

  it('collapses sidebar via toggle and keeps toolbar present', () => {
    loadSampleRecord();
    expect(fixture.debugElement.query(By.css('.dmn-toolbar'))).toBeTruthy();
    component.toggleSidebar();
    fixture.detectChanges();
    expect(component.sidebarCollapsed).toBe(true);
    expect((fixture.nativeElement as HTMLElement).querySelector('.dmn-workspace--sidebar-collapsed')).toBeTruthy();
    expect((fixture.nativeElement as HTMLElement).querySelector('.dmn-sidebar')).toBeFalsy();
  });
});
