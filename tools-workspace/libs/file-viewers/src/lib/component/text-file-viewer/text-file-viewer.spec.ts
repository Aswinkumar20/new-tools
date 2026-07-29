import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ToastService } from '@tools-workspace/features-home';
import { fileViewerTestProviders } from '../../shared/file-viewer-test.utils';
import { TextFileViewerComponent } from './text-file-viewer';
import { TextFileType } from '../../types/text-file-viewer.types';

describe('TextFileViewerComponent', () => {
  let component: TextFileViewerComponent;
  let fixture: ComponentFixture<TextFileViewerComponent>;
  let toast: { info: jest.Mock; error: jest.Mock; success: jest.Mock };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TextFileViewerComponent],
      providers: [...fileViewerTestProviders(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(TextFileViewerComponent);
    component = fixture.componentInstance;
    toast = TestBed.inject(ToastService) as unknown as {
      info: jest.Mock;
      error: jest.Mock;
      success: jest.Mock;
    };
    fixture.detectChanges();
  });

  it('should create with markdown suggestion when empty', () => {
    expect(component).toBeTruthy();
    expect(component.primarySuggestion?.id).toBe('tf-markdown');
    expect(component.relatedTools.length).toBeGreaterThan(0);
  });

  it('rejects oversized files', async () => {
    const huge = new File(['x'], 'huge.txt', { type: 'text/plain' });
    Object.defineProperty(huge, 'size', { value: 11 * 1024 * 1024 });
    await component.processFiles([huge]);
    expect(component.errorMessage).toContain('max 10MB');
    expect(component.loading).toBe(false);
  });

  it('clamps zoom controls', () => {
    component.zoomLevel = 50;
    component.zoomOut();
    expect(component.zoomLevel).toBe(50);
    component.zoomLevel = 200;
    component.zoomIn();
    expect(component.zoomLevel).toBe(200);
    component.resetZoom();
    expect(component.zoomLevel).toBe(100);
  });

  it('downloads current file with toast feedback', () => {
    component.textFiles = [
      {
        name: 'notes.txt',
        file: new File(['hi'], 'notes.txt'),
        url: 'blob:mock',
        size: 2,
        content: 'hi',
        lines: 1,
        fileType: TextFileType.TXT,
        encoding: 'UTF-8'
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
      component.downloadFile();
      expect(click).toHaveBeenCalled();
      expect(toast.info).toHaveBeenCalled();
    } finally {
      createElement.mockRestore();
      appendChild.mockRestore();
      component.textFiles = [];
      component.currentFileIndex = -1;
    }
  });

  it('dismisses contextual suggestions', () => {
    const suggestion = component.primarySuggestion;
    expect(suggestion?.id).toBe('tf-markdown');
    if (suggestion) {
      component.dismissSuggestion(suggestion.id);
      expect(component.primarySuggestion).toBeNull();
    }
  });

  it('clears files without throwing on fake blob urls', () => {
    component.textFiles = [
      {
        name: 'a.txt',
        file: new File(['a'], 'a.txt'),
        url: 'blob:fake',
        size: 1,
        content: 'a',
        lines: 1,
        fileType: TextFileType.TXT,
        encoding: 'UTF-8'
      }
    ];
    component.currentFileIndex = 0;
    component.clearAll();
    expect(component.textFiles).toEqual([]);
    expect(component.currentFileIndex).toBe(-1);
  });
});
