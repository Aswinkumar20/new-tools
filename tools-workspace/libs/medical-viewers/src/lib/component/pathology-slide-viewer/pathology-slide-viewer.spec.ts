import { ElementRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AssetService, ToastService } from '@tools-workspace/features-home';
import * as pathologyUtils from '../../utils/pathology-slide-viewer.utils';
import { PathologySlideViewerComponent } from './pathology-slide-viewer';

describe('PathologySlideViewerComponent', () => {
  let fixture: ComponentFixture<PathologySlideViewerComponent>;
  let component: PathologySlideViewerComponent;
  const toast = { success: jest.fn(), error: jest.fn(), info: jest.fn() };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PathologySlideViewerComponent],
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

    fixture = TestBed.createComponent(PathologySlideViewerComponent);
    component = fixture.componentInstance;
    const canvas = document.createElement('canvas');
    component.canvasHost = { nativeElement: canvas } as ElementRef<HTMLCanvasElement>;

    const mockImage = {
      naturalWidth: 128,
      naturalHeight: 128,
      width: 128,
      height: 128
    } as HTMLImageElement;
    jest.spyOn(pathologyUtils, 'loadImageFromBytes').mockResolvedValue(mockImage);

    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('loads sample H&E slide with 128×128 dimensions', async () => {
    await component.loadSample();
    expect(component.currentSlide?.name).toBe('sample-he-slide.png');
    expect(component.currentSlide?.fullWidth).toBe(128);
    expect(component.currentSlide?.fullHeight).toBe(128);
    expect(component.slides.length).toBe(1);
  });

  it('tracks annotations and allows deletion', async () => {
    await component.loadSample();
    component.setAnnotationMode('point');
    component['addAnnotation']({ type: 'point', x: 10, y: 20 });
    expect(component.currentAnnotations.length).toBe(1);
    const id = component.currentAnnotations[0].id;
    component.deleteAnnotation(id);
    expect(component.currentAnnotations.length).toBe(0);
  });
});
