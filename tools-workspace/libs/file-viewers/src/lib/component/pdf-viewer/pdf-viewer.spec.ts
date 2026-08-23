jest.mock('../../utils/pdf-viewer.utils', () => {
  const actual = jest.requireActual('../../utils/pdf-viewer.utils');
  return {
    ...actual,
    loadPdfJsLibrary: jest.fn().mockResolvedValue({
      version: '3.11.174',
      GlobalWorkerOptions: { workerSrc: '' },
      getDocument: () => ({
        promise: Promise.resolve({
          numPages: 1,
          getPage: async () => ({
            getViewport: () => ({ width: 100, height: 100 }),
            render: () => ({ promise: Promise.resolve(), cancel: () => undefined })
          }),
          destroy: () => undefined
        })
      }),
      PasswordResponses: { NEED_PASSWORD: 1, INCORRECT_PASSWORD: 2 }
    })
  };
});

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ToastService } from '@tools-workspace/features-home';
import { fileViewerTestProviders } from '../../shared/file-viewer-test.utils';
import { FileViewerPdfViewerComponent } from './pdf-viewer';

describe('FileViewerPdfViewerComponent', () => {
  let component: FileViewerPdfViewerComponent;
  let fixture: ComponentFixture<FileViewerPdfViewerComponent>;
  let toast: { info: jest.Mock; error: jest.Mock; success: jest.Mock };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FileViewerPdfViewerComponent],
      providers: [...fileViewerTestProviders(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(FileViewerPdfViewerComponent);
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
    expect(component.primarySuggestion?.id).toBe('pv-compress');
    expect(component.relatedTools.length).toBeGreaterThan(0);
  });

  it('rejects non-PDF files', async () => {
    await component.processFiles([new File(['x'], 'notes.txt', { type: 'text/plain' })]);
    expect(component.errorMessage).toContain('Not a PDF');
    expect(component.loading).toBe(false);
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

  it('downloads current PDF with toast feedback', () => {
    component.pdfFiles = [
      {
        name: 'doc.pdf',
        file: new File(['%PDF'], 'doc.pdf'),
        url: 'blob:mock',
        size: 4,
        pdfDoc: null,
        totalPages: 1,
        needsPassword: false,
        passwordError: false
      }
    ];
    component.currentPdfIndex = 0;

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
      component.downloadPdf();
      expect(click).toHaveBeenCalled();
      expect(toast.info).toHaveBeenCalled();
    } finally {
      createElement.mockRestore();
      appendChild.mockRestore();
      component.pdfFiles = [];
      component.currentPdfIndex = -1;
    }
  });

  it('dismisses contextual suggestions', () => {
    const suggestion = component.primarySuggestion;
    expect(suggestion?.id).toBe('pv-compress');
    if (suggestion) {
      component.dismissSuggestion(suggestion.id);
      expect(component.primarySuggestion).toBeNull();
    }
  });

  it('clears files without throwing on fake blob urls', () => {
    component.pdfFiles = [
      {
        name: 'a.pdf',
        file: new File(['x'], 'a.pdf'),
        url: 'blob:fake',
        size: 1,
        pdfDoc: null,
        totalPages: 0,
        needsPassword: false,
        passwordError: false
      }
    ];
    component.currentPdfIndex = 0;
    component.clearAll();
    expect(component.pdfFiles).toEqual([]);
    expect(component.currentPdfIndex).toBe(-1);
  });
});
