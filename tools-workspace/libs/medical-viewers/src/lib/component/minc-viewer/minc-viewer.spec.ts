import { ElementRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AssetService, ToastService } from '@tools-workspace/features-home';
import { MincViewerComponent } from './minc-viewer';

describe('MincViewerComponent', () => {
  let fixture: ComponentFixture<MincViewerComponent>;
  let component: MincViewerComponent;
  const toast = { success: jest.fn(), error: jest.fn(), info: jest.fn() };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MincViewerComponent],
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

    fixture = TestBed.createComponent(MincViewerComponent);
    component = fixture.componentInstance;
    const canvas = document.createElement('canvas');
    component.canvasHost = { nativeElement: canvas } as ElementRef<HTMLCanvasElement>;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('loads sample brain once and exposes image variable', async () => {
    await component.loadSample();
    await component.loadSample();
    expect(component.currentFile?.name).toBe('sample-brain.mnc');
    expect(component.mincFiles).toHaveLength(1);
    expect(component.parsed?.header.variableName).toBe('image');
    expect(component.parsed?.dims).toEqual([8, 8, 4]);
    expect(component.metadataRows.some((r) => r.key === 'Variable')).toBe(true);
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
