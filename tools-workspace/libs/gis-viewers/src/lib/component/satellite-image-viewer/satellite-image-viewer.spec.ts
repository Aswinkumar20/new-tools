import { ElementRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AssetService, ToastService } from '@tools-workspace/features-home';
import { SatelliteImageViewerComponent } from './satellite-image-viewer';
import * as utils from '../../utils/satellite-image-viewer.utils';
import type { SatelliteLoadedFile } from '../../types/satellite-image-viewer.types';

describe('SatelliteImageViewerComponent', () => {
  let fixture: ComponentFixture<SatelliteImageViewerComponent>;
  let component: SatelliteImageViewerComponent;
  const toast = { success: jest.fn(), error: jest.fn(), info: jest.fn() };

  const sampleRecord: SatelliteLoadedFile = {
    id: 'sample-eo.tif|100|0',
    name: 'sample-eo.tif',
    size: 100,
    bytes: new Uint8Array([1, 2, 3]),
    metadata: {
      width: 64,
      height: 64,
      samplesPerPixel: 3,
      bitsPerSample: 8,
      photometric: 2,
      photometricLabel: 'RGB',
      geoKeys: { GeographicTypeGeoKey: 4326 },
      origin: [-122.45, 37.8, 0],
      resolution: [0.001, -0.001, 0],
      bbox: [-122.45, 37.736, -122.386, 37.8],
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
      title: 'sample-eo',
      width: 64,
      height: 64,
      samplesPerPixel: 3,
      bitsPerSampleLabel: '8',
      photometricLabel: 'RGB',
      compressionLabel: 'Uncompressed',
      tiled: false,
      imageCount: 1,
      bounds: { west: -122.45, south: 37.736, east: -122.386, north: 37.8 },
      nodata: null,
      crsNote: 'Geographic CRS (EPSG:4326 WGS84)'
    },
    warnings: [],
    previewDataUrl: 'data:image/png;base64,AAAA',
    previewWidth: 64,
    previewHeight: 64,
    preset: 'true-color'
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SatelliteImageViewerComponent],
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
        remove: jest.fn()
      }),
      tileLayer: jest.fn().mockReturnValue(fakeLayer),
      imageOverlay: jest.fn().mockReturnValue(fakeOverlay),
      latLngBounds: jest.fn().mockReturnValue({ isValid: () => true }),
      latLng: jest.fn(),
      Icon: { Default: { prototype: {}, mergeOptions: jest.fn() } }
    } as never);

    jest.spyOn(utils, 'ensureSatelliteStylesheet').mockImplementation(() => undefined);
    jest.spyOn(utils, 'configureLeafletDefaultIcons').mockImplementation(() => undefined);
    jest.spyOn(utils, 'fitMapToSatellite').mockImplementation(() => undefined);
    jest.spyOn(utils, 'createOrUpdateImageOverlay').mockReturnValue(fakeOverlay as never);
    jest.spyOn(utils, 'createSampleSatelliteFile').mockReturnValue(
      new File([sampleRecord.bytes], 'sample-eo.tif', {
        type: 'image/tiff',
        lastModified: 0
      })
    );
    jest.spyOn(utils, 'readSatelliteFileBytes').mockResolvedValue(sampleRecord.bytes);
    jest.spyOn(utils, 'openAndParseSatellite').mockResolvedValue({
      metadata: sampleRecord.metadata,
      stats: sampleRecord.stats,
      warnings: [],
      preview: {
        dataUrl: sampleRecord.previewDataUrl!,
        width: 64,
        height: 64
      },
      bands: { red: 0, green: 1, blue: 2, grayscale: false },
      preset: 'true-color'
    });
    jest.spyOn(utils, 'createSatelliteFileRecord').mockReturnValue(sampleRecord);

    fixture = TestBed.createComponent(SatelliteImageViewerComponent);
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

  it('loads sample EO once and exposes stats', async () => {
    await component.loadSample();
    await component.loadSample();
    expect(component.currentFile?.name).toBe('sample-eo.tif');
    expect(component.satelliteFiles).toHaveLength(1);
    expect(component.stats?.width).toBe(64);
    expect(component.preset).toBe('true-color');
    expect(component.ndviEnabled).toBe(false);
    expect(component.sidebarCollapsed).toBe(false);
  });

  it('toggles sidebar', async () => {
    await component.loadSample();
    component.toggleSidebar();
    expect(component.sidebarCollapsed).toBe(true);
  });
});
