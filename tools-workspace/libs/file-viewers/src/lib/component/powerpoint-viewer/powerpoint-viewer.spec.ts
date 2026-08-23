jest.mock('../../utils/powerpoint-viewer.utils', () => {
  const actual = jest.requireActual('../../utils/powerpoint-viewer.utils');
  return {
    ...actual,
    loadJsZipLibrary: jest.fn().mockResolvedValue({
      loadAsync: async () => ({ files: {} })
    }),
    parsePptxManually: jest.fn().mockResolvedValue({
      slides: [
        {
          id: 1,
          background: '#ffffff',
          elements: [{ type: 'text', content: 'Title', x: 0, y: 0, width: 50, height: 10 }]
        }
      ],
      slideWidthEmu: 12192000,
      slideHeightEmu: 6858000,
      warnings: []
    })
  };
});

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ToastService } from '@tools-workspace/features-home';
import { fileViewerTestProviders } from '../../shared/file-viewer-test.utils';
import { PowerpointViewerComponent } from './powerpoint-viewer';
import { PresentationType } from '../../types/powerpoint-viewer.types';

describe('PowerpointViewerComponent', () => {
  let component: PowerpointViewerComponent;
  let fixture: ComponentFixture<PowerpointViewerComponent>;
  let toast: { info: jest.Mock; error: jest.Mock; success: jest.Mock; warning: jest.Mock };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PowerpointViewerComponent],
      providers: [...fileViewerTestProviders(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(PowerpointViewerComponent);
    component = fixture.componentInstance;
    toast = TestBed.inject(ToastService) as unknown as {
      info: jest.Mock;
      error: jest.Mock;
      success: jest.Mock;
      warning: jest.Mock;
    };
    fixture.detectChanges();
  });

  it('should create with pdf suggestion when empty', () => {
    expect(component).toBeTruthy();
    expect(component.primarySuggestion?.id).toBe('pp-pdf');
    expect(component.relatedTools.length).toBeGreaterThan(0);
  });

  it('rejects unsupported files', async () => {
    await component.processFiles([new File(['x'], 'notes.txt', { type: 'text/plain' })]);
    expect(component.errorMessage).toContain('Unsupported');
    expect(component.loading).toBe(false);
    expect(toast.error).toHaveBeenCalled();
  });

  it('clamps zoom controls', () => {
    component.zoomLevel = 50;
    component.zoomOut();
    expect(component.zoomLevel).toBe(50);
    component.zoomLevel = 300;
    component.zoomIn();
    expect(component.zoomLevel).toBe(300);
    component.resetZoom();
    expect(component.zoomLevel).toBe(100);
  });

  it('downloads current presentation with toast feedback', () => {
    component.presentationFiles = [
      {
        name: 'deck.pptx',
        file: new File(['x'], 'deck.pptx'),
        url: 'blob:mock',
        size: 4,
        presentationType: PresentationType.PPTX,
        slides: [],
        totalSlides: 0,
        currentSlideIndex: 0,
        slideWidthEmu: 12192000,
        slideHeightEmu: 6858000
      }
    ];
    component.currentFileIndex = 0;

    const click = jest.fn();
    const remove = jest.fn();
    const createElement = jest.spyOn(document, 'createElement').mockImplementation(((tag: string) => {
      if (tag === 'a') {
        return { href: '', download: '', click, remove } as unknown as HTMLAnchorElement;
      }
      return document.createElement(tag);
    }) as typeof document.createElement);
    const appendChild = jest.spyOn(document.body, 'appendChild').mockImplementation((n) => n);

    try {
      component.downloadPresentation();
      expect(click).toHaveBeenCalled();
      expect(toast.info).toHaveBeenCalled();
    } finally {
      createElement.mockRestore();
      appendChild.mockRestore();
      component.presentationFiles = [];
      component.currentFileIndex = -1;
    }
  });

  it('dismisses contextual suggestions', () => {
    const suggestion = component.primarySuggestion;
    expect(suggestion?.id).toBe('pp-pdf');
    if (suggestion) {
      component.dismissSuggestion(suggestion.id);
      expect(component.primarySuggestion).toBeNull();
    }
  });

  it('clears files without throwing on fake blob urls', () => {
    component.presentationFiles = [
      {
        name: 'a.pptx',
        file: new File(['x'], 'a.pptx'),
        url: 'blob:fake',
        size: 1,
        presentationType: PresentationType.PPTX,
        slides: [],
        totalSlides: 0,
        currentSlideIndex: 0,
        slideWidthEmu: 12192000,
        slideHeightEmu: 6858000
      }
    ];
    component.currentFileIndex = 0;
    component.clearAll();
    expect(component.presentationFiles).toEqual([]);
    expect(component.currentFileIndex).toBe(-1);
  });
});
