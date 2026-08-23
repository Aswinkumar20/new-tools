import { ElementRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AssetService, ToastService } from '@tools-workspace/features-home';
import { MbtilesViewerComponent } from './mbtiles-viewer';
import * as utils from '../../utils/mbtiles-viewer.utils';
import type { MbtilesLoadedFile } from '../../types/mbtiles-viewer.types';

describe('MbtilesViewerComponent', () => {
  let fixture: ComponentFixture<MbtilesViewerComponent>;
  let component: MbtilesViewerComponent;
  const toast = { success: jest.fn(), error: jest.fn(), info: jest.fn() };

  const sampleRecord: MbtilesLoadedFile = {
    id: 'sample-world.mbtiles|12288|0',
    name: 'sample-world.mbtiles',
    size: 12288,
    bytes: new Uint8Array([1, 2, 3]),
    metadata: {
      name: 'Sample MBTiles',
      format: 'png',
      bounds: { west: -180, south: -85, east: 180, north: 85 },
      center: { lon: 0, lat: 0, zoom: 0 },
      minzoom: 0,
      maxzoom: 2,
      description: 'Tiny sample',
      type: 'baselayer',
      version: '1.1',
      attribution: null,
      raw: {
        name: 'Sample MBTiles',
        format: 'png',
        bounds: '-180,-85,180,85',
        center: '0,0,0',
        minzoom: '0',
        maxzoom: '2',
        description: 'Tiny sample',
        type: 'baselayer',
        version: '1.1'
      }
    },
    stats: {
      title: 'Sample MBTiles',
      tileCount: 21,
      minZoom: 0,
      maxZoom: 2,
      format: 'png',
      type: 'baselayer',
      version: '1.1',
      bounds: { west: -180, south: -85, east: 180, north: 85 },
      center: { lon: 0, lat: 0, zoom: 0 },
      attribution: null,
      description: 'Tiny sample',
      isVectorFormat: false
    },
    warnings: []
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MbtilesViewerComponent],
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
        setMinZoom: jest.fn(),
        setMaxZoom: jest.fn(),
        zoomIn: jest.fn(),
        zoomOut: jest.fn(),
        getZoom: jest.fn().mockReturnValue(2),
        on: jest.fn(),
        remove: jest.fn()
      }),
      tileLayer: jest.fn().mockReturnValue(fakeLayer),
      GridLayer: {
        extend: jest.fn().mockReturnValue(
          function FakeGrid() {
            return fakeLayer;
          }
        )
      },
      latLngBounds: jest.fn().mockReturnValue({ isValid: () => true }),
      latLng: jest.fn(),
      Icon: { Default: { prototype: {}, mergeOptions: jest.fn() } }
    } as never);

    jest.spyOn(utils, 'ensureMbtilesStylesheet').mockImplementation(() => undefined);
    jest.spyOn(utils, 'configureLeafletDefaultIcons').mockImplementation(() => undefined);
    jest.spyOn(utils, 'openAndParseMbtiles').mockResolvedValue({
      db: { close: jest.fn() } as never,
      metadata: sampleRecord.metadata,
      stats: sampleRecord.stats,
      warnings: []
    });
    jest.spyOn(utils, 'openSqliteDatabase').mockResolvedValue({ close: jest.fn() } as never);
    jest.spyOn(utils, 'closeDatabase').mockImplementation(() => undefined);
    jest.spyOn(utils, 'createMbtilesGridLayer').mockReturnValue(fakeLayer as never);
    jest.spyOn(utils, 'fitMapToMbtiles').mockImplementation(() => undefined);
    jest.spyOn(utils, 'createSampleMbtilesFile').mockReturnValue(
      new File([sampleRecord.bytes], 'sample-world.mbtiles', {
        type: 'application/x-sqlite3',
        lastModified: 0
      })
    );
    jest.spyOn(utils, 'readMbtilesFileBytes').mockResolvedValue(sampleRecord.bytes);
    jest.spyOn(utils, 'createMbtilesFileRecord').mockReturnValue(sampleRecord);

    fixture = TestBed.createComponent(MbtilesViewerComponent);
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
    expect(component.currentFile?.name).toBe('sample-world.mbtiles');
    expect(component.mbtilesFiles).toHaveLength(1);
    expect(component.stats?.title).toBe('Sample MBTiles');
    expect(component.stats?.tileCount).toBe(21);
    expect(toast.success).toHaveBeenCalled();
    expect(utils.openSqliteDatabase).toHaveBeenCalled();
    expect(utils.createMbtilesGridLayer).toHaveBeenCalled();
  });

  it('rejects invalid files', async () => {
    await component.handleFiles([new File(['plain'], 'notes.txt', { type: 'text/plain' })]);
    expect(component.currentFile).toBeNull();
    expect(toast.error).toHaveBeenCalled();
  });

  it('exports summary JSON after load', async () => {
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
    component.exportAs('summary-json');
    expect(toast.success).toHaveBeenCalledWith('Exported summary JSON');
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
