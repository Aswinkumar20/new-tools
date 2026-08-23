import { ElementRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AssetService, ToastService } from '@tools-workspace/features-home';
import { PetScanViewerComponent } from './pet-scan-viewer';

describe('PetScanViewerComponent', () => {
  let fixture: ComponentFixture<PetScanViewerComponent>;
  let component: PetScanViewerComponent;
  const toast = { success: jest.fn(), error: jest.fn(), info: jest.fn() };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PetScanViewerComponent],
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

    fixture = TestBed.createComponent(PetScanViewerComponent);
    component = fixture.componentInstance;
    const canvas = document.createElement('canvas');
    component.canvasHost = { nativeElement: canvas } as ElementRef<HTMLCanvasElement>;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('loads sample FDG PET and exposes PT geometry', async () => {
    await component.loadSample();
    expect(component.currentFile?.name).toBe('sample-fdg-pet.dcm');
    expect(component.parsed?.rows).toBe(32);
    expect(component.parsed?.columns).toBe(32);
    expect(component.parsed?.modality).toBe('PT');
    expect(component.seriesGroups.length).toBeGreaterThanOrEqual(1);
    expect(component.colormap).toBe('hot');
  });

  it('probes SUV on canvas click for PT sample', async () => {
    await component.loadSample();
    const canvas = component.canvasHost.nativeElement;
    canvas.width = 320;
    canvas.height = 240;
    component.zoom = 1;
    (component as unknown as { panX: number; panY: number }).panX = 0;
    (component as unknown as { panX: number; panY: number }).panY = 0;

    jest.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: 320,
      height: 240,
      right: 320,
      bottom: 240,
      x: 0,
      y: 0,
      toJSON: () => ({})
    });

    const ox = (320 - 32) / 2;
    const oy = (240 - 32) / 2;
    const event = new MouseEvent('click', { clientX: ox + 16, clientY: oy + 16 });
    component.onCanvasClick(event);

    expect(component.probe).not.toBeNull();
    expect(component.probe?.suv).not.toBeNull();
    expect(typeof component.probe?.suv).toBe('number');
  });

  it('navigates series slices when multiple files share a series', async () => {
    await component.loadSample();
    const first = component.currentFile!;
    const seriesUid = '1.2.840.10008.5.1.4.1.1.4.pet-series-test';
    const sliceA = {
      ...first,
      id: 'slice-1',
      name: 'slice-1.dcm',
      parsed: first.parsed
        ? {
            ...first.parsed,
            instanceNumber: 1,
            seriesInstanceUid: seriesUid
          }
        : null
    };
    const sliceB = {
      ...first,
      id: 'slice-2',
      name: 'slice-2.dcm',
      parsed: first.parsed
        ? {
            ...first.parsed,
            instanceNumber: 2,
            seriesInstanceUid: seriesUid
          }
        : null
    };
    component.petFiles = [sliceA, sliceB];
    (component as unknown as { rebuildSeries: (n?: number) => void }).rebuildSeries(0);
    expect(component.seriesFiles.length).toBe(2);
    component.selectFile(1);
    expect(component.currentFileIndex).toBe(1);
    component.selectFile(0);
    expect(component.currentFileIndex).toBe(0);
  });
});
