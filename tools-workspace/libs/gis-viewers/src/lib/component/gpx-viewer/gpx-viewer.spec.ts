import { ElementRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AssetService, ToastService } from '@tools-workspace/features-home';
import { GpxViewerComponent } from './gpx-viewer';
import * as utils from '../../utils/gpx-viewer.utils';

describe('GpxViewerComponent', () => {
  let fixture: ComponentFixture<GpxViewerComponent>;
  let component: GpxViewerComponent;
  const toast = { success: jest.fn(), error: jest.fn(), info: jest.fn() };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GpxViewerComponent],
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
    const fakeGroup = {
      addLayer: jest.fn(),
      addTo: jest.fn().mockReturnThis(),
      getBounds: () => fakeBounds
    };
    const pathLayer = () => ({
      bindPopup: jest.fn().mockReturnThis(),
      bindTooltip: jest.fn().mockReturnThis(),
      on: jest.fn().mockReturnThis(),
      setStyle: jest.fn(),
      bringToFront: jest.fn()
    });

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
      featureGroup: jest.fn().mockReturnValue(fakeGroup),
      polyline: jest.fn().mockImplementation(pathLayer),
      circleMarker: jest.fn().mockImplementation(() => ({
        ...pathLayer(),
        addTo: jest.fn().mockReturnThis(),
        setLatLng: jest.fn()
      })),
      Icon: { Default: { prototype: {}, mergeOptions: jest.fn() } }
    } as never);
    jest.spyOn(utils, 'ensureGpxStylesheet').mockImplementation(() => undefined);
    jest.spyOn(utils, 'configureLeafletDefaultIcons').mockImplementation(() => undefined);

    fixture = TestBed.createComponent(GpxViewerComponent);
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

  it('loads a sample dataset once and exposes stats', async () => {
    await component.loadSample();
    await component.loadSample();
    expect(component.currentFile?.name).toBe('coastal-ridge-sample.gpx');
    expect(component.gpxFiles).toHaveLength(1);
    expect(component.stats?.title).toBe('Coastal Ridge Sample');
    expect(component.stats?.avgSpeedMps).toBeGreaterThan(0);
    expect(component.items.length).toBeGreaterThanOrEqual(3);
    expect(component.elevationProfile.length).toBeGreaterThan(3);
    expect(component.profileLine).toContain(',');
    expect(component.sidebarCollapsed).toBe(false);
    expect(component.units).toBe('metric');
  });

  it('toggles units and sidebar', () => {
    expect(component.sidebarCollapsed).toBe(false);
    component.toggleSidebar();
    expect(component.sidebarCollapsed).toBe(true);
    component.toggleUnits();
    expect(component.units).toBe('imperial');
  });

  it('rejects export when nothing is loaded', () => {
    component.exportAs('gpx');
    expect(toast.error).toHaveBeenCalled();
  });
});
