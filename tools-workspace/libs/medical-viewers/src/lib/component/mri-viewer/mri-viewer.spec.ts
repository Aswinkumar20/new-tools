import { ElementRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AssetService, ToastService } from '@tools-workspace/features-home';
import { MriViewerComponent } from './mri-viewer';

describe('MriViewerComponent', () => {
  let fixture: ComponentFixture<MriViewerComponent>;
  let component: MriViewerComponent;
  const toast = { success: jest.fn(), error: jest.fn(), info: jest.fn() };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MriViewerComponent],
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

    fixture = TestBed.createComponent(MriViewerComponent);
    component = fixture.componentInstance;
    const canvas = document.createElement('canvas');
    component.canvasHost = { nativeElement: canvas } as ElementRef<HTMLCanvasElement>;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('loads sample MRI and exposes geometry stats', async () => {
    await component.loadSample();
    expect(component.currentFile?.name).toBe('sample-brain-mr.dcm');
    expect(component.parsed?.rows).toBe(32);
    expect(component.parsed?.columns).toBe(32);
    expect(component.parsed?.modality).toBe('MR');
    expect(component.seriesGroups.length).toBeGreaterThanOrEqual(1);
  });

  it('navigates series slices when multiple files share a series', async () => {
    await component.loadSample();
    const first = component.currentFile!;
    const seriesUid = '1.2.840.10008.5.1.4.1.1.4.series-test';
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
    component.mriFiles = [sliceA, sliceB];
    (component as unknown as { rebuildSeries: (n?: number) => void }).rebuildSeries(0);
    expect(component.seriesFiles.length).toBe(2);
    component.selectFile(1);
    expect(component.currentFileIndex).toBe(1);
    component.selectFile(0);
    expect(component.currentFileIndex).toBe(0);
  });
});
