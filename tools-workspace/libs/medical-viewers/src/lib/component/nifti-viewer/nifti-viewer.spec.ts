import { ElementRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AssetService, ToastService } from '@tools-workspace/features-home';
import { NiftiViewerComponent } from './nifti-viewer';

describe('NiftiViewerComponent', () => {
  let fixture: ComponentFixture<NiftiViewerComponent>;
  let component: NiftiViewerComponent;
  const toast = { success: jest.fn(), error: jest.fn(), info: jest.fn() };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NiftiViewerComponent],
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

    fixture = TestBed.createComponent(NiftiViewerComponent);
    component = fixture.componentInstance;
    const canvas = document.createElement('canvas');
    component.canvasHost = { nativeElement: canvas } as ElementRef<HTMLCanvasElement>;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('loads sample brain once and exposes dims', async () => {
    await component.loadSample();
    await component.loadSample();
    expect(component.currentFile?.name).toBe('sample-brain.nii');
    expect(component.niftiFiles).toHaveLength(1);
    expect(component.parsed?.dims).toEqual([16, 16, 8]);
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
