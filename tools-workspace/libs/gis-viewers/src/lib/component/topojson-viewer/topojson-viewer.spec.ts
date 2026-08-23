import { ElementRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AssetService, ToastService } from '@tools-workspace/features-home';
import { TopoJsonViewerComponent } from './topojson-viewer';
import { TOPOJSON_SAMPLE } from '../../constants/topojson-viewer.constants';
import * as utils from '../../utils/topojson-viewer.utils';

describe('TopoJsonViewerComponent', () => {
  let fixture: ComponentFixture<TopoJsonViewerComponent>;
  let component: TopoJsonViewerComponent;
  const toast = { success: jest.fn(), error: jest.fn(), info: jest.fn() };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TopoJsonViewerComponent],
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
    jest.spyOn(utils, 'ensureTopoJsonStylesheet').mockImplementation(() => undefined);
    jest.spyOn(utils, 'configureLeafletDefaultIcons').mockImplementation(() => undefined);

    fixture = TestBed.createComponent(TopoJsonViewerComponent);
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

  it('loads a sample dataset and exposes stats', async () => {
    await component.loadSample();
    await component.loadSample();
    expect(component.currentFile?.name).toBe('sample-city.topojson');
    expect(component.topoJsonFiles).toHaveLength(1);
    expect(component.stats?.objects).toBe(4);
    expect(component.stats?.arcs).toBe(2);
    expect(component.features.length).toBe(4);
    expect(component.warnings.length).toBeGreaterThan(0);
    expect(toast.success).toHaveBeenCalled();
  });

  it('rejects invalid files', async () => {
    await component.handleFiles([new File(['plain'], 'notes.txt', { type: 'text/plain' })]);
    expect(component.currentFile).toBeNull();
    expect(toast.error).toHaveBeenCalled();
  });

  it('filters by topology object and geometry kind', async () => {
    await component.loadSample();
    component.setObjectFilter('landmarks');
    await fixture.whenStable();
    expect(component.features.every((item) => item.objectName === 'landmarks')).toBe(true);
    expect(component.features.length).toBe(2);

    component.setFeatureFilter('point');
    expect(component.filteredFeatures.every((item) => item.kind === 'point')).toBe(true);
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
      new File([TOPOJSON_SAMPLE], 'demo.topojson', { type: 'application/json', lastModified: 0 })
    ]);
    component.exportAs('features-csv');
    expect(toast.success).toHaveBeenCalledWith('Exported features CSV');
    component.exportAs('geojson');
    expect(toast.success).toHaveBeenCalledWith('Exported GeoJSON');
    component.exportAs('topojson');
    expect(toast.success).toHaveBeenCalledWith('Exported TopoJSON');
  });

  it('toggles the sidebar and opens the file picker', async () => {
    await component.loadSample();
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
