import { ElementRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AssetService, ToastService } from '@tools-workspace/features-home';
import { LidarMapViewerComponent } from './lidar-map-viewer';
import * as utils from '../../utils/lidar-map-viewer.utils';

describe('LidarMapViewerComponent', () => {
  let fixture: ComponentFixture<LidarMapViewerComponent>;
  let component: LidarMapViewerComponent;
  const toast = { success: jest.fn(), error: jest.fn(), info: jest.fn() };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LidarMapViewerComponent],
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

    const fakeBounds = { isValid: () => true };
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
      tileLayer: jest.fn().mockReturnValue({ addTo: jest.fn() }),
      imageOverlay: jest.fn().mockReturnValue({
        addTo: jest.fn().mockReturnThis(),
        getBounds: () => fakeBounds,
        setUrl: jest.fn(),
        setOpacity: jest.fn()
      }),
      featureGroup: jest.fn().mockReturnValue({
        addLayer: jest.fn(),
        addTo: jest.fn().mockReturnThis(),
        getBounds: () => fakeBounds
      }),
      circleMarker: jest.fn().mockReturnValue({
        bindTooltip: jest.fn().mockReturnThis(),
        addTo: jest.fn().mockReturnThis()
      }),
      Icon: { Default: { prototype: {}, mergeOptions: jest.fn() } }
    } as never);
    jest.spyOn(utils, 'ensureLidarStylesheet').mockImplementation(() => undefined);
    jest.spyOn(utils, 'configureLeafletDefaultIcons').mockImplementation(() => undefined);
    jest.spyOn(utils, 'renderLidarCanvas').mockReturnValue({
      dataUrl: 'data:image/png;base64,AAAA',
      bounds: [
        [37.76, -122.43],
        [37.78, -122.41]
      ]
    });

    fixture = TestBed.createComponent(LidarMapViewerComponent);
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

  it('loads sample LAS once and exposes stats', async () => {
    await component.loadSample();
    await component.loadSample();
    expect(component.currentFile?.name).toBe('sample-block.las');
    expect(component.lidarFiles).toHaveLength(1);
    expect(component.stats?.pointCount).toBe(256);
    expect(component.stats?.looksGeographic).toBe(true);
    expect(component.classEntries.length).toBeGreaterThan(0);
    expect(component.sidebarCollapsed).toBe(false);
  });

  it('toggles sidebar and class filters', async () => {
    await component.loadSample();
    component.toggleSidebar();
    expect(component.sidebarCollapsed).toBe(true);
    const code = component.classEntries[0]?.classification;
    expect(code).toBeDefined();
    component.toggleClass(code);
    expect(component.isClassEnabled(code)).toBe(false);
  });

  it('rejects export when nothing is loaded', () => {
    component.exportAs('original');
    expect(toast.error).toHaveBeenCalled();
  });
});
