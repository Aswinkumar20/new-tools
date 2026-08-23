jest.mock('../../utils/word-viewer.utils', () => {
  const actual = jest.requireActual('../../utils/word-viewer.utils');
  return {
    ...actual,
    loadMammothLibrary: jest.fn().mockResolvedValue({
      convertToHtml: async () => ({ value: '<p>Hello</p>', messages: [] }),
      extractRawText: async () => ({ value: 'Hello' })
    })
  };
});

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ToastService } from '@tools-workspace/features-home';
import { fileViewerTestProviders } from '../../shared/file-viewer-test.utils';
import { FileViewerWordViewerComponent } from './word-viewer';
import { DocumentType } from '../../types/word-viewer.types';

describe('FileViewerWordViewerComponent', () => {
  let component: FileViewerWordViewerComponent;
  let fixture: ComponentFixture<FileViewerWordViewerComponent>;
  let toast: { info: jest.Mock; error: jest.Mock; success: jest.Mock };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FileViewerWordViewerComponent],
      providers: [...fileViewerTestProviders(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(FileViewerWordViewerComponent);
    component = fixture.componentInstance;
    toast = TestBed.inject(ToastService) as unknown as {
      info: jest.Mock;
      error: jest.Mock;
      success: jest.Mock;
    };
    fixture.detectChanges();
  });

  it('should create with pdf suggestion when empty', () => {
    expect(component).toBeTruthy();
    expect(component.primarySuggestion?.id).toBe('wv-pdf');
    expect(component.relatedTools.length).toBeGreaterThan(0);
  });

  it('rejects unsupported files', async () => {
    await component.processFiles([new File(['x'], 'photo.png', { type: 'image/png' })]);
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

  it('downloads current document with toast feedback', () => {
    component.wordFiles = [
      {
        name: 'doc.docx',
        file: new File(['x'], 'doc.docx'),
        url: 'blob:mock',
        size: 4,
        htmlContent: '<p>Hi</p>',
        textContent: 'Hi',
        documentType: DocumentType.DOCX,
        needsPassword: false,
        passwordError: false
      }
    ];
    component.currentWordIndex = 0;

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
      component.downloadWord();
      expect(click).toHaveBeenCalled();
      expect(toast.info).toHaveBeenCalled();
    } finally {
      createElement.mockRestore();
      appendChild.mockRestore();
      component.wordFiles = [];
      component.currentWordIndex = -1;
    }
  });

  it('dismisses contextual suggestions', () => {
    const suggestion = component.primarySuggestion;
    expect(suggestion?.id).toBe('wv-pdf');
    if (suggestion) {
      component.dismissSuggestion(suggestion.id);
      expect(component.primarySuggestion).toBeNull();
    }
  });

  it('clears files without throwing on fake blob urls', () => {
    component.wordFiles = [
      {
        name: 'a.docx',
        file: new File(['x'], 'a.docx'),
        url: 'blob:fake',
        size: 1,
        htmlContent: '<p>a</p>',
        textContent: 'a',
        documentType: DocumentType.DOCX,
        needsPassword: false,
        passwordError: false
      }
    ];
    component.currentWordIndex = 0;
    component.clearAll();
    expect(component.wordFiles).toEqual([]);
    expect(component.currentWordIndex).toBe(-1);
  });
});
