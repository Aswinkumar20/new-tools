import { ElementRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AssetService, ToastService } from '@tools-workspace/features-home';
import { RasterMapViewerComponent } from './raster-map-viewer';
import * as utils from '../../utils/raster-map-viewer.utils';
import type { RasterMapLoadedFile } from '../../types/raster-map-viewer.types';

describe('RasterMapViewerComponent', () => {
  let fixture: ComponentFixture<RasterMapViewerComponent>;
  let component: RasterMapViewerComponent;
  const toast = { success: jest.fn(), error: jest.fn(), info: jest.fn() };

  const sampleRecord: RasterMapLoadedFile = {
    id: 'sample-raster.asc|200|0',
    name: 'sample-raster.asc',
    size: 200,
    bytes: new Uint8Array([1, 2, 3]),
    sourceKind: 'asc',
    metadata: null,
    stats: {
      title: 'sample-raster',
      width: 8,
      height: 8,
      samplesPerPixel: 1,
      cellSize: 0.01,
      nodata: -9999,
      bounds: { west: -122.45, south: 37.75, east: -122.37, north: 37.83 },
      crsNote: 'ASCII Grid',
      values: { min: 10, max: 50, mean: 25, range: 40, validCount: 64 },
      bandIndex: 0,
      previewWidth: 8,
      previewHeight: 8,
      sourceKind: 'asc',
      displayMode: 'colormap',
      stretch: 'minmax',
      colormap: 'viridis'
    },
    warnings: [],
    previewDataUrl: 'data:image/png;base64,AAAA',
    previewWidth: 8,
    previewHeight: 8,
    valueGrid: new Float64Array(64).fill(20),
    gridWidth: 8,
    gridHeight: 8,
    ascText: 'ncols 8'
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RasterMapViewerComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ToastService, useValue: toast },
        { provide: AssetService, useValue: { getAssetPath: (path: string) => `/assets/${path}` } }
      ]
    }).compileComponents();

    const fakeOverlay = {
      addTo: jest.fn().mockReturnThis(),
      setOpacity: jest.fn(),
      setUrl: jest.fn(),
      setBounds: jest.fn()
    };

    jest.spyOn(utils, 'loadLeaflet').mockResolvedValue({
      map: jest.fn().mockReturnValue({
        setView: jest.fn().mockReturnThis(),
        addLayer: jest.fn(),
        removeLayer: jest.fn(),
        invalidateSize: jest.fn(),
        fitBounds: jest.fn(),
        zoomIn: jest.fn(),
        zoomOut: jest.fn(),
        getZoom: jest.fn().mockReturnValue(12),
        on: jest.fn(),
        remove: jest.fn()
      }),
      tileLayer: jest.fn().mockReturnValue({ addTo: jest.fn().mockReturnThis() }),
      imageOverlay: jest.fn().mockReturnValue(fakeOverlay),
      latLngBounds: jest.fn().mockReturnValue({ isValid: () => true }),
      latLng: jest.fn(),
      Icon: { Default: { prototype: {}, mergeOptions: jest.fn() } }
    } as never);

    jest.spyOn(utils, 'ensureRasterMapStylesheet').mockImplementation(() => undefined);
    jest.spyOn(utils, 'configureLeafletDefaultIcons').mockImplementation(() => undefined);
    jest.spyOn(utils, 'fitMapToRaster').mockImplementation(() => undefined);
    jest.spyOn(utils, 'createOrUpdateImageOverlay').mockReturnValue(fakeOverlay as never);
    jest.spyOn(utils, 'createSampleRasterMapFile').mockReturnValue(
      new File([sampleRecord.bytes], 'sample-raster.asc', { type: 'text/plain', lastModified: 0 })
    );
    jest.spyOn(utils, 'readRasterMapFileBytes').mockResolvedValue(sampleRecord.bytes);
    jest.spyOn(utils, 'openAndParseRaster').mockResolvedValue({
      sourceKind: 'asc',
      metadata: null,
      stats: sampleRecord.stats,
      warnings: [],
      preview: { dataUrl: sampleRecord.previewDataUrl!, width: 8, height: 8 },
      valueGrid: sampleRecord.valueGrid,
      options: {
        stretch: 'minmax',
        colormap: 'viridis',
        bandIndex: 0,
        opacity: 0.9,
        rgbMode: false,
        red: 0,
        green: 0,
        blue: 0
      },
      ascText: sampleRecord.ascText
    });
    jest.spyOn(utils, 'createRasterMapFileRecord').mockReturnValue(sampleRecord);

    fixture = TestBed.createComponent(RasterMapViewerComponent);
    component = fixture.componentInstance;
    component.mapHost = { nativeElement: document.createElement('div') } as ElementRef<HTMLDivElement>;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('loads a sample ASC and shows value stats', async () => {
    await component.loadSample();
    expect(component.currentFile?.name).toBe('sample-raster.asc');
    expect(component.rasterFiles).toHaveLength(1);
    expect(component.stats?.values.min).toBe(10);
    expect(component.stats?.values.max).toBe(50);
    expect(toast.success).toHaveBeenCalled();
    expect(utils.createOrUpdateImageOverlay).toHaveBeenCalled();
  });

  it('rejects invalid files', async () => {
    await component.handleFiles([new File(['plain'], 'notes.txt', { type: 'text/plain' })]);
    expect(component.currentFile).toBeNull();
    expect(toast.error).toHaveBeenCalled();
  });

  it('toggles the sidebar and opens the file picker', () => {
    const click = jest.fn();
    component.fileInput = {
      nativeElement: { click }
    } as unknown as ElementRef<HTMLInputElement>;
    component.toggleSidebar();
    expect(component.sidebarCollapsed).toBe(true);
    component.openFilePicker();
    expect(click).toHaveBeenCalled();
  });
});
