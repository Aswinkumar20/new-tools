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

  it('should create with metadata suggestion', () => {
    expect(component).toBeTruthy();
    expect(component.primarySuggestion()?.id).toBe('vg-meta');
    expect(component.relatedTools.length).toBeGreaterThan(0);
    expect(component.qualityPresets.length).toBe(3);
    expect(component.recommendedMaxSeconds).toBe(30);
    expect(component.formatsLabel).toContain('MP4');
  });

  it('dismisses contextual suggestions', () => {
    const suggestion = component.primarySuggestion();
    expect(suggestion?.id).toBe('vg-meta');
    if (suggestion) {
      component.dismissSuggestion(suggestion.id);
      expect(component.primarySuggestion()).toBeNull();
    }
  });

  it('starts idle without a loaded source', () => {
    expect(component.title).toBe('Video to GIF');
    expect(component.hasSource()).toBe(false);
    expect(component.statusLabel()).toBe('Idle');
    expect(component.helpItems.length).toBe(3);
  });
});
