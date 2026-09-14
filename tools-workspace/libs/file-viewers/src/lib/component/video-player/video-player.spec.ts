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

  it('should create with upload suggestion when empty', () => {
    expect(component).toBeTruthy();
    expect(component.videoFiles.length).toBe(0);
    expect(component.primarySuggestion?.id).toBe('vp-audio');
    expect(component.relatedTools.length).toBeGreaterThan(0);
    expect(component.formatsLabel).toContain('MP4');
  });

  it('dismisses contextual suggestions', () => {
    const suggestion = component.primarySuggestion;
    expect(suggestion?.id).toBe('vp-audio');
    if (suggestion) {
      component.dismissSuggestion(suggestion.id);
      expect(component.primarySuggestion).toBeNull();
    }
  });
});
