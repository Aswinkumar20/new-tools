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

  it('should create with metadata suggestion', () => {
    expect(component).toBeTruthy();
    expect(component.primarySuggestion()?.id).toBe('at-meta');
    expect(component.relatedTools.length).toBeGreaterThan(0);
    expect(component.exportFormats.length).toBe(2);
    expect(component.formatsLabel).toContain('MP3');
  });

  it('dismisses contextual suggestions', () => {
    const suggestion = component.primarySuggestion();
    expect(suggestion?.id).toBe('at-meta');
    if (suggestion) {
      component.dismissSuggestion(suggestion.id);
      expect(component.primarySuggestion()).toBeNull();
    }
  });

  it('starts idle without a loaded source', () => {
    expect(component.title).toBe('Audio Trimmer');
    expect(component.hasSource()).toBe(false);
    expect(component.statusLabel()).toBe('Idle');
    expect(component.helpItems.length).toBe(3);
  });
});
