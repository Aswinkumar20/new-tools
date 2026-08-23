import { ElementRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AssetService, ToastService } from '@tools-workspace/features-home';
import { CtScanViewerComponent } from './ct-scan-viewer';

describe('CtScanViewerComponent', () => {
  let fixture: ComponentFixture<CtScanViewerComponent>;
  let component: CtScanViewerComponent;
  const toast = { success: jest.fn(), error: jest.fn(), info: jest.fn() };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CtScanViewerComponent],
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

    fixture = TestBed.createComponent(CtScanViewerComponent);
    component = fixture.componentInstance;
    const canvas = document.createElement('canvas');
    component.canvasHost = { nativeElement: canvas } as ElementRef<HTMLCanvasElement>;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('loads sample CT and exposes geometry stats', async () => {
    await component.loadSample();
    expect(component.currentFile?.name).toBe('sample-chest-ct.dcm');
    expect(component.parsed?.rows).toBe(32);
    expect(component.parsed?.columns).toBe(32);
    expect(component.parsed?.modality).toBe('CT');
  });

  it('measures distance and clears measure', async () => {
    await component.loadSample();
    component.measureMode = true;
    const parsed = component.parsed!;
    // Force spacing for mm assertion
    if (parsed) {
      (parsed as { pixelSpacing: [number, number] }).pixelSpacing = [1, 1];
    }
    component.measurePending = { x: 0, y: 0 };
    const { buildMeasureResult } = await import('../../utils/ct-scan-viewer.utils');
    component.measure = buildMeasureResult({ x: 0, y: 0 }, { x: 3, y: 4 }, [1, 1]);
    expect(component.measure.distancePx).toBe(5);
    expect(component.measure.distanceMm).toBeCloseTo(5, 5);
    component.clearMeasure();
    expect(component.measure).toBeNull();
    expect(component.measurePending).toBeNull();
  });
});
