import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ToastService } from '@tools-workspace/features-home';
import { fileViewerTestProviders } from '../../shared/file-viewer-test.utils';
import { FileViewerAudioPlayerComponent } from './audio-player';

describe('FileViewerAudioPlayerComponent', () => {
  let component: FileViewerAudioPlayerComponent;
  let fixture: ComponentFixture<FileViewerAudioPlayerComponent>;
  let toast: { info: jest.Mock; error: jest.Mock; success: jest.Mock };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FileViewerAudioPlayerComponent],
      providers: [...fileViewerTestProviders(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(FileViewerAudioPlayerComponent);
    component = fixture.componentInstance;
    toast = TestBed.inject(ToastService) as unknown as {
      info: jest.Mock;
      error: jest.Mock;
      success: jest.Mock;
    };
    fixture.detectChanges();
  });

  it('should create with archive suggestion when empty', () => {
    expect(component).toBeTruthy();
    expect(component.primarySuggestion?.id).toBe('ap-archive');
    expect(component.relatedTools.length).toBeGreaterThan(0);
  });

  it('rejects invalid files', async () => {
    await component.handleFiles([new File(['x'], 'notes.txt', { type: 'text/plain' })]);
    expect(component.errorMessage).toContain('valid audio');
    expect(toast.error).toHaveBeenCalledWith('No supported audio files found');
  });

  it('cycles repeat and clamps volume', () => {
    expect(component.repeatMode).toBe('none');
    component.toggleRepeat();
    expect(component.repeatMode).toBe('all');
    component.setVolume(250);
    expect(component.volume).toBe(100);
    expect(component.playbackRates.length).toBeGreaterThan(0);
  });

  it('downloads current track with toast feedback', () => {
    component.currentTrack = {
      name: 'song.mp3',
      file: new File([''], 'song.mp3'),
      url: 'blob:mock',
      size: 10,
      duration: 1,
      loaded: true
    };
    component.downloadTrack(component.currentTrack);
    expect(toast.info).toHaveBeenCalled();
  });

  it('dismisses contextual suggestions', () => {
    const suggestion = component.primarySuggestion;
    expect(suggestion?.id).toBe('ap-archive');
    if (suggestion) {
      component.dismissSuggestion(suggestion.id);
      expect(component.primarySuggestion).toBeNull();
    }
  });

  it('clears playlist state', () => {
    component.audioFiles = [
      {
        name: 'a.mp3',
        file: new File([''], 'a.mp3'),
        url: 'blob:mock-track',
        size: 1,
        duration: 1,
        loaded: true
      }
    ];
    component.currentTrackIndex = 0;
    component.clearAll();
    expect(component.audioFiles).toEqual([]);
    expect(component.currentTrackIndex).toBe(-1);
    expect(component.currentTrack).toBeNull();
    expect(toast.info).toHaveBeenCalledWith('Playlist cleared');
  });
});
