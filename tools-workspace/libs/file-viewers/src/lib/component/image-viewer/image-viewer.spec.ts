import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ToastService } from '@tools-workspace/features-home';
import { fileViewerTestProviders } from '../../shared/file-viewer-test.utils';
import { ImageViewerComponent } from './image-viewer';

describe('ImageViewerComponent', () => {
  let component: ImageViewerComponent;
  let fixture: ComponentFixture<ImageViewerComponent>;
  let toast: { info: jest.Mock; error: jest.Mock; success: jest.Mock };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ImageViewerComponent],
      providers: [...fileViewerTestProviders(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(ImageViewerComponent);
    component = fixture.componentInstance;
    toast = TestBed.inject(ToastService) as unknown as {
      info: jest.Mock;
      error: jest.Mock;
      success: jest.Mock;
    };
    fixture.detectChanges();
  });

  it('should create with compress suggestion when empty', () => {
    expect(component).toBeTruthy();
    expect(component.activeIndexLabel).toBe('—');
    expect(component.currentFormatLabel).toBe('—');
    expect(component.primarySuggestion?.id).toBe('iv-compress');
    expect(component.relatedTools.length).toBeGreaterThan(0);
  });

  it('rejects unsupported files', () => {
    component.processFiles([new File(['x'], 'notes.txt', { type: 'text/plain' })]);
    expect(component.errorMessage).toContain('Unsupported format');
    expect(component.loading).toBe(false);
  });

  it('clamps zoom controls', () => {
    component.zoomLevel = 25;
    component.zoomOut();
    expect(component.zoomLevel).toBe(25);
    component.zoomLevel = 500;
    component.zoomIn();
    expect(component.zoomLevel).toBe(500);
    component.resetZoom();
    expect(component.zoomLevel).toBe(100);
    expect(component.isZoomed).toBe(false);
  });

  it('downloads current image with toast feedback', () => {
    component.images = [
      {
        name: 'photo.png',
        file: new File([''], 'photo.png'),
        url: 'data:image/png;base64,xx',
        size: 10,
        type: 'image/png'
      }
    ];
    component.currentImageIndex = 0;

    const click = jest.fn();
    const remove = jest.fn();
    const createElement = jest.spyOn(document, 'createElement').mockImplementation(((tag: string) => {
      if (tag === 'a') {
        return {
          href: '',
          download: '',
          click,
          remove
        } as unknown as HTMLAnchorElement;
      }
      return document.createElement(tag);
    }) as typeof document.createElement);
    const appendChild = jest.spyOn(document.body, 'appendChild').mockImplementation((n) => n);

    try {
      component.downloadImage();
      expect(click).toHaveBeenCalled();
      expect(remove).toHaveBeenCalled();
      expect(toast.info).toHaveBeenCalled();
    } finally {
      createElement.mockRestore();
      appendChild.mockRestore();
    }
  });

  it('dismisses contextual suggestions', () => {
    const suggestion = component.primarySuggestion;
    expect(suggestion?.id).toBe('iv-compress');
    if (suggestion) {
      component.dismissSuggestion(suggestion.id);
      expect(component.primarySuggestion).toBeNull();
    }
  });

  it('clears gallery state', () => {
    component.images = [
      {
        name: 'a.png',
        file: new File([''], 'a.png'),
        url: 'data:image/png;base64,aa',
        size: 1,
        type: 'image/png'
      }
    ];
    component.currentImageIndex = 0;
    component.errorMessage = 'x';
    component.clearAll();
    expect(component.images).toEqual([]);
    expect(component.currentImageIndex).toBe(-1);
    expect(component.errorMessage).toBe('');
  });

  it('navigates gallery indices', () => {
    component.images = [
      {
        name: 'a.png',
        file: new File([''], 'a.png'),
        url: 'data:a',
        size: 1,
        type: 'image/png'
      },
      {
        name: 'b.png',
        file: new File([''], 'b.png'),
        url: 'data:b',
        size: 1,
        type: 'image/png'
      }
    ];
    component.currentImageIndex = 0;
    component.nextImage();
    expect(component.currentImageIndex).toBe(1);
    component.previousImage();
    expect(component.currentImageIndex).toBe(0);
  });
});
