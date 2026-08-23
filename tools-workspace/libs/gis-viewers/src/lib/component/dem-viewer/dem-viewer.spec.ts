import { ElementRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AssetService, ToastService } from '@tools-workspace/features-home';
import { DemViewerComponent } from './dem-viewer';
import * as utils from '../../utils/dem-viewer.utils';
import type { DemLoadedFile } from '../../types/dem-viewer.types';

describe('DemViewerComponent', () => {
  let fixture: ComponentFixture<DemViewerComponent>;
  let component: DemViewerComponent;
  const toast = { success: jest.fn(), error: jest.fn(), info: jest.fn() };

  const sampleRecord: DemLoadedFile = {
    id: 'sample-hill.tif|100|0',
    name: 'sample-hill.tif',
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
      title: 'sample-hill',
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
      previewHeight: 64
    },
    warnings: [],
    previewDataUrl: 'data:image/png;base64,AAAA',
    previewWidth: 64,
    previewHeight: 64,
    elevationGrid: new Float64Array(64 * 64).fill(150),
    gridWidth: 64,
    gridHeight: 64
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DemViewerComponent],
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

    jest.spyOn(utils, 'ensureDemStylesheet').mockImplementation(() => undefined);
    jest.spyOn(utils, 'configureLeafletDefaultIcons').mockImplementation(() => undefined);
    jest.spyOn(utils, 'fitMapToDem').mockImplementation(() => undefined);
    jest.spyOn(utils, 'createOrUpdateImageOverlay').mockReturnValue(fakeOverlay as never);
    jest.spyOn(utils, 'createSampleDemFile').mockReturnValue(
      new File([sampleRecord.bytes], 'sample-hill.tif', {
        type: 'image/tiff',
        lastModified: 0
      })
    );
    jest.spyOn(utils, 'readDemFileBytes').mockResolvedValue(sampleRecord.bytes);
    jest.spyOn(utils, 'openAndParseDem').mockResolvedValue({
      metadata: sampleRecord.metadata,
      stats: sampleRecord.stats,
      warnings: [],
      preview: {
        dataUrl: sampleRecord.previewDataUrl!,
        width: 64,
        height: 64
      },
      elevationGrid: sampleRecord.elevationGrid,
      options: {
        colormap: 'terrain',
        displayMode: 'shaded-relief',
        bandIndex: 0,
        hillshadeAzimuth: 315,
        hillshadeAltitude: 45,
        opacity: 0.9
      }
    });
    jest.spyOn(utils, 'createDemFileRecord').mockReturnValue(sampleRecord);

    fixture = TestBed.createComponent(DemViewerComponent);
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
    expect(component.currentFile?.name).toBe('sample-hill.tif');
    expect(component.demFiles).toHaveLength(1);
    expect(component.stats?.elevation.min).toBe(100);
    expect(component.stats?.elevation.max).toBe(250);
    expect(toast.success).toHaveBeenCalled();
    expect(utils.createOrUpdateImageOverlay).toHaveBeenCalled();
  });

  it('rejects invalid files', async () => {
    await component.handleFiles([new File(['plain'], 'notes.txt', { type: 'text/plain' })]);
    expect(component.currentFile).toBeNull();
    expect(toast.error).toHaveBeenCalled();
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
