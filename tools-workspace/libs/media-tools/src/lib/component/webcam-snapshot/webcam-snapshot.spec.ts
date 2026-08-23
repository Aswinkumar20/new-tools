import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { mtToolTestProviders } from '../../shared/mt-tool-test.utils';
import { WebcamSnapshotComponent } from './webcam-snapshot';

describe('WebcamSnapshotComponent', () => {
  let component: WebcamSnapshotComponent;
  let fixture: ComponentFixture<WebcamSnapshotComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WebcamSnapshotComponent],
      providers: [...mtToolTestProviders(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(WebcamSnapshotComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create as coming-soon with image viewer suggestion', () => {
    expect(component).toBeTruthy();
    expect(component.isComingSoon).toBe(true);
    expect(component.primarySuggestion?.id).toBe('ws-image-viewer');
    expect(component.relatedTools.length).toBeGreaterThan(0);
    expect(component.roadmapItems.length).toBe(4);
    expect(component.plannedExportCount).toBe(2);
    expect(component.countdownOptionCount).toBe(4);
    expect(component.acceptHint).toBe('Webcam');
  });

  it('dismisses contextual suggestions', () => {
    const suggestion = component.primarySuggestion;
    expect(suggestion?.id).toBe('ws-image-viewer');
    if (suggestion) {
      component.dismissSuggestion(suggestion.id);
      expect(component.primarySuggestion).toBeNull();
    }
  });

  it('exposes planned copy for the empty state', () => {
    expect(component.title).toBe('Webcam Snapshot');
    expect(component.emptyHint).toContain('Camera preview');
    expect(component.exportFormatsLabel).toContain('PNG');
    expect(component.helpItems.length).toBe(3);
  });
});
