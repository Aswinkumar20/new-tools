import { ElementRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AssetService, ToastService } from '@tools-workspace/features-home';
import { MammographyViewerComponent } from './mammography-viewer';

describe('MammographyViewerComponent', () => {
  let fixture: ComponentFixture<MammographyViewerComponent>;
  let component: MammographyViewerComponent;
  const toast = { success: jest.fn(), error: jest.fn(), info: jest.fn() };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MammographyViewerComponent],
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

    fixture = TestBed.createComponent(MammographyViewerComponent);
    component = fixture.componentInstance;
    const canvas = document.createElement('canvas');
    component.canvasHost = { nativeElement: canvas } as ElementRef<HTMLCanvasElement>;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('loads sample MG and exposes geometry stats', async () => {
    await component.loadSample();
    expect(component.currentFile?.name).toBe('sample-mg-screening.dcm');
    expect(component.parsed?.rows).toBe(32);
    expect(component.parsed?.columns).toBe(32);
    expect(component.parsed?.modality).toBe('MG');
    expect(component.mgFiles.length).toBe(1);
  });

  it('toggles hanging view mode', async () => {
    await component.loadSample();
    expect(component.viewMode).toBe('single');

    component.setViewMode('hanging');
    expect(component.viewMode).toBe('hanging');
    expect(component.hangingCells.length).toBe(4);
    expect(component.assignedHangingCount).toBe(0);

    component.setViewMode('single');
    expect(component.viewMode).toBe('single');
  });

  it('navigates between multiple loaded files in single mode', async () => {
    await component.loadSample();
    component.setViewMode('single');
    const first = component.currentFile!;
    const second = {
      ...first,
      id: 'file-2',
      name: 'second-mg.dcm'
    };
    component.mgFiles = [first, second];
    component.currentFileIndex = 0;
    expect(component.mgFiles.length).toBe(2);
    component.selectFile(1);
    expect(component.currentFileIndex).toBe(1);
    expect(component.currentFile?.name).toBe('second-mg.dcm');
    component.selectFile(0);
    expect(component.currentFileIndex).toBe(0);
  });
});
