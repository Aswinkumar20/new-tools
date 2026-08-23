import { ElementRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AssetService, ToastService } from '@tools-workspace/features-home';
import { PointCloudViewerComponent } from './point-cloud-viewer';
import * as renderUtils from '../../utils/point-cloud-render.utils';

describe('PointCloudViewerComponent', () => {
  let fixture: ComponentFixture<PointCloudViewerComponent>;
  let component: PointCloudViewerComponent;
  const toast = { success: jest.fn(), error: jest.fn(), info: jest.fn() };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PointCloudViewerComponent],
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

    jest.spyOn(renderUtils, 'renderPointCloudCanvas').mockReturnValue('data:image/png;base64,AAAA');

    fixture = TestBed.createComponent(PointCloudViewerComponent);
    component = fixture.componentInstance;
    const canvas = document.createElement('canvas');
    component.canvasHost = { nativeElement: canvas } as ElementRef<HTMLCanvasElement>;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('loads sample PLY once and exposes stats', async () => {
    await component.loadSample();
    await component.loadSample();
    expect(component.currentFile?.name).toBe('sample-cloud.ply');
    expect(component.cloudFiles).toHaveLength(1);
    expect(component.stats?.previewCount).toBe(256);
    expect(component.stats?.hasRgb).toBe(true);
    expect(component.sidebarCollapsed).toBe(false);
  });

  it('toggles sidebar and rejects empty export', async () => {
    await component.loadSample();
    component.toggleSidebar();
    expect(component.sidebarCollapsed).toBe(true);
    component.clearAll();
    component.exportAs('original');
    expect(toast.error).toHaveBeenCalled();
  });
});
