import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ToastService } from '@tools-workspace/features-home';
import { fileViewerTestProviders } from '../../shared/file-viewer-test.utils';
import { LogLevel } from '../../types/log-viewer.types';
import { LogViewerComponent } from './log-viewer';

describe('LogViewerComponent', () => {
  let component: LogViewerComponent;
  let fixture: ComponentFixture<LogViewerComponent>;
  let toast: { info: jest.Mock; error: jest.Mock; success: jest.Mock };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LogViewerComponent],
      providers: [...fileViewerTestProviders(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(LogViewerComponent);
    component = fixture.componentInstance;
    toast = TestBed.inject(ToastService) as unknown as {
      info: jest.Mock;
      error: jest.Mock;
      success: jest.Mock;
    };
    fixture.detectChanges();
  });

  it('should create with text suggestion when empty', () => {
    expect(component).toBeTruthy();
    expect(component.primarySuggestion?.id).toBe('lv-text');
    expect(component.relatedTools.length).toBeGreaterThan(0);
  });

  it('rejects invalid files', async () => {
    await component.loadLogFile(new File(['x'], 'photo.png', { type: 'image/png' }));
    expect(component.errorMessage).toContain('valid log file');
  });

  it('parses input logs and filters levels', () => {
    component.logs = ['INFO hello', 'ERROR boom', 'WARN careful'];
    component.processLogs();
    expect(component.allLogEntries.length).toBe(3);
    component.toggleLevel(LogLevel.ERROR);
    expect(component.filteredLogEntries.every((e) => e.level === LogLevel.ERROR)).toBe(true);
  });

  it('downloads export with toast feedback', () => {
    component.loadedFileContent = 'line1\nline2';
    component.loadedFileName = 'app.log';
    component.allLogEntries = [
      {
        id: '1',
        raw: 'line1',
        level: LogLevel.INFO,
        message: 'line1',
        lineNumber: 1
      }
    ];

    const click = jest.fn();
    const createObjectURL = jest.fn().mockReturnValue('blob:mock');
    const revokeObjectURL = jest.fn();
    const previousCreate = (URL as { createObjectURL?: (b: Blob) => string }).createObjectURL;
    const previousRevoke = (URL as { revokeObjectURL?: (u: string) => void }).revokeObjectURL;
    (URL as { createObjectURL: (b: Blob) => string }).createObjectURL = createObjectURL;
    (URL as { revokeObjectURL: (u: string) => void }).revokeObjectURL = revokeObjectURL;

    const createElement = jest.spyOn(document, 'createElement').mockImplementation(((tag: string) => {
      if (tag === 'a') {
        return { href: '', download: '', click } as unknown as HTMLAnchorElement;
      }
      return document.createElement(tag);
    }) as typeof document.createElement);

    try {
      component.downloadFile();
      expect(click).toHaveBeenCalled();
      expect(toast.info).toHaveBeenCalled();
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
    expect(suggestion?.id).toBe('lv-text');
    if (suggestion) {
      component.dismissSuggestion(suggestion.id);
      expect(component.primarySuggestion).toBeNull();
    }
  });

  it('clears all log state', () => {
    component.logs = ['INFO a'];
    component.processLogs();
    component.errorMessage = 'x';
    component.clearAll();
    expect(component.allLogEntries).toEqual([]);
    expect(component.logs).toEqual([]);
    expect(component.errorMessage).toBe('');
  });
});
