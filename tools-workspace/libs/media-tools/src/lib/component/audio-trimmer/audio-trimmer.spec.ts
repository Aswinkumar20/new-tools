import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { mtToolTestProviders } from '../../shared/mt-tool-test.utils';
import { AudioTrimmerComponent } from './audio-trimmer';

describe('AudioTrimmerComponent', () => {
  let component: AudioTrimmerComponent;
  let fixture: ComponentFixture<AudioTrimmerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AudioTrimmerComponent],
      providers: [...mtToolTestProviders(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(AudioTrimmerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create as coming-soon with audio player suggestion', () => {
    expect(component).toBeTruthy();
    expect(component.isComingSoon).toBe(true);
    expect(component.primarySuggestion?.id).toBe('at-audio-player');
    expect(component.relatedTools.length).toBeGreaterThan(0);
    expect(component.roadmapItems.length).toBe(4);
    expect(component.plannedFormatCount).toBe(3);
    expect(component.plannedExportCount).toBe(2);
    expect(component.acceptHint).toContain('MP3');
  });

  it('dismisses contextual suggestions', () => {
    const suggestion = component.primarySuggestion;
    expect(suggestion?.id).toBe('at-audio-player');
    if (suggestion) {
      component.dismissSuggestion(suggestion.id);
      expect(component.primarySuggestion).toBeNull();
    }
  });

  it('exposes planned copy for the empty state', () => {
    expect(component.title).toBe('Audio Trimmer');
    expect(component.uploadHint).toContain('trim editor');
    expect(component.formatsLabel).toContain('WAV');
    expect(component.helpItems.length).toBe(3);
  });
});
