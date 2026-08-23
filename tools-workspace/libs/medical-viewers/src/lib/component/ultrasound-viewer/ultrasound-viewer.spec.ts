import { ElementRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AssetService, ToastService } from '@tools-workspace/features-home';
import { UltrasoundViewerComponent } from './ultrasound-viewer';

describe('UltrasoundViewerComponent', () => {
  let fixture: ComponentFixture<UltrasoundViewerComponent>;
  let component: UltrasoundViewerComponent;
  const toast = { success: jest.fn(), error: jest.fn(), info: jest.fn() };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UltrasoundViewerComponent],
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

    fixture = TestBed.createComponent(UltrasoundViewerComponent);
    component = fixture.componentInstance;
    const canvas = document.createElement('canvas');
    component.canvasHost = { nativeElement: canvas } as ElementRef<HTMLCanvasElement>;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('loads sample abdominal US and exposes geometry stats', async () => {
    await component.loadSample();
    expect(component.currentFile?.name).toBe('sample-abdominal-us.dcm');
    expect(component.parsed?.rows).toBe(32);
    expect(component.parsed?.columns).toBe(32);
    expect(component.parsed?.modality).toBe('US');
    expect(component.seriesGroups.length).toBeGreaterThanOrEqual(1);
  });

  it('reports single-frame cine count for sample US', async () => {
    await component.loadSample();
    expect(component.cineMode).toBe('single');
    expect(component.cineFrameCount).toBe(1);
    expect(component.isCine).toBe(false);
  });

  it('navigates multi-file cine frames via currentFileIndex', async () => {
    await component.loadSample();
    const first = component.currentFile!;
    const seriesUid = '1.2.840.10008.5.1.4.1.1.4.us-series-test';
    const frameA = {
      ...first,
      id: 'us-frame-1',
      name: 'us-frame-1.dcm',
      parsed: first.parsed
        ? {
            ...first.parsed,
            instanceNumber: 1,
            seriesInstanceUid: seriesUid
          }
        : null
    };
    const frameB = {
      ...first,
      id: 'us-frame-2',
      name: 'us-frame-2.dcm',
      parsed: first.parsed
        ? {
            ...first.parsed,
            instanceNumber: 2,
            seriesInstanceUid: seriesUid
          }
        : null
    };
    component.usFiles = [frameA, frameB];
    (component as unknown as { rebuildSeries: (n?: number) => void }).rebuildSeries(0);
    expect(component.cineMode).toBe('multi-file');
    expect(component.cineFrameCount).toBe(2);
    component.selectCineFrame(1);
    expect(component.currentFileIndex).toBe(1);
    component.selectCineFrame(0);
    expect(component.currentFileIndex).toBe(0);
  });
});
