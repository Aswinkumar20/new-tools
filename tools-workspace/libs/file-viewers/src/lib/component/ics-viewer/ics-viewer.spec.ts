import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ToastService } from '@tools-workspace/features-home';
import { fileViewerTestProviders } from '../../shared/file-viewer-test.utils';
import { ICS_SAMPLE_CALENDAR } from '../../constants/ics-viewer-sample.data';
import { IcsViewerComponent } from './ics-viewer';

describe('IcsViewerComponent', () => {
  let component: IcsViewerComponent;
  let fixture: ComponentFixture<IcsViewerComponent>;
  let toast: { info: jest.Mock; error: jest.Mock; success: jest.Mock; warning: jest.Mock };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IcsViewerComponent],
      providers: [...fileViewerTestProviders(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(IcsViewerComponent);
    component = fixture.componentInstance;
    toast = TestBed.inject(ToastService) as unknown as {
      info: jest.Mock;
      error: jest.Mock;
      success: jest.Mock;
      warning: jest.Mock;
    };
    fixture.detectChanges();
  });

  it('should create with intro suggestion when empty', () => {
    expect(component).toBeTruthy();
    expect(component.primarySuggestion?.id).toBe('ics-intro');
    expect(component.relatedTools.length).toBeGreaterThan(0);
  });

  it('rejects invalid files', async () => {
    await component.handleFiles([new File(['x'], 'notes.txt', { type: 'text/plain' })]);
    expect(component.errorMessage).toMatch(/not a supported/i);
    expect(toast.error).toHaveBeenCalled();
  });

  it('loads a valid ICS file and populates month view', async () => {
    const createObjectURL = jest.fn().mockReturnValue('blob:mock');
    const revokeObjectURL = jest.fn();
    (URL as { createObjectURL: (b: Blob) => string }).createObjectURL = createObjectURL;
    (URL as { revokeObjectURL: (u: string) => void }).revokeObjectURL = revokeObjectURL;

    const file = new File([ICS_SAMPLE_CALENDAR], 'roadmap.ics', { type: 'text/calendar' });
    Object.defineProperty(file, 'text', {
      value: async () => ICS_SAMPLE_CALENDAR
    });

    await component.handleFiles([file]);

    expect(component.errorMessage).toBe('');
    expect(component.icsFiles).toHaveLength(1);
    // Sample events are in March 2024 — jump there so the month grid is populated.
    component.anchorDate = new Date(2024, 2, 15);
    component.selectedDate = new Date(2024, 2, 15);
    component.refreshViews();
    expect(component.stats?.events).toBeGreaterThan(0);
    expect(component.monthCells.length).toBe(42);
    expect(toast.success).toHaveBeenCalled();
  });

  it('switches views and opens read-only event details', async () => {
    (URL as { createObjectURL: (b: Blob) => string }).createObjectURL = jest
      .fn()
      .mockReturnValue('blob:mock');
    (URL as { revokeObjectURL: (u: string) => void }).revokeObjectURL = jest.fn();

    const file = new File([ICS_SAMPLE_CALENDAR], 'roadmap.ics', { type: 'text/calendar' });
    Object.defineProperty(file, 'text', {
      value: async () => ICS_SAMPLE_CALENDAR
    });

    await component.handleFiles([file]);
    component.anchorDate = new Date(2024, 2, 12);
    component.selectedDate = new Date(2024, 2, 12);
    component.refreshViews();

    component.setViewMode('agenda');
    expect(component.viewMode).toBe('agenda');
    component.setViewMode('list');
    expect(component.listEvents.length).toBeGreaterThan(0);

    const event = component.visibleEvents[0] ?? component.listEvents[0];
    component.openEvent(event);
    expect(component.showEventDetails).toBe(true);
    expect(component.selectedEvent?.title).toBeTruthy();
    component.closeEventDetails();
    expect(component.showEventDetails).toBe(false);
  });

  it('clears files and resets state', async () => {
    (URL as { createObjectURL: (b: Blob) => string }).createObjectURL = jest
      .fn()
      .mockReturnValue('blob:mock');
    (URL as { revokeObjectURL: (u: string) => void }).revokeObjectURL = jest.fn();
    const file = new File([ICS_SAMPLE_CALENDAR], 'roadmap.ics', { type: 'text/calendar' });
    Object.defineProperty(file, 'text', {
      value: async () => ICS_SAMPLE_CALENDAR
    });
    await component.handleFiles([file]);
    component.clearAll();
    expect(component.icsFiles).toHaveLength(0);
    expect(component.stats).toBeNull();
  });
});
