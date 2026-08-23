import { ElementRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AssetService, ToastService } from '@tools-workspace/features-home';
import { VectorTileViewerComponent } from './vector-tile-viewer';
import * as utils from '../../utils/vector-tile-viewer.utils';
import type { VectorTileLoadedFile } from '../../types/vector-tile-viewer.types';

describe('VectorTileViewerComponent', () => {
  let fixture: ComponentFixture<VectorTileViewerComponent>;
  let component: VectorTileViewerComponent;
  const toast = { success: jest.fn(), error: jest.fn(), info: jest.fn() };

  const sampleRecord: VectorTileLoadedFile = {
    id: 'sample-landuse.mvt|61|0',
    name: 'sample-landuse.mvt',
    size: 61,
    bytes: new Uint8Array([1, 2, 3]),
    tile: {
      layers: [
        {
          name: 'landuse',
          version: 2,
          extent: 4096,
          keys: ['name'],
          values: [{ kind: 'string', value: 'Park' }],
          features: []
        }
      ]
    },
    geojson: {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          id: 1,
          properties: { name: 'Park', layer: 'landuse' },
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [-10, 10],
                [10, 10],
                [10, -10],
                [-10, -10],
                [-10, 10]
              ]
            ]
          }
        }
      ]
    },
    layers: [
      { name: 'landuse', featureCount: 1, extent: 4096, visible: true, color: '#0d9488' }
    ],
    stats: {
      title: 'sample-landuse',
      layerCount: 1,
      featureCount: 1,
      extent: 4096,
      z: 0,
      x: 0,
      y: 0,
      bounds: { west: -180, south: -85, east: 180, north: 85 },
      sourceKind: 'mvt'
    },
    warnings: [],
    z: 0,
    x: 0,
    y: 0
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VectorTileViewerComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ToastService, useValue: toast },
        { provide: AssetService, useValue: { getAssetPath: (path: string) => `/assets/${path}` } }
      ]
    }).compileComponents();

    const fakeLayer = {
      addTo: jest.fn().mockReturnThis(),
      getBounds: jest.fn().mockReturnValue({ isValid: () => true }),
      on: jest.fn()
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
        getZoom: jest.fn().mockReturnValue(2),
        on: jest.fn(),
        remove: jest.fn()
      }),
      tileLayer: jest.fn().mockReturnValue({ addTo: jest.fn().mockReturnThis() }),
      geoJSON: jest.fn().mockReturnValue(fakeLayer),
      circleMarker: jest.fn().mockReturnValue({}),
      latLngBounds: jest.fn().mockReturnValue({ isValid: () => true }),
      latLng: jest.fn(),
      Icon: { Default: { prototype: {}, mergeOptions: jest.fn() } }
    } as never);

    jest.spyOn(utils, 'ensureVectorTileStylesheet').mockImplementation(() => undefined);
    jest.spyOn(utils, 'configureLeafletDefaultIcons').mockImplementation(() => undefined);
    jest.spyOn(utils, 'fitMapToVectorTile').mockImplementation(() => undefined);
    jest.spyOn(utils, 'createGeoJsonLayer').mockReturnValue(fakeLayer as never);
    jest.spyOn(utils, 'createSampleVectorTileFile').mockReturnValue(
      new File([sampleRecord.bytes!], 'sample-landuse.mvt', {
        type: 'application/vnd.mapbox-vector-tile',
        lastModified: 0
      })
    );
    jest.spyOn(utils, 'readVectorTileFileBytes').mockResolvedValue(sampleRecord.bytes!);
    jest.spyOn(utils, 'openAndParseMvtBytes').mockReturnValue({
      tile: sampleRecord.tile!,
      geojson: sampleRecord.geojson,
      layers: sampleRecord.layers,
      stats: sampleRecord.stats,
      warnings: []
    });
    jest.spyOn(utils, 'createVectorTileFileRecord').mockReturnValue(sampleRecord);

    fixture = TestBed.createComponent(VectorTileViewerComponent);
    component = fixture.componentInstance;
    component.mapHost = { nativeElement: document.createElement('div') } as ElementRef<HTMLDivElement>;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('loads a sample tile and exposes layer stats', async () => {
    await component.loadSample();
    expect(component.currentFile?.name).toBe('sample-landuse.mvt');
    expect(component.tileFiles).toHaveLength(1);
    expect(component.stats?.featureCount).toBe(1);
    expect(toast.success).toHaveBeenCalled();
    expect(utils.createGeoJsonLayer).toHaveBeenCalled();
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
