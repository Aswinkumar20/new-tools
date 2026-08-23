import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ToastService } from '@tools-workspace/features-home';
import { fileViewerTestProviders } from '../../shared/file-viewer-test.utils';
import type { Pm4jsEventLog, Pm4jsXesImporter } from '../../types/xes-viewer.types';
import { XesViewerComponent } from './xes-viewer';

function sampleLog(): Pm4jsEventLog {
  return {
    attributes: {},
    extensions: {},
    globals: {},
    classifiers: {},
    traces: [
      {
        attributes: { 'concept:name': { value: 'C1' } },
        events: [
          {
            attributes: {
              'concept:name': { value: 'A' },
              'time:timestamp': { value: new Date('2024-01-01T00:00:00Z') }
            }
          }
        ]
      }
    ]
  };
}

describe('XesViewerComponent', () => {
  let component: XesViewerComponent;
  let fixture: ComponentFixture<XesViewerComponent>;
  let toast: { info: jest.Mock; error: jest.Mock; success: jest.Mock };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [XesViewerComponent],
      providers: [...fileViewerTestProviders(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(XesViewerComponent);
    component = fixture.componentInstance;
    toast = TestBed.inject(ToastService) as unknown as {
      info: jest.Mock;
      error: jest.Mock;
      success: jest.Mock;
    };
    fixture.detectChanges();
  });

  it('should create with intro suggestion when empty', () => {
    expect(component).toBeTruthy();
    expect(component.primarySuggestion?.id).toBe('xes-intro');
    expect(component.relatedTools.length).toBeGreaterThan(0);
  });

  it('rejects invalid files when library is ready', async () => {
    (component as unknown as { importer: Pm4jsXesImporter }).importer = {
      apply: jest.fn()
    };
    await component.handleFiles([new File(['x'], 'notes.txt', { type: 'text/plain' })]);
    expect(component.errorMessage).toContain('valid XES');
  });

  it('loads a valid XES file through PM4JS importer', async () => {
    const importer: Pm4jsXesImporter = {
      apply: jest.fn().mockReturnValue(sampleLog())
    };
    (component as unknown as { importer: Pm4jsXesImporter }).importer = importer;

    const createObjectURL = jest.fn().mockReturnValue('blob:mock');
    const revokeObjectURL = jest.fn();
    (URL as { createObjectURL: (b: Blob) => string }).createObjectURL = createObjectURL;
    (URL as { revokeObjectURL: (u: string) => void }).revokeObjectURL = revokeObjectURL;

    await component.handleFiles([
      new File(['<log></log>'], 'demo.xes', { type: 'application/xml' })
    ]);

    expect(importer.apply).toHaveBeenCalled();
    expect(component.xesFiles).toHaveLength(1);
    expect(component.allEvents).toHaveLength(1);
    expect(component.stats?.cases).toBe(1);
    expect(component.metadata?.eventAttributeKeys).toContain('concept:name');
    expect(toast.success).toHaveBeenCalled();
  });

  it('expands and collapses event detail rows', async () => {
    (component as unknown as { importer: Pm4jsXesImporter }).importer = {
      apply: jest.fn().mockReturnValue(sampleLog())
    };
    await component.handleFiles([new File(['<log></log>'], 'demo.xes')]);

    const row = component.allEvents[0];
    expect(component.expandedEventId).toBeNull();
    component.toggleEventDetail(row);
    expect(component.expandedEventId).toBe(row.id);
    component.toggleEventDetail(row);
    expect(component.expandedEventId).toBeNull();
  });

  it('computes shares without dividing by zero', () => {
    expect(component.sharePercent(1, 0)).toBe('0%');
    expect(component.sharePercent(1, 4)).toBe('25.0%');
  });

  it('filters by activity and exports multiple formats', async () => {
    (component as unknown as { importer: Pm4jsXesImporter }).importer = {
      apply: jest.fn().mockReturnValue(sampleLog())
    };
    await component.handleFiles([new File(['<log></log>'], 'demo.xes')]);

    expect(component.viewMode).toBe('insights');
    expect(component.insights?.avgEventsPerCase).toBe(1);

    component.selectActivity('missing');
    expect(component.filteredEvents).toHaveLength(0);

    component.selectActivity('A');
    expect(component.filteredEvents).toHaveLength(1);

    const createObjectURL = jest.fn().mockReturnValue('blob:mock');
    const revokeObjectURL = jest.fn();
    (URL as { createObjectURL: (b: Blob) => string }).createObjectURL = createObjectURL;
    (URL as { revokeObjectURL: (u: string) => void }).revokeObjectURL = revokeObjectURL;
    jest.spyOn(document, 'createElement').mockImplementation(((tag: string) => {
      if (tag === 'a') {
        return { href: '', download: '', click: jest.fn() } as unknown as HTMLAnchorElement;
      }
      return document.createElement(tag);
    }) as typeof document.createElement);

    await component.exportAs('events-csv');
    expect(toast.success).toHaveBeenCalledWith('Exported Events CSV');

    await component.exportAs('markdown-report');
    expect(toast.success).toHaveBeenCalledWith('Exported Markdown report');

    await component.exportAs('full-report-csv');
    expect(toast.success).toHaveBeenCalledWith('Exported Full report CSV');

    await component.exportAs('full-report-pdf');
    expect(toast.success).toHaveBeenCalledWith('Exported Full report PDF');

    await component.exportAs('dfg-dot');
    expect(toast.success).toHaveBeenCalledWith('Exported DFG Graphviz DOT');

    await component.exportAs('original-xes');
    expect(toast.success).toHaveBeenCalledWith('Exported Original XES');
  });
});
