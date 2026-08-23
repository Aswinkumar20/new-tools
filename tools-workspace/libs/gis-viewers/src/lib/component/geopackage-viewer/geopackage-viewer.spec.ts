import { ElementRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AssetService, ToastService } from '@tools-workspace/features-home';
import { GeoPackageViewerComponent } from './geopackage-viewer';
import * as utils from '../../utils/geopackage-viewer.utils';
import type { GeoPackageLoadedFile } from '../../types/geopackage-viewer.types';

function mockLoadedFile(overrides: Partial<GeoPackageLoadedFile> = {}): GeoPackageLoadedFile {
  return {
    id: 'sample-city.gpkg-1-0',
    name: 'sample-city.gpkg',
    size: 100,
    bytes: new Uint8Array([1, 2, 3]),
    featureLayers: [
      {
        tableName: 'landmarks',
        dataType: 'features',
        identifier: 'landmarks',
        description: 'Sample city landmarks',
        srsId: 4326,
        minX: -122.48,
        minY: 37.77,
        maxX: -122.39,
        maxY: 37.82,
        geometryColumn: 'geom',
        geometryTypeName: 'GEOMETRY',
        featureCount: 3
      }
    ],
    tileLayers: [],
    otherLayers: [],
    selectedLayer: 'landmarks',
    collection: {
      type: 'FeatureCollection',
      name: 'landmarks',
      layerName: 'landmarks',
      features: [
        {
          type: 'Feature',
          id: 1,
          layerName: 'landmarks',
          geometry: { type: 'Point', coordinates: [-122.4194, 37.7793] },
          properties: { name: 'City Hall', category: 'civic', id: 1 }
        },
        {
          type: 'Feature',
          id: 2,
          layerName: 'landmarks',
          geometry: { type: 'Point', coordinates: [-122.3933, 37.7955] },
          properties: { name: 'Ferry Building', category: 'landmark', id: 2 }
        },
        {
          type: 'Feature',
          id: 3,
          layerName: 'landmarks',
          geometry: { type: 'Point', coordinates: [-122.4, 37.78] },
          properties: { name: 'Market Street Corridor', category: 'route', id: 3 }
        }
      ]
    },
    totalFeatureCount: 3,
    truncated: false,
    unparseableGeometryCount: 0,
    srsId: 4326,
    warnings: [],
    ...overrides
  };
}

describe('GeoPackageViewerComponent', () => {
  let fixture: ComponentFixture<GeoPackageViewerComponent>;
  let component: GeoPackageViewerComponent;
  const toast = { success: jest.fn(), error: jest.fn(), info: jest.fn() };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GeoPackageViewerComponent],
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
    jest.spyOn(utils, 'ensureGeoPackageStylesheet').mockImplementation(() => undefined);
    jest.spyOn(utils, 'configureLeafletDefaultIcons').mockImplementation(() => undefined);
    jest.spyOn(utils, 'createSampleGeoPackageFile').mockReturnValue(
      new File([new Uint8Array([1])], 'sample-city.gpkg', {
        type: 'application/geopackage+sqlite3',
        lastModified: 0
      })
    );
    jest.spyOn(utils, 'parseGeoPackageFile').mockResolvedValue(mockLoadedFile());
    jest.spyOn(utils, 'switchGeoPackageLayer').mockImplementation(async (file, layerName) =>
      mockLoadedFile({ ...file, selectedLayer: layerName, id: file.id })
    );

    fixture = TestBed.createComponent(GeoPackageViewerComponent);
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
    expect(component.currentFile?.name).toBe('sample-city.gpkg');
    expect(component.geoPackageFiles).toHaveLength(1);
    expect(component.stats?.featureLayers).toBe(1);
    expect(component.features.length).toBe(3);
    expect(component.features.every((item) => item.kind === 'point')).toBe(true);
    expect(toast.success).toHaveBeenCalled();
  });

  it('rejects invalid files', async () => {
    await component.handleFiles([new File(['plain'], 'notes.txt', { type: 'text/plain' })]);
    expect(component.currentFile).toBeNull();
    expect(toast.error).toHaveBeenCalled();
  });

  it('filters by geometry kind and searches features', async () => {
    await component.loadSample();
    component.setFeatureFilter('point');
    expect(component.filteredFeatures.every((item) => item.kind === 'point')).toBe(true);
    component.featureSearch = 'ferry';
    component['refreshFilteredFeatures']();
    expect(component.filteredFeatures.some((item) => /ferry/i.test(item.name))).toBe(true);
  });

  it('exports with guards after load', async () => {
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

    await component.loadSample();
    component.exportAs('features-csv');
    expect(toast.success).toHaveBeenCalledWith('Exported features CSV');
    component.exportAs('geojson');
    expect(toast.success).toHaveBeenCalledWith('Exported GeoJSON');
    component.exportAs('gpkg');
    expect(toast.success).toHaveBeenCalledWith('Exported GeoPackage');
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
