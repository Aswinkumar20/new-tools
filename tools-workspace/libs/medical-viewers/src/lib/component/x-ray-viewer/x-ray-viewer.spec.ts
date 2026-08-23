import { ElementRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AssetService, ToastService } from '@tools-workspace/features-home';
import { XRayViewerComponent } from './x-ray-viewer';

describe('XRayViewerComponent', () => {
  let fixture: ComponentFixture<XRayViewerComponent>;
  let component: XRayViewerComponent;
  const toast = { success: jest.fn(), error: jest.fn(), info: jest.fn() };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [XRayViewerComponent],
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

    fixture = TestBed.createComponent(XRayViewerComponent);
    component = fixture.componentInstance;
    const canvas = document.createElement('canvas');
    component.canvasHost = { nativeElement: canvas } as ElementRef<HTMLCanvasElement>;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('loads sample X-ray and exposes geometry stats', async () => {
    await component.loadSample();
    expect(component.currentFile?.name).toBe('sample-chest-xray.dcm');
    expect(component.parsed?.rows).toBe(32);
    expect(component.parsed?.columns).toBe(32);
    expect(component.parsed?.modality).toBe('DX');
    expect(component.xrayFiles.length).toBe(1);
  });

  it('navigates between multiple loaded files', async () => {
    await component.loadSample();
    const first = component.currentFile!;
    const second = {
      ...first,
      id: 'file-2',
      name: 'second-xray.dcm'
    };
    component.xrayFiles = [first, second];
    component.currentFileIndex = 0;
    expect(component.xrayFiles.length).toBe(2);
    component.selectFile(1);
    expect(component.currentFileIndex).toBe(1);
    expect(component.currentFile?.name).toBe('second-xray.dcm');
    component.selectFile(0);
    expect(component.currentFileIndex).toBe(0);
  });
});
