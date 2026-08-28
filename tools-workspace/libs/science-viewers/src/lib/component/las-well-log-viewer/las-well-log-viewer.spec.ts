import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { By } from '@angular/platform-browser';
import { AssetService, Navigation, ToastService } from '@tools-workspace/features-home';
import { LAS_SAMPLE } from '../../constants/las-sample.data';
import { LasWellLogViewerComponent } from './las-well-log-viewer';
import { createLasFileRecord, createSampleLasFile } from '../../utils/las-well-log-viewer.utils';

@Component({ selector: 'lib-navigation', standalone: true, template: '' })
class StubNavigationComponent {}

describe('LasWellLogViewerComponent', () => {
  let component: LasWellLogViewerComponent;
  let fixture: ComponentFixture<LasWellLogViewerComponent>;
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
      createLinearGradient: jest.fn(() => ({ addColorStop: jest.fn() }))
    };
    Object.defineProperty(ctx, 'fillStyle', { set: jest.fn(), get: () => '#000' });
    Object.defineProperty(ctx, 'strokeStyle', { set: jest.fn(), get: () => '#000' });
    Object.defineProperty(ctx, 'font', { set: jest.fn(), get: () => '10px sans-serif' });
    Object.defineProperty(ctx, 'textAlign', { set: jest.fn(), get: () => 'left' });
    Object.defineProperty(ctx, 'lineWidth', { set: jest.fn(), get: () => 1 });
    jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
    jest.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,xx');

    await TestBed.configureTestingModule({
      imports: [LasWellLogViewerComponent],
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
      .overrideComponent(LasWellLogViewerComponent, {
        remove: { imports: [Navigation] },
        add: { imports: [StubNavigationComponent] }
      })
      .compileComponents();

    fixture = TestBed.createComponent(LasWellLogViewerComponent);
    component = fixture.componentInstance;
    toast = TestBed.inject(ToastService) as unknown as typeof toast;
    fixture.detectChanges();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function sampleBytes(): Uint8Array {
    return new TextEncoder().encode(LAS_SAMPLE);
  }

  function loadSampleRecord(): void {
    const file = createSampleLasFile();
    const record = createLasFileRecord(file, sampleBytes());
    component.files = [record];
    component.currentIndex = 0;
    component['resetViewForCurrent']();
    fixture.detectChanges();
  }

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows upload suggestion when empty', () => {
    expect(component.primarySuggestion?.id).toBe('upload-las');
  });

  it('loads sample via handleFiles and enables export', async () => {
    await component.loadSample();
    expect(component.files).toHaveLength(1);
    expect(component.currentFile?.name).toBe('sample-well.las');
    expect(component.canExport).toBe(true);
    expect(component.parsed?.curves.map((c) => c.mnemonic)).toEqual(['GR', 'RHOB', 'NPHI', 'DT']);
    expect(component.parsed?.depth.length).toBeGreaterThan(0);
    expect(toast.success).toHaveBeenCalled();
  });

  it('rejects unsupported files with toast and leaves state empty', async () => {
    await component.handleFiles([new File(['x'], 'well.dlis', { lastModified: 1 })]);
    expect(component.files).toHaveLength(0);
    expect(toast.error).toHaveBeenCalled();
  });

  it('filters curves and repairs selection when filter removes current item', () => {
    loadSampleRecord();
    component.selectedMnemonic = 'GR';
    component.query = '__none__';
    component.onFilterChange();
    expect(component.filteredCurveList).toHaveLength(0);
    expect(component.selectedMnemonic).toBe('');
  });

  it('toggles curve visibility but keeps at least one enabled', () => {
    loadSampleRecord();
    const mnemonics = [...component.enabledMnemonics];
    expect(mnemonics.length).toBeGreaterThan(1);
    component.toggleCurve(mnemonics[0]);
    expect(component.enabledMnemonics.has(mnemonics[0])).toBe(false);
    component.enabledMnemonics = new Set([mnemonics[1]]);
    component.selectedMnemonic = mnemonics[1];
    component.toggleCurve(mnemonics[1]);
    expect(component.enabledMnemonics.has(mnemonics[1])).toBe(true);
  });

  it('toggles log scale and reverse on selected curve', () => {
    loadSampleRecord();
    const curve = component.selectedCurve!;
    const beforeLog = !!curve.logScale;
    component.toggleLogScale(curve);
    expect(!!curve.logScale).toBe(!beforeLog);
    const beforeRev = !!curve.reversed;
    component.toggleReversed(curve);
    expect(!!curve.reversed).toBe(!beforeRev);
  });

  it('switches view modes, depth fit, and sidebar', () => {
    loadSampleRecord();
    component.setViewMode('table');
    expect(component.viewMode).toBe('table');
    component.setViewMode('crossplot');
    expect(component.viewMode).toBe('crossplot');
    component.fitDepth();
    expect(component.depthMin).toBe(component.parsed!.depth[0]);
    expect(component.depthMax).toBe(component.parsed!.depth[component.parsed!.depth.length - 1]);
    const before = component.sidebarCollapsed;
    component.toggleSidebar();
    expect(component.sidebarCollapsed).toBe(!before);
  });

  it('setViewMode is a no-op when mode unchanged', () => {
    loadSampleRecord();
    component.viewMode = 'tracks';
    component.setViewMode('tracks');
    expect(component.viewMode).toBe('tracks');
  });

  it('dismisses suggestion and restores after clearAll', async () => {
    const suggestion = component.primarySuggestion;
    expect(suggestion).toBeTruthy();
    component.dismissSuggestion(suggestion!.id);
    expect(component.primarySuggestion).toBeNull();

    await component.loadSample();
    component.clearAll();
    expect(component.files).toHaveLength(0);
    expect(component.primarySuggestion?.id).toBe('upload-las');
    expect(component.viewMode).toBe('tracks');
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

  it('blocks png export outside canvas views', async () => {
    await component.loadSample();
    component.setViewMode('table');
    fixture.detectChanges();
    const event = { stopPropagation: jest.fn() } as unknown as Event;
    component.exportAs('png', event);
    expect(toast.info).toHaveBeenCalledWith('Open Tracks or Crossplot to export a PNG snapshot');
  });

  it('Escape closes export menu', async () => {
    await component.loadSample();
    component.showExportMenu = true;
    component.onKeydown(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(component.showExportMenu).toBe(false);
  });

  it('removeFile clears when last file removed and updates index otherwise', async () => {
    await component.loadSample();
    const second = createLasFileRecord(new File([sampleBytes()], 'second.las', { lastModified: 2 }), sampleBytes());
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
    component.errorMessage = 'bad.las: Invalid LAS';
    expect(component.primarySuggestion?.id).toBe('try-sample');
  });

  it('soft-fail unparseable dump disables export', async () => {
    const file = new File(['hello world'], 'bad.las', { lastModified: 9 });
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
    expect(root.querySelector('.las-map-wrap')).toBeTruthy();
    expect(root.querySelector('.las-workspace')).toBeTruthy();
    expect(root.querySelector('.las-sidebar')).toBeTruthy();
    expect(root.querySelector('.las-footer-help')).toBeTruthy();
    component.setViewMode('table');
    fixture.detectChanges();
    expect(root.querySelector('.las-table')).toBeTruthy();
    component.setViewMode('histogram');
    fixture.detectChanges();
    expect(root.querySelector('.las-hist')).toBeTruthy();
  });

  it('collapses sidebar via toggle and keeps toolbar present', () => {
    loadSampleRecord();
    expect(fixture.debugElement.query(By.css('.las-toolbar'))).toBeTruthy();
    component.toggleSidebar();
    fixture.detectChanges();
    expect(component.sidebarCollapsed).toBe(true);
    expect((fixture.nativeElement as HTMLElement).querySelector('.las-workspace--sidebar-collapsed')).toBeTruthy();
    expect((fixture.nativeElement as HTMLElement).querySelector('.las-sidebar')).toBeFalsy();
  });

  it('exposes related tools links in the DOM', () => {
    loadSampleRecord();
    const links = (fixture.nativeElement as HTMLElement).querySelectorAll('.las-related');
    expect(links.length).toBe(component.relatedTools.length);
  });
});
