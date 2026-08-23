import { ElementRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AssetService, ToastService } from '@tools-workspace/features-home';
import * as wsiUtils from '../../utils/whole-slide-image-viewer.utils';
import { WholeSlideImageViewerComponent } from './whole-slide-image-viewer';

describe('WholeSlideImageViewerComponent', () => {
  let fixture: ComponentFixture<WholeSlideImageViewerComponent>;
  let component: WholeSlideImageViewerComponent;
  const toast = { success: jest.fn(), error: jest.fn(), info: jest.fn() };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WholeSlideImageViewerComponent],
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

    fixture = TestBed.createComponent(WholeSlideImageViewerComponent);
    component = fixture.componentInstance;
    const canvas = document.createElement('canvas');
    const minimap = document.createElement('canvas');
    component.canvasHost = { nativeElement: canvas } as ElementRef<HTMLCanvasElement>;
    component.minimapHost = { nativeElement: minimap } as ElementRef<HTMLCanvasElement>;

    const mockImage = {
      naturalWidth: 128,
      naturalHeight: 128,
      width: 128,
      height: 128
    } as HTMLImageElement;
    jest.spyOn(wsiUtils, 'loadImageFromBytes').mockResolvedValue(mockImage);

    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('loads sample WSI slide and exposes pyramid levels', async () => {
    await component.loadSample();
    expect(component.currentFile?.name).toBe('sample-wsi-slide.png');
    expect(component.currentFile?.fullWidth).toBeGreaterThan(0);
    expect(component.currentFile?.pyramidLevelCount).toBeGreaterThan(1);
    expect(component.pyramidLevelCount).toBeGreaterThan(1);
    expect(component.slideFiles.length).toBe(1);
  });
});
