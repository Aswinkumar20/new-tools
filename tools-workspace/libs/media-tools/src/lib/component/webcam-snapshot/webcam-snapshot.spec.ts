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

  it('should create with live camera workflow', () => {
    expect(component).toBeTruthy();
    expect(component.statusLabel()).toBe('Idle');
    expect(component.primarySuggestion()?.id).toBe('ws-meta');
    expect(component.relatedTools.length).toBeGreaterThan(0);
    expect(component.exportFormats.length).toBe(2);
  });

  it('dismisses contextual suggestions', () => {
    const suggestion = component.primarySuggestion();
    expect(suggestion?.id).toBe('ws-meta');
    if (suggestion) {
      component.dismissSuggestion(suggestion.id);
      expect(component.primarySuggestion()).toBeNull();
    }
  });
});
