import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { By } from '@angular/platform-browser';
import { AssetService, Navigation, ToastService } from '@tools-workspace/features-home';
import { PNML_XML_SAMPLE } from '../../constants/pnml-sample.data';
import { PnmlViewerComponent } from './pnml-viewer';
import { createPnmlFileRecord, createSamplePnmlFile } from '../../utils/pnml-viewer.utils';

@Component({ selector: 'lib-navigation', standalone: true, template: '' })
class StubNavigationComponent {}

describe('PnmlViewerComponent', () => {
  let component: PnmlViewerComponent;
  let fixture: ComponentFixture<PnmlViewerComponent>;
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
      imports: [PnmlViewerComponent],
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
      .overrideComponent(PnmlViewerComponent, {
        remove: { imports: [Navigation] },
        add: { imports: [StubNavigationComponent] }
      })
      .compileComponents();

    fixture = TestBed.createComponent(PnmlViewerComponent);
    component = fixture.componentInstance;
    toast = TestBed.inject(ToastService) as unknown as typeof toast;
    fixture.detectChanges();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function sampleBytes(): Uint8Array {
    return new TextEncoder().encode(PNML_XML_SAMPLE);
  }

  function loadSampleRecord(): void {
    const file = createSamplePnmlFile();
    const record = createPnmlFileRecord(file, sampleBytes());
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
    expect(component.currentFile?.name).toBe('sample-order-net.pnml');
    expect(component.canExport).toBe(true);
    expect(component.parsed?.places.length).toBe(7);
    expect(component.parsed?.transitions.length).toBe(6);
    expect(component.parsed?.tokenTotal).toBe(4);
    expect(toast.success).toHaveBeenCalled();
  });

  it('rejects unsupported files with toast and leaves state empty', async () => {
    await component.handleFiles([new File(['x'], 'note.doc', { lastModified: 1 })]);
    expect(component.files).toHaveLength(0);
    expect(toast.error).toHaveBeenCalled();
  });

  it('filters places and repairs selection when filter removes current item', () => {
    loadSampleRecord();
    const first = component.filteredPlaces[0];
    expect(first).toBeTruthy();
    component.selectedPlaceId = first.id;
    component.query = 'place:__none__';
    component.onFilterChange();
    expect(component.filteredPlaces).toHaveLength(0);
    expect(component.selectedPlaceId).toBe('');
  });

  it('filters transitions and repairs selection in transitions mode', () => {
    loadSampleRecord();
    component.setViewMode('transitions');
    const first = component.filteredTransitions[0];
    component.selectedTransitionId = first.id;
    component.query = 'transition:__none__';
    component.onFilterChange();
    expect(component.filteredTransitions).toHaveLength(0);
    expect(component.selectedTransitionId).toBe('');
  });

  it('filters tokens and repairs selection in tokens mode', () => {
    loadSampleRecord();
    component.setViewMode('tokens');
    const first = component.filteredTokens[0];
    component.selectedTokenId = first.id;
    component.query = 'place:__none__';
    component.onFilterChange();
    expect(component.filteredTokens).toHaveLength(0);
    expect(component.selectedTokenId).toBe('');
  });

  it('selects place, transition, and token with cross-linking', () => {
    loadSampleRecord();
    const place = component.parsed!.places[0];
    component.selectPlace(place.id);
    expect(component.selectedPlaceId).toBe(place.id);
    const token = component.filteredTokens.find((t) => t.placeId === place.id);
    if (token) expect(component.selectedTokenId).toBe(token.id);
    const transition = component.parsed!.transitions[0];
    component.selectTransition(transition.id);
    expect(component.selectedTransitionId).toBe(transition.id);
  });

  it('switches view modes and toggles sidebar', () => {
    loadSampleRecord();
    component.setViewMode('table');
    expect(component.viewMode).toBe('table');
    component.setViewMode('places');
    expect(component.viewMode).toBe('places');
    const before = component.sidebarCollapsed;
    component.toggleSidebar();
    expect(component.sidebarCollapsed).toBe(!before);
  });

  it('setViewMode is a no-op when mode unchanged', () => {
    loadSampleRecord();
    component.viewMode = 'places';
    component.setViewMode('places');
    expect(component.viewMode).toBe('places');
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
    const second = createPnmlFileRecord(new File([sampleBytes()], 'second.pnml', { lastModified: 2 }), sampleBytes());
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
    component.errorMessage = 'bad.pnml: Invalid PNML net';
    expect(component.primarySuggestion?.id).toBe('sample-after-error');
  });

  it('soft-fail unparseable dump disables export', async () => {
    const file = new File(['hello world'], 'bad.pnml', { lastModified: 9 });
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
    expect(root.querySelector('.pnml-map-wrap')).toBeTruthy();
    expect(root.querySelector('.pnml-workspace')).toBeTruthy();
    expect(root.querySelector('.pnml-sidebar')).toBeTruthy();
    component.setViewMode('table');
    fixture.detectChanges();
    expect(root.querySelector('.pnml-table')).toBeTruthy();
  });

  it('collapses sidebar via toggle and keeps toolbar present', () => {
    loadSampleRecord();
    expect(fixture.debugElement.query(By.css('.pnml-toolbar'))).toBeTruthy();
    component.toggleSidebar();
    fixture.detectChanges();
    expect(component.sidebarCollapsed).toBe(true);
    expect((fixture.nativeElement as HTMLElement).querySelector('.pnml-workspace--sidebar-collapsed')).toBeTruthy();
    expect((fixture.nativeElement as HTMLElement).querySelector('.pnml-sidebar')).toBeFalsy();
  });
});
