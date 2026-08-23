import { ElementRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AssetService, ToastService } from '@tools-workspace/features-home';
import { ContourMapViewerComponent } from './contour-map-viewer';
import * as utils from '../../utils/contour-map-viewer.utils';
import type { ContourLoadedFile } from '../../types/contour-map-viewer.types';

describe('ContourMapViewerComponent', () => {
  let fixture: ComponentFixture<ContourMapViewerComponent>;
  let component: ContourMapViewerComponent;
  const toast = { success: jest.fn(), error: jest.fn(), info: jest.fn() };

  const sampleRecord: ContourLoadedFile = {
    id: 'sample-contours.tif|100|0',
    name: 'sample-contours.tif',
    size: 100,
    sourceKind: 'dem',
    bytes: new Uint8Array([1, 2, 3]),
    text: null,
    metadata: {
      width: 64,
      height: 64,
      samplesPerPixel: 1,
      bitsPerSample: 8,
      photometric: 1,
      photometricLabel: 'BlackIsZero',
      geoKeys: { GeographicTypeGeoKey: 4326 },
      origin: [10, 50, 0],
      resolution: [0.01, -0.01, 0],
      bbox: [10, 49.36, 10.64, 50],
      nodata: null,
      tiled: false,
      tileWidth: null,
      tileHeight: null,
      compression: 1,
      compressionLabel: 'Uncompressed',
      imageCount: 1,
      overviews: [{ index: 0, width: 64, height: 64 }],
      gdalMetadata: {},
      crsNote: 'Geographic CRS (EPSG:4326 WGS84)'
    },
    stats: {
      title: 'sample-contours',
      sourceKind: 'dem',
      width: 64,
      height: 64,
      samplesPerPixel: 1,
      bitsPerSampleLabel: '8',
      bounds: { west: 10, south: 49.36, east: 10.64, north: 50 },
      nodata: null,
      crsNote: 'Geographic CRS (EPSG:4326 WGS84)',
      elevation: { min: 100, max: 250, mean: 175, range: 150, validCount: 4096 },
      bandIndex: 0,
      previewWidth: 64,
      previewHeight: 64,
      contourInterval: 25,
      contourCount: 6,
      featureCount: 40,
      majorEvery: 5
    },
    warnings: [],
    previewDataUrl: 'data:image/png;base64,AAAA',
    previewWidth: 64,
    previewHeight: 64,
    elevationGrid: new Float64Array(64 * 64).fill(150),
    gridWidth: 64,
    gridHeight: 64,
    contoursGeoJson: {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { elevation: 150 },
          geometry: {
            type: 'LineString',
            coordinates: [
              [10.1, 49.5],
              [10.2, 49.6]
            ]
          }
        }
      ]
    }
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ContourMapViewerComponent],
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

    const fakeOverlay = {
      addTo: jest.fn().mockReturnThis(),
      setOpacity: jest.fn(),
      setUrl: jest.fn(),
      setBounds: jest.fn()
    };
    const fakeLayer = {
      addTo: jest.fn().mockReturnThis(),
      setOpacity: jest.fn()
    };
    const fakeGroup = {
      addLayer: jest.fn(),
      addTo: jest.fn().mockReturnThis()
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
        getZoom: jest.fn().mockReturnValue(12),
        on: jest.fn(),
        off: jest.fn(),
        remove: jest.fn()
      }),
      tileLayer: jest.fn().mockReturnValue(fakeLayer),
      imageOverlay: jest.fn().mockReturnValue(fakeOverlay),
      layerGroup: jest.fn().mockReturnValue(fakeGroup),
      marker: jest.fn().mockReturnValue({}),
      divIcon: jest.fn().mockReturnValue({}),
      latLngBounds: jest.fn().mockReturnValue({ isValid: () => true }),
      latLng: jest.fn(),
      Icon: { Default: { prototype: {}, mergeOptions: jest.fn() } }
    } as never);

    jest.spyOn(utils, 'ensureContourStylesheet').mockImplementation(() => undefined);
    jest.spyOn(utils, 'configureLeafletDefaultIcons').mockImplementation(() => undefined);
    jest.spyOn(utils, 'fitMapToContour').mockImplementation(() => undefined);
    jest.spyOn(utils, 'createOrUpdateImageOverlay').mockReturnValue(fakeOverlay as never);
    jest.spyOn(utils, 'createSampleContourFile').mockReturnValue(
      new File([sampleRecord.bytes], 'sample-contours.tif', {
        type: 'image/tiff',
        lastModified: 0
      })
    );
    jest.spyOn(utils, 'readContourFileBytes').mockResolvedValue(sampleRecord.bytes);
    jest.spyOn(utils, 'openAndParseContourDem').mockResolvedValue({
      metadata: sampleRecord.metadata!,
      stats: sampleRecord.stats,
      warnings: [],
      preview: {
        dataUrl: sampleRecord.previewDataUrl!,
        width: 64,
        height: 64
      },
      elevationGrid: sampleRecord.elevationGrid!,
      contoursGeoJson: sampleRecord.contoursGeoJson,
      options: {
        colormap: 'terrain',
        bandIndex: 0,
        contourInterval: 25,
        majorEvery: 5,
        showLabels: true,
        showUnderlay: true,
        lineColorMode: 'elevation',
        solidColor: '#1e293b',
        lineWeight: 1.25,
        opacity: 0.95
      }
    });
    jest.spyOn(utils, 'createContourFileRecord').mockReturnValue(sampleRecord);

    fixture = TestBed.createComponent(ContourMapViewerComponent);
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

  it('loads a sample dataset and exposes contour stats', async () => {
    await component.loadSample();
    await component.loadSample();
    expect(component.currentFile?.name).toBe('sample-contours.tif');
    expect(component.contourFiles).toHaveLength(1);
    expect(component.stats?.contourCount).toBe(6);
    expect(component.stats?.elevation.range).toBe(150);
    expect(toast.success).toHaveBeenCalled();
    expect(utils.createOrUpdateImageOverlay).toHaveBeenCalled();
  });

  it('rejects invalid files', async () => {
    await component.handleFiles([new File(['plain'], 'notes.txt', { type: 'text/plain' })]);
    expect(component.currentFile).toBeNull();
    expect(toast.error).toHaveBeenCalled();
  });

  it('toggles sidebar', async () => {
    await component.loadSample();
    component.toggleSidebar();
    expect(component.sidebarCollapsed).toBe(true);
  });
});
