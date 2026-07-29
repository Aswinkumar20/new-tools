jest.mock('../../utils/markdown-previewer.utils', () => {
  const actual = jest.requireActual('../../utils/markdown-previewer.utils');
  return {
    ...actual,
    loadMarkedLibrary: jest.fn().mockResolvedValue({
      parse: (md: string) => `<p>${md}</p>`,
      setOptions: () => undefined
    }),
    loadDomPurifyLibrary: jest.fn().mockResolvedValue({
      sanitize: (html: string) => html
    })
  };
});

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ToastService } from '@tools-workspace/features-home';
import { fileViewerTestProviders } from '../../shared/file-viewer-test.utils';
import { MarkdownPreviewerComponent } from './markdown-previewer';

describe('MarkdownPreviewerComponent', () => {
  let component: MarkdownPreviewerComponent;
  let fixture: ComponentFixture<MarkdownPreviewerComponent>;
  let toast: { info: jest.Mock; error: jest.Mock; success: jest.Mock };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MarkdownPreviewerComponent],
      providers: [...fileViewerTestProviders(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(MarkdownPreviewerComponent);
    component = fixture.componentInstance;
    toast = TestBed.inject(ToastService) as unknown as {
      info: jest.Mock;
      error: jest.Mock;
      success: jest.Mock;
    };
    fixture.detectChanges();
  });

  it('should create with html suggestion when empty', () => {
    expect(component).toBeTruthy();
    expect(component.primarySuggestion?.id).toBe('mp-html');
    expect(component.relatedTools.length).toBeGreaterThan(0);
  });

  it('rejects unsupported files', async () => {
    await component.processFiles([new File(['x'], 'notes.txt', { type: 'text/plain' })]);
    expect(component.errorMessage).toContain('Unsupported');
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
    component.markdownFiles = [
      {
        name: 'readme.md',
        file: new File(['# Hi'], 'readme.md'),
        url: 'blob:mock',
        size: 4,
        content: '# Hi',
        htmlContent: '<p>Hi</p>',
        lines: 1,
        lastModified: new Date()
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
      component.markdownFiles = [];
      component.currentFileIndex = -1;
    }
  });

  it('dismisses contextual suggestions', () => {
    const suggestion = component.primarySuggestion;
    expect(suggestion?.id).toBe('mp-html');
    if (suggestion) {
      component.dismissSuggestion(suggestion.id);
      expect(component.primarySuggestion).toBeNull();
    }
  });

  it('clears files without throwing on fake blob urls', () => {
    component.markdownFiles = [
      {
        name: 'a.md',
        file: new File(['a'], 'a.md'),
        url: 'blob:fake',
        size: 1,
        content: 'a',
        htmlContent: '<p>a</p>',
        lines: 1,
        lastModified: new Date()
      }
    ];
    component.currentFileIndex = 0;
    component.clearAll();
    expect(component.markdownFiles).toEqual([]);
    expect(component.currentFileIndex).toBe(-1);
  });
});
