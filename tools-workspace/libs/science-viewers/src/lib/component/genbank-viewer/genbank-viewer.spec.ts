import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { By } from '@angular/platform-browser';
import { AssetService, Navigation, ToastService } from '@tools-workspace/features-home';
import { GENBANK_SAMPLE } from '../../constants/genbank-sample.data';
import { GenbankViewerComponent } from './genbank-viewer';
import { createGenbankFileRecord, createSampleGenbankFile } from '../../utils/genbank-viewer.utils';

@Component({ selector: 'lib-navigation', standalone: true, template: '' })
class StubNavigationComponent {}

describe('GenbankViewerComponent', () => {
  let component: GenbankViewerComponent;
  let fixture: ComponentFixture<GenbankViewerComponent>;
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
      rect: jest.fn(),
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
      imports: [GenbankViewerComponent],
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
      .overrideComponent(GenbankViewerComponent, {
        remove: { imports: [Navigation] },
        add: { imports: [StubNavigationComponent] }
      })
      .compileComponents();

    fixture = TestBed.createComponent(GenbankViewerComponent);
    component = fixture.componentInstance;
    toast = TestBed.inject(ToastService) as unknown as typeof toast;
    fixture.detectChanges();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function sampleBytes(): Uint8Array {
    return new TextEncoder().encode(GENBANK_SAMPLE);
  }

  function loadSampleRecord(): void {
    const file = createSampleGenbankFile();
    const record = createGenbankFileRecord(file, sampleBytes());
    component.files = [record];
    component.currentIndex = 0;
    component['resetViewForCurrent']();
    fixture.detectChanges();
  }

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows upload suggestion when empty', () => {
    expect(component.primarySuggestion?.id).toBe('upload-gb');
  });

  it('loads sample via handleFiles and enables export', async () => {
    await component.loadSample();
    expect(component.files).toHaveLength(1);
    expect(component.currentFile?.name).toBe('sample-adh.gb');
    expect(component.canExport).toBe(true);
    expect(component.record?.locus).toBe('ETH001');
    expect(component.record?.features.length).toBeGreaterThan(0);
    expect(toast.success).toHaveBeenCalled();
  });

  it('rejects unsupported files with toast and leaves state empty', async () => {
    await component.handleFiles([new File(['x'], 'reads.fastq', { lastModified: 1 })]);
    expect(component.files).toHaveLength(0);
    expect(toast.error).toHaveBeenCalled();
  });

  it('filters features and clears selection when none match', () => {
    loadSampleRecord();
    component.query = '__none__';
    component.onQueryChange();
    expect(component.visibleFeatures).toHaveLength(0);
    expect(component.selectedFeature).toBeNull();
  });

  it('filters by type and selects features', () => {
    loadSampleRecord();
    component.setTypeFilter('CDS');
    expect(component.visibleFeatures.every((f) => f.type === 'CDS')).toBe(true);
    component.selectFeature(0);
    expect(component.selectedFeature?.type).toBe('CDS');
  });

  it('toggles wrap, color, translation, and view modes', () => {
    loadSampleRecord();
    component.setWrap(80);
    expect(component.wrap).toBe(80);
    component.setWrap(80);
    expect(component.wrap).toBe(80);
    const colorBefore = component.colorize;
    component.toggleColor();
    expect(component.colorize).toBe(!colorBefore);
    component.toggleTranslation();
    expect(component.showTranslation).toBe(true);
    component.setViewMode('features');
    expect(component.viewMode).toBe('features');
    component.setViewMode('features');
    expect(component.viewMode).toBe('features');
    component.setViewMode('sequence');
    expect(component.viewMode).toBe('sequence');
  });

  it('dismisses suggestion and restores after clearAll', async () => {
    const suggestion = component.primarySuggestion;
    expect(suggestion).toBeTruthy();
    component.dismissSuggestion(suggestion!.id);
    expect(component.primarySuggestion).toBeNull();

    await component.loadSample();
    component.clearAll();
    expect(component.files).toHaveLength(0);
    expect(component.primarySuggestion?.id).toBe('upload-gb');
    expect(component.showExportMenu).toBe(false);
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
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: jest.fn() });
    const click = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    component.exportAs('summary-json', event);
    expect(toast.success).toHaveBeenCalledWith('Export started');
    expect(createObjectURL).toHaveBeenCalled();
    click.mockRestore();
  });

  it('blocks png export outside feature map view', async () => {
    await component.loadSample();
    component.setViewMode('sequence');
    fixture.detectChanges();
    const event = { stopPropagation: jest.fn() } as unknown as Event;
    component.exportAs('png', event);
    expect(toast.info).toHaveBeenCalledWith('Open Feature map to export a PNG snapshot');
  });

  it('removeFile clears when last file removed and updates index otherwise', async () => {
    await component.loadSample();
    const second = createGenbankFileRecord(new File([sampleBytes()], 'second.gb', { lastModified: 2 }), sampleBytes());
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
    component.errorMessage = 'bad.gb: Invalid GenBank';
    expect(component.primarySuggestion?.id).toBe('try-sample');
  });

  it('soft-fail unparseable dump disables export', async () => {
    const file = new File(['hello world'], 'bad.gb', { lastModified: 9 });
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
    expect(root.querySelector('.gb-map-wrap')).toBeTruthy();
    expect(root.querySelector('.gb-workspace')).toBeTruthy();
    expect(root.querySelector('.gb-sidebar')).toBeTruthy();
    component.setViewMode('features');
    fixture.detectChanges();
    expect(root.querySelector('.gb-feat-table')).toBeTruthy();
  });

  it('collapses sidebar via toggle and keeps toolbar present', () => {
    loadSampleRecord();
    expect(fixture.debugElement.query(By.css('.gb-toolbar'))).toBeTruthy();
    component.toggleSidebar();
    fixture.detectChanges();
    expect(component.sidebarCollapsed).toBe(true);
    expect((fixture.nativeElement as HTMLElement).querySelector('.gb-workspace--sidebar-collapsed')).toBeTruthy();
    expect((fixture.nativeElement as HTMLElement).querySelector('.gb-sidebar')).toBeFalsy();
  });

  it('closes export menu on Escape', async () => {
    await component.loadSample();
    component.showExportMenu = true;
    component.onKeydown(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(component.showExportMenu).toBe(false);
  });

  it('metadata derives from loaded sample', () => {
    loadSampleRecord();
    expect(component.fileMetadataRows.length).toBeGreaterThan(0);
    expect(component.recordMetadataRows.length).toBeGreaterThan(0);
  });
});
