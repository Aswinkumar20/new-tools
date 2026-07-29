import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { mtToolTestProviders } from '../../shared/mt-tool-test.utils';
import { VideoToGifComponent } from './video-to-gif';

describe('VideoToGifComponent', () => {
  let component: VideoToGifComponent;
  let fixture: ComponentFixture<VideoToGifComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VideoToGifComponent],
      providers: [...mtToolTestProviders(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(VideoToGifComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create as coming-soon with image viewer suggestion', () => {
    expect(component).toBeTruthy();
    expect(component.isComingSoon).toBe(true);
    expect(component.primarySuggestion?.id).toBe('vg-image-viewer');
    expect(component.relatedTools.length).toBeGreaterThan(0);
    expect(component.roadmapItems.length).toBe(4);
    expect(component.plannedFormatCount).toBe(3);
    expect(component.qualityPresetCount).toBe(3);
    expect(component.recommendedMaxSeconds).toBe(30);
    expect(component.acceptHint).toContain('MP4');
  });

  it('dismisses contextual suggestions', () => {
    const suggestion = component.primarySuggestion;
    expect(suggestion?.id).toBe('vg-image-viewer');
    if (suggestion) {
      component.dismissSuggestion(suggestion.id);
      expect(component.primarySuggestion).toBeNull();
    }
  });

  it('exposes planned copy for the empty state', () => {
    expect(component.title).toBe('Video to GIF');
    expect(component.uploadHint).toContain('GIF');
    expect(component.formatsLabel).toContain('WebM');
    expect(component.helpItems.length).toBe(3);
  });
});
