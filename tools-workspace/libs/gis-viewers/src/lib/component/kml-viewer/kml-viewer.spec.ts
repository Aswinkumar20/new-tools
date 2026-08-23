import { ElementRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AssetService, ToastService } from '@tools-workspace/features-home';
import { KmlViewerComponent } from './kml-viewer';
import { KML_SAMPLE } from '../../constants/kml-viewer.constants';
import * as utils from '../../utils/kml-viewer.utils';

describe('KmlViewerComponent', () => {
  let fixture: ComponentFixture<KmlViewerComponent>;
  let component: KmlViewerComponent;
  const toast = { success: jest.fn(), error: jest.fn(), info: jest.fn() };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [KmlViewerComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ToastService, useValue: toast },
        {
          provide: AssetService,
          useValue: { getAssetPath: (path: string) => `/assets/${path}` }
        }
      ]
    }).compileComponents();

    const fakeLayer = {
      getBounds: () => ({
        isValid: () => true
      }),
      addTo: jest.fn().mockReturnThis(),
      eachLayer: jest.fn()
    };

    jest.spyOn(utils, 'loadLeaflet').mockResolvedValue({
      map: jest.fn().mockReturnValue({
        setView: jest.fn().mockReturnThis(),
        addLayer: jest.fn(),
        removeLayer: jest.fn(),
        invalidateSize: jest.fn(),
        fitBounds: jest.fn(),
        setZoom: jest.fn(),
        zoomIn: jest.fn(),
        zoomOut: jest.fn(),
        getZoom: jest.fn().mockReturnValue(2),
        on: jest.fn(),
        remove: jest.fn()
      }),
      tileLayer: jest.fn().mockReturnValue({ addTo: jest.fn() }),
      geoJSON: jest.fn().mockReturnValue(fakeLayer),
      circleMarker: jest.fn(),
      Icon: { Default: { prototype: {}, mergeOptions: jest.fn() } }
    } as never);
    jest.spyOn(utils, 'ensureKmlStylesheet').mockImplementation(() => undefined);
    jest.spyOn(utils, 'configureLeafletDefaultIcons').mockImplementation(() => undefined);

    fixture = TestBed.createComponent(KmlViewerComponent);
    component = fixture.componentInstance;
    component.mapHost = {
      nativeElement: document.createElement('div')
    } as ElementRef<HTMLDivElement>;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('loads a sample dataset once and exposes stats', async () => {
    await component.loadSample();
    await component.loadSample();
    expect(component.currentFile?.name).toBe('sample-bay-area.kml');
    expect(component.kmlFiles).toHaveLength(1);
    expect(component.stats?.title).toBe('Sample Bay Area Tour');
    expect(component.features.length).toBe(4);
    expect(component.warnings.length).toBeGreaterThan(0);
    expect(toast.success).toHaveBeenCalled();
  });

  it('rejects invalid files', async () => {
    await component.handleFiles([new File(['plain'], 'notes.txt', { type: 'text/plain' })]);
    expect(component.currentFile).toBeNull();
    expect(toast.error).toHaveBeenCalled();
  });

  it('exports feature CSV after load', async () => {
    const createObjectURL = jest.fn().mockReturnValue('blob:mock');
    const revokeObjectURL = jest.fn();
    (URL as { createObjectURL: (b: Blob) => string }).createObjectURL = createObjectURL;
    (URL as { revokeObjectURL: (u: string) => void }).revokeObjectURL = revokeObjectURL;
    const originalCreateElement = document.createElement.bind(document);
    jest.spyOn(document, 'createElement').mockImplementation(((tag: string) => {
      if (tag === 'a') {
        return { href: '', download: '', click: jest.fn() } as unknown as HTMLAnchorElement;
      }
      return originalCreateElement(tag);
    }) as typeof document.createElement);

    await component.handleFiles([
      new File([KML_SAMPLE], 'demo.kml', {
        type: 'application/vnd.google-earth.kml+xml',
        lastModified: 1
      })
    ]);
    component.exportAs('features-csv');
    expect(toast.success).toHaveBeenCalledWith('Exported features CSV');
  });

  it('filters features and toggles the sidebar', async () => {
    await component.loadSample();
    component.setFeatureFilter('point');
    expect(component.filteredFeatures.every((item) => item.kind === 'point')).toBe(true);
    expect(component.sidebarCollapsed).toBe(false);
    component.toggleSidebar();
    expect(component.sidebarCollapsed).toBe(true);

    const click = jest.fn();
    component.fileInput = {
      nativeElement: { click }
    } as unknown as ElementRef<HTMLInputElement>;
    component.openFilePicker();
    expect(click).toHaveBeenCalled();
  });
});
