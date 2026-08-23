import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ToastService } from '@tools-workspace/features-home';
import { fileViewerTestProviders } from '../../shared/file-viewer-test.utils';
import { ExcelViewerComponent } from './excel-viewer';

describe('ExcelViewerComponent', () => {
  let component: ExcelViewerComponent;
  let fixture: ComponentFixture<ExcelViewerComponent>;
  let toast: { info: jest.Mock; error: jest.Mock; success: jest.Mock };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ExcelViewerComponent],
      providers: [...fileViewerTestProviders(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(ExcelViewerComponent);
    component = fixture.componentInstance;
    toast = TestBed.inject(ToastService) as unknown as {
      info: jest.Mock;
      error: jest.Mock;
      success: jest.Mock;
    };
    fixture.detectChanges();
  });

  it('should create with convert suggestion when empty', () => {
    expect(component).toBeTruthy();
    expect(component.primarySuggestion?.id).toBe('ev-convert');
    expect(component.relatedTools.length).toBeGreaterThan(0);
  });

  it('rejects invalid files when library is ready', async () => {
    (component as unknown as { XLSXLib: object }).XLSXLib = { read: jest.fn() };
    await component.handleFiles([new File(['x'], 'notes.txt', { type: 'text/plain' })]);
    expect(component.errorMessage).toContain('valid Excel');
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

  it('downloads current workbook with toast feedback', async () => {
    const write = jest.fn().mockReturnValue(new Uint8Array([1, 2, 3]));
    (component as unknown as { XLSXLib: { write: jest.Mock } }).XLSXLib = { write };
    component.excelFiles = [
      {
        name: 'book.xlsx',
        file: new File([''], 'book.xlsx'),
        workbook: { SheetNames: ['Sheet1'], Sheets: {} },
        size: 10,
        loaded: true
      }
    ];
    component.currentFileIndex = 0;

    const createObjectURL = jest.fn().mockReturnValue('blob:mock');
    const revokeObjectURL = jest.fn();
    const previousCreate = (URL as { createObjectURL?: (b: Blob) => string }).createObjectURL;
    const previousRevoke = (URL as { revokeObjectURL?: (u: string) => void }).revokeObjectURL;
    (URL as { createObjectURL: (b: Blob) => string }).createObjectURL = createObjectURL;
    (URL as { revokeObjectURL: (u: string) => void }).revokeObjectURL = revokeObjectURL;

    const click = jest.fn();
    const createElement = jest.spyOn(document, 'createElement').mockImplementation(((tag: string) => {
      if (tag === 'a') {
        return { href: '', download: '', click } as unknown as HTMLAnchorElement;
      }
      return document.createElement(tag);
    }) as typeof document.createElement);

    try {
      await component.downloadExcel();
      expect(write).toHaveBeenCalled();
      expect(toast.info).toHaveBeenCalled();
      expect(click).toHaveBeenCalled();
    } finally {
      createElement.mockRestore();
      if (previousCreate) {
        URL.createObjectURL = previousCreate;
      } else {
        delete (URL as { createObjectURL?: (b: Blob) => string }).createObjectURL;
      }
      if (previousRevoke) {
        URL.revokeObjectURL = previousRevoke;
      } else {
        delete (URL as { revokeObjectURL?: (u: string) => void }).revokeObjectURL;
      }
    }
  });

  it('dismisses contextual suggestions', () => {
    const suggestion = component.primarySuggestion;
    expect(suggestion?.id).toBe('ev-convert');
    if (suggestion) {
      component.dismissSuggestion(suggestion.id);
      expect(component.primarySuggestion).toBeNull();
    }
  });

  it('clears workbook state', () => {
    component.excelFiles = [
      {
        name: 'a.xlsx',
        file: new File([''], 'a.xlsx'),
        workbook: { SheetNames: ['Sheet1'], Sheets: {} },
        size: 1,
        loaded: true
      }
    ];
    component.currentFileIndex = 0;
    component.maxRows = 5;
    component.clearAll();
    expect(component.excelFiles).toEqual([]);
    expect(component.currentFileIndex).toBe(-1);
    expect(component.maxRows).toBe(0);
  });
});
