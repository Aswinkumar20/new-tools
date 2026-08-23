import { ElementRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AssetService, ToastService } from '@tools-workspace/features-home';
import { DicomViewerComponent } from './dicom-viewer';

describe('DicomViewerComponent', () => {
  let fixture: ComponentFixture<DicomViewerComponent>;
  let component: DicomViewerComponent;
  const toast = { success: jest.fn(), error: jest.fn(), info: jest.fn() };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DicomViewerComponent],
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

    fixture = TestBed.createComponent(DicomViewerComponent);
    component = fixture.componentInstance;
    const canvas = document.createElement('canvas');
    component.canvasHost = { nativeElement: canvas } as ElementRef<HTMLCanvasElement>;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('loads sample DICOM once and exposes geometry', async () => {
    await component.loadSample();
    await component.loadSample();
    expect(component.currentFile?.name).toBe('sample-scout.dcm');
    expect(component.dicomFiles.length).toBeGreaterThanOrEqual(1);
    expect(component.parsed?.rows).toBe(32);
    expect(component.parsed?.columns).toBe(32);
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

  it('exposes multi-frame state and filters metadata tags', async () => {
    await component.loadSample();
    expect(component.frameCount).toBeGreaterThanOrEqual(1);
    expect(component.frameIndex).toBe(0);
    const allRows = component.parsed?.metadataRows?.length ?? 0;
    component.metadataQuery = 'zzzz-no-match';
    expect(component.filteredMetadataRows.length).toBe(0);
    component.metadataQuery = '';
    expect(component.filteredMetadataRows.length).toBe(allRows);
  });
});
