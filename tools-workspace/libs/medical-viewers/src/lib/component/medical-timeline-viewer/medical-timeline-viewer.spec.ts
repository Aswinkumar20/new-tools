import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AssetService, ToastService } from '@tools-workspace/features-home';
import { MedicalTimelineViewerComponent } from './medical-timeline-viewer';

describe('MedicalTimelineViewerComponent', () => {
  let fixture: ComponentFixture<MedicalTimelineViewerComponent>;
  let component: MedicalTimelineViewerComponent;
  const toast = { success: jest.fn(), error: jest.fn(), info: jest.fn() };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MedicalTimelineViewerComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ToastService, useValue: toast },
        { provide: AssetService, useValue: { getAssetPath: (p: string) => `/assets/${p}` } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(MedicalTimelineViewerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('loads sample patient timeline', async () => {
    await component.loadSample();
    expect(component.currentDocument?.name).toBe('sample-patient-timeline.json');
    expect(component.currentDocument?.parsed.events.length).toBe(5);
  });

  it('filters events by category', async () => {
    await component.loadSample();
    component.setCategory('lab');
    expect(component.filteredEvents.every((e) => e.category === 'lab')).toBe(true);
  });
});
