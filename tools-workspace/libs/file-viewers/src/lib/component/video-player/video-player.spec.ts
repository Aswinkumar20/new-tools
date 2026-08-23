import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { fileViewerTestProviders } from '../../shared/file-viewer-test.utils';
import { VideoPlayerComponent } from './video-player';

describe('VideoPlayerComponent', () => {
  let component: VideoPlayerComponent;
  let fixture: ComponentFixture<VideoPlayerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VideoPlayerComponent],
      providers: [...fileViewerTestProviders(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(VideoPlayerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create as coming-soon with audio suggestion', () => {
    expect(component).toBeTruthy();
    expect(component.isComingSoon).toBe(true);
    expect(component.primarySuggestion?.id).toBe('vp-audio');
    expect(component.relatedTools.length).toBeGreaterThan(0);
    expect(component.roadmapItems.length).toBe(4);
    expect(component.plannedFormatCount).toBe(4);
  });

  it('dismisses contextual suggestions', () => {
    const suggestion = component.primarySuggestion;
    expect(suggestion?.id).toBe('vp-audio');
    if (suggestion) {
      component.dismissSuggestion(suggestion.id);
      expect(component.primarySuggestion).toBeNull();
    }
  });

  it('exposes planned formats label for the empty state', () => {
    expect(component.formatsLabel).toContain('MP4');
    expect(component.formatsLabel).toContain('AVI');
  });
});
