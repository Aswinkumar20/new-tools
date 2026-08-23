import { ElementRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AssetService, ToastService } from '@tools-workspace/features-home';
import { TerrainViewerComponent } from './terrain-viewer';
import * as utils from '../../utils/terrain-viewer.utils';
import type { TerrainLoadedFile } from '../../types/terrain-viewer.types';

describe('TerrainViewerComponent', () => {
  let fixture: ComponentFixture<TerrainViewerComponent>;
  let component: TerrainViewerComponent;
  const toast = { success: jest.fn(), error: jest.fn(), info: jest.fn() };

  const sampleRecord: TerrainLoadedFile = {
    id: 'sample-terrain.tif|100|0',
    name: 'sample-terrain.tif',
    size: 100,
    bytes: new Uint8Array([1, 2, 3]),
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
      title: 'sample-terrain',
      width: 64,
      height: 64,
      samplesPerPixel: 1,
      bitsPerSampleLabel: '8',
      photometricLabel: 'BlackIsZero',
      compressionLabel: 'Uncompressed',
      tiled: false,
      imageCount: 1,
      bounds: { west: 10, south: 49.36, east: 10.64, north: 50 },
      nodata: null,
      crsNote: 'Geographic CRS (EPSG:4326 WGS84)',
      elevation: { min: 100, max: 250, mean: 175, range: 150, validCount: 4096 },
      bandIndex: 0,
      previewWidth: 64,
      previewHeight: 64,
      contourInterval: 25,
      contourCount: 6
    },
    warnings: [],
    previewDataUrl: 'data:image/png;base64,AAAA',
    previewWidth: 64,
    previewHeight: 64,
    elevationGrid: new Float64Array(64 * 64).fill(150),
    gridWidth: 64,
    gridHeight: 64,
    contoursGeoJson: { type: 'FeatureCollection', features: [] }
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TerrainViewerComponent],
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
      latLngBounds: jest.fn().mockReturnValue({ isValid: () => true }),
      latLng: jest.fn(),
      Icon: { Default: { prototype: {}, mergeOptions: jest.fn() } }
    } as never);

    jest.spyOn(utils, 'ensureTerrainStylesheet').mockImplementation(() => undefined);
    jest.spyOn(utils, 'configureLeafletDefaultIcons').mockImplementation(() => undefined);
    jest.spyOn(utils, 'fitMapToTerrain').mockImplementation(() => undefined);
    jest.spyOn(utils, 'createOrUpdateImageOverlay').mockReturnValue(fakeOverlay as never);
    jest.spyOn(utils, 'createSampleTerrainFile').mockReturnValue(
      new File([sampleRecord.bytes], 'sample-terrain.tif', {
        type: 'image/tiff',
        lastModified: 0
      })
    );
    jest.spyOn(utils, 'readTerrainFileBytes').mockResolvedValue(sampleRecord.bytes);
    jest.spyOn(utils, 'openAndParseTerrain').mockResolvedValue({
      metadata: sampleRecord.metadata,
      stats: sampleRecord.stats,
      warnings: [],
      preview: {
        dataUrl: sampleRecord.previewDataUrl!,
        width: 64,
        height: 64
      },
      elevationGrid: sampleRecord.elevationGrid,
      contoursGeoJson: sampleRecord.contoursGeoJson,
      options: {
        colormap: 'terrain',
        displayMode: 'shaded-relief',
        vizPreset: 'colored-relief',
        bandIndex: 0,
        hillshadeAzimuth: 315,
        hillshadeAltitude: 45,
        verticalExaggeration: 1.5,
        showContours: false,
        contourInterval: 25,
        opacity: 0.9
      }
    });
    jest.spyOn(utils, 'createTerrainFileRecord').mockReturnValue(sampleRecord);

    fixture = TestBed.createComponent(TerrainViewerComponent);
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

  it('loads a sample dataset and exposes elevation stats', async () => {
    await component.loadSample();
    await component.loadSample();
    expect(component.currentFile?.name).toBe('sample-terrain.tif');
    expect(component.terrainFiles).toHaveLength(1);
    expect(component.stats?.elevation.range).toBe(150);
    expect(toast.success).toHaveBeenCalled();
    expect(utils.createOrUpdateImageOverlay).toHaveBeenCalled();
  });

  it('rejects invalid files', async () => {
    await component.handleFiles([new File(['plain'], 'notes.txt', { type: 'text/plain' })]);
    expect(component.currentFile).toBeNull();
    expect(toast.error).toHaveBeenCalled();
  });

  it('toggles relief tilt and sidebar', async () => {
    await component.loadSample();
    const event = { target: { checked: true } } as unknown as Event;
    component.toggleReliefTilt(event);
    expect(component.reliefTilt).toBe(true);
    component.toggleSidebar();
    expect(component.sidebarCollapsed).toBe(true);
  });
});
