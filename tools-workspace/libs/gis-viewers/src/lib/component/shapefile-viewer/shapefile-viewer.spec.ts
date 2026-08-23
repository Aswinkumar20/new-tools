import { ElementRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AssetService, ToastService } from '@tools-workspace/features-home';
import { ShapefileViewerComponent } from './shapefile-viewer';
import * as utils from '../../utils/shapefile-viewer.utils';
import type { ShapefileFeatureCollection } from '../../types/shapefile-viewer.types';

const SAMPLE_DATA: ShapefileFeatureCollection = {
  type: 'FeatureCollection',
  fileName: 'sample_city',
  features: [
    {
      type: 'Feature',
      properties: { name: 'City Hall', category: 'civic', visitors: 1200 },
      geometry: { type: 'Point', coordinates: [-122.4194, 37.7793] }
    },
    {
      type: 'Feature',
      properties: { name: 'Ferry Building', category: 'landmark', visitors: 4500 },
      geometry: { type: 'Point', coordinates: [-122.3933, 37.7955] }
    },
    {
      type: 'Feature',
      properties: { name: 'Golden Gate Bridge', category: 'landmark', visitors: 10000 },
      geometry: { type: 'Point', coordinates: [-122.4783, 37.8199] }
    },
    {
      type: 'Feature',
      properties: { name: 'California Academy', category: 'museum', visitors: 3200 },
      geometry: { type: 'Point', coordinates: [-122.4862, 37.7699] }
    }
  ]
};

describe('ShapefileViewerComponent', () => {
  let fixture: ComponentFixture<ShapefileViewerComponent>;
  let component: ShapefileViewerComponent;
  const toast = { success: jest.fn(), error: jest.fn(), info: jest.fn() };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ShapefileViewerComponent],
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
    jest.spyOn(utils, 'ensureShapefileStylesheet').mockImplementation(() => undefined);
    jest.spyOn(utils, 'configureLeafletDefaultIcons').mockImplementation(() => undefined);
    jest.spyOn(utils, 'createSampleShapefileZip').mockResolvedValue(
      new Blob([new Uint8Array([1, 2, 3])], { type: 'application/zip' })
    );
    jest.spyOn(utils, 'readFileAsArrayBuffer').mockResolvedValue(new ArrayBuffer(8));
    jest.spyOn(utils, 'parseShapefileZipBuffer').mockResolvedValue({
      data: SAMPLE_DATA,
      warnings: [],
      hadDbf: true,
      hadPrj: true
    });

    fixture = TestBed.createComponent(ShapefileViewerComponent);
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
    expect(component.currentFile?.name).toBe('sample-city.zip');
    expect(component.shapefileFiles).toHaveLength(1);
    expect(component.stats?.layerName).toBe('sample_city');
    expect(component.features.length).toBe(4);
    expect(toast.success).toHaveBeenCalled();
  });

  it('rejects invalid files', async () => {
    await component.handleFiles([new File(['plain'], 'notes.txt', { type: 'text/plain' })]);
    expect(component.currentFile).toBeNull();
    expect(toast.error).toHaveBeenCalled();
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
