import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AssetService, ToastService } from '@tools-workspace/features-home';
import { Hl7MessageViewerComponent } from './hl7-message-viewer';

describe('Hl7MessageViewerComponent', () => {
  let fixture: ComponentFixture<Hl7MessageViewerComponent>;
  let component: Hl7MessageViewerComponent;
  const toast = { success: jest.fn(), error: jest.fn(), info: jest.fn() };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Hl7MessageViewerComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ToastService, useValue: toast },
        {
          provide: AssetService,
          useValue: { getAssetPath: (path: string) => `/assets/${path}` }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(Hl7MessageViewerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('loads sample ORU^R01 HL7 message', async () => {
    await component.loadSample();
    expect(component.currentMessage?.name).toBe('sample-oru-r01.hl7');
    expect(component.currentMessage?.parsed.messageType).toBe('ORU');
    expect(component.currentMessage?.parsed.triggerEvent).toBe('R01');
    expect(component.currentMessage?.parsed.segments.length).toBeGreaterThan(3);
  });

  it('filters and selects segments', async () => {
    await component.loadSample();
    component.filterBySegmentType('OBX');
    expect(component.filteredSegments.every((s) => s.name === 'OBX')).toBe(true);
    component.selectSegment(component.filteredSegments[0]);
    expect(component.selectedSegment?.name).toBe('OBX');
  });
});
