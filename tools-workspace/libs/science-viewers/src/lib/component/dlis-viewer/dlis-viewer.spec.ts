import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { By } from '@angular/platform-browser';
import { AssetService, Navigation, ToastService } from '@tools-workspace/features-home';
import { DlisViewerComponent } from './dlis-viewer';
import { buildSampleDlisBytes } from '../../utils/dlis-build.utils';
import { createDlisFileRecord, createSampleDlisFile } from '../../utils/dlis-viewer.utils';

@Component({ selector: 'lib-navigation', standalone: true, template: '' })
class StubNavigationComponent {}

describe('DlisViewerComponent', () => {
  let component: DlisViewerComponent;
  let fixture: ComponentFixture<DlisViewerComponent>;
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
      rotate: jest.fn(),
      scale: jest.fn(),
      setLineDash: jest.fn(),
      measureText: jest.fn(() => ({ width: 0 })),
      createLinearGradient: jest.fn(() => ({ addColorStop: jest.fn() })),
      drawImage: jest.fn()
    };
    jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
    jest.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,xx');

    await TestBed.configureTestingModule({
      imports: [DlisViewerComponent],
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
      .overrideComponent(DlisViewerComponent, {
        remove: { imports: [Navigation] },
        add: { imports: [StubNavigationComponent] }
      })
      .compileComponents();

    fixture = TestBed.createComponent(DlisViewerComponent);
    component = fixture.componentInstance;
    toast = TestBed.inject(ToastService) as unknown as typeof toast;
    fixture.detectChanges();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function sampleBytes(): Uint8Array {
    return buildSampleDlisBytes();
  }

  function loadSampleRecord(): void {
    const file = createSampleDlisFile();
    const record = createDlisFileRecord(file, sampleBytes());
    component.files = [record];
    component.currentIndex = 0;
    component['resetViewForCurrent']();
    fixture.detectChanges();
  }

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows upload suggestion when empty', () => {
    expect(component.primarySuggestion?.id).toBe('upload-dlis');
  });

  it('loads sample via handleFiles and enables export', async () => {
    await component.loadSample();
    expect(component.files).toHaveLength(1);
    expect(component.currentFile?.name).toBe('sample-well.dlis');
    expect(component.canExport).toBe(true);
    expect(component.parsed?.curves.length).toBe(4);
    expect(component.parsed?.channels.length).toBe(5);
    expect(toast.success).toHaveBeenCalled();
  });

  it('rejects unsupported files with toast and leaves state empty', async () => {
    await component.handleFiles([new File(['x'], 'well.las', { lastModified: 1 })]);
    expect(component.files).toHaveLength(0);
    expect(toast.error).toHaveBeenCalled();
  });

  it('filters channels and repairs selection when filter removes current item', () => {
    loadSampleRecord();
    component.selectedMnemonic = 'GR';
    component.query = '__none__';
    component.onFilterChange();
    expect(component.filteredChannels).toHaveLength(0);
    expect(component.selectedMnemonic).toBe('');
  });

  it('selects curve, toggles visibility, and adjusts depth', () => {
    loadSampleRecord();
    component.selectCurve('RHOB');
    expect(component.selectedMnemonic).toBe('RHOB');
    expect(component.selectedCurve?.mnemonic).toBe('RHOB');
    const before = component.enabledMnemonics.size;
    component.toggleCurve('RHOB');
    expect(component.enabledMnemonics.has('RHOB')).toBe(false);
    expect(component.enabledMnemonics.size).toBe(before - 1);
    component.depthMin = 120;
    component.depthMax = 110;
    component.onDepthChange();
    expect(component.depthMin).toBeLessThanOrEqual(component.depthMax);
    component.fitDepth();
    expect(component.depthMin).toBe(component.parsed!.depth[0]);
    expect(component.depthMax).toBe(component.parsed!.depth[component.parsed!.depth.length - 1]);
  });

  it('toggles crossplot and switches view modes', () => {
    loadSampleRecord();
    expect(component.showCrossplot).toBe(false);
    component.toggleCrossplot();
    expect(component.showCrossplot).toBe(true);
    component.setViewMode('records');
    expect(component.viewMode).toBe('records');
    component.setViewMode('records');
    expect(component.viewMode).toBe('records');
    component.selectRecord(1);
    expect(component.selectedRecordIndex).toBe(1);
    component.setViewMode('channels');
    expect(component.viewMode).toBe('channels');
  });

  it('toggles log scale and reversed on a curve', () => {
    loadSampleRecord();
    const curve = component.parsed!.curves[0];
    const logBefore = !!curve.logScale;
    component.toggleLogScale(curve);
    expect(!!curve.logScale).toBe(!logBefore);
    const revBefore = !!curve.reversed;
    component.toggleReversed(curve);
    expect(!!curve.reversed).toBe(!revBefore);
  });

  it('dismisses suggestion and restores after clearAll', async () => {
    const suggestion = component.primarySuggestion;
    expect(suggestion).toBeTruthy();
    component.dismissSuggestion(suggestion!.id);
    expect(component.primarySuggestion).toBeNull();

    await component.loadSample();
    component.clearAll();
    expect(component.files).toHaveLength(0);
    expect(component.primarySuggestion?.id).toBe('upload-dlis');
    expect(component.showExportMenu).toBe(false);
    expect(component.showCrossplot).toBe(false);
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

  it('blocks png export outside tracks view', async () => {
    await component.loadSample();
    component.setViewMode('records');
    fixture.detectChanges();
    const event = { stopPropagation: jest.fn() } as unknown as Event;
    component.exportAs('png', event);
    expect(toast.info).toHaveBeenCalledWith('Open Tracks view to export a PNG snapshot');
  });

  it('removeFile clears when last file removed and updates index otherwise', async () => {
    await component.loadSample();
    const second = createDlisFileRecord(new File([sampleBytes()], 'second.dlis', { lastModified: 2 }), sampleBytes());
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
    component.errorMessage = 'bad.dlis: Invalid DLIS';
    expect(component.primarySuggestion?.id).toBe('try-sample');
  });

  it('soft-fail unparseable dump disables export', async () => {
    const file = new File([new Uint8Array([1, 2, 3, 4])], 'bad.dlis', { lastModified: 9 });
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
    expect(root.querySelector('.dlis-map-wrap')).toBeTruthy();
    expect(root.querySelector('.dlis-workspace')).toBeTruthy();
    expect(root.querySelector('.dlis-sidebar')).toBeTruthy();
    component.setViewMode('records');
    fixture.detectChanges();
    expect(root.querySelector('.dlis-table')).toBeTruthy();
  });

  it('collapses sidebar via toggle and keeps toolbar present', () => {
    loadSampleRecord();
    expect(fixture.debugElement.query(By.css('.dlis-toolbar'))).toBeTruthy();
    component.toggleSidebar();
    fixture.detectChanges();
    expect(component.sidebarCollapsed).toBe(true);
    expect((fixture.nativeElement as HTMLElement).querySelector('.dlis-workspace--sidebar-collapsed')).toBeTruthy();
    expect((fixture.nativeElement as HTMLElement).querySelector('.dlis-sidebar')).toBeFalsy();
  });

  it('closes export menu on Escape', async () => {
    await component.loadSample();
    component.showExportMenu = true;
    component.onKeydown(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(component.showExportMenu).toBe(false);
  });

  it('metadata derives from loaded sample', () => {
    loadSampleRecord();
    expect(component.metadataRows.length).toBeGreaterThan(0);
    expect(component.histogramBars.length).toBeGreaterThan(0);
  });
});
