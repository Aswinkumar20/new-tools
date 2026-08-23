import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ToastService } from '@tools-workspace/features-home';
import { mtToolTestProviders } from '../../shared/mt-tool-test.utils';
import type { VoiceRecording } from '../../types/voice-recorder.types';
import { VoiceRecorderComponent } from './voice-recorder';

function mockRecording(id: string): VoiceRecording {
  return {
    id,
    audioUrl: 'blob:mock-' + id,
    blob: new Blob(['x'], { type: 'audio/webm' }),
    duration: 12.5,
    timestamp: 1_700_000_000_000,
    size: 2048
  };
}

describe('VoiceRecorderComponent', () => {
  let component: VoiceRecorderComponent;
  let fixture: ComponentFixture<VoiceRecorderComponent>;
  let toast: { info: jest.Mock; error: jest.Mock; success: jest.Mock };

  beforeEach(async () => {
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: jest.fn(() => 'blob:mock')
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: jest.fn()
    });

    await TestBed.configureTestingModule({
      imports: [VoiceRecorderComponent],
      providers: [...mtToolTestProviders(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(VoiceRecorderComponent);
    component = fixture.componentInstance;
    toast = TestBed.inject(ToastService) as unknown as {
      info: jest.Mock;
      error: jest.Mock;
      success: jest.Mock;
    };
    fixture.detectChanges();
  });

  it('should create with trimmer suggestion when empty', () => {
    expect(component).toBeTruthy();
    expect(component.statusLabel()).toBe('Ready');
    expect(component.primarySuggestion()?.id).toBe('vr-trimmer');
    expect(component.relatedTools.length).toBeGreaterThan(0);
    expect(component.visualizerHeights.length).toBe(8);
  });

  it('dismisses contextual suggestions', () => {
    const suggestion = component.primarySuggestion();
    expect(suggestion).toBeTruthy();
    if (suggestion) {
      component.dismissSuggestion(suggestion.id);
      expect(component.primarySuggestion()).toBeNull();
    }
  });

  it('clears recordings with toast feedback', () => {
    const recording = mockRecording('a');
    component.recordings.set([recording]);
    component.currentRecording.set(recording);
    component.clearAllRecordings();
    expect(component.hasRecordings()).toBe(false);
    expect(component.currentRecording()).toBeNull();
    expect(toast.info).toHaveBeenCalledWith('All recordings cleared');
  });

  it('deletes a recording and updates suggestion context', () => {
    const recording = mockRecording('b');
    component.recordings.set([recording]);
    component.currentRecording.set(recording);
    component.deleteRecording('b');
    expect(component.recordings()).toEqual([]);
    expect(toast.info).toHaveBeenCalledWith('Recording deleted');
  });

  it('downloads a recording with toast feedback', () => {
    const recording = mockRecording('c');
    const click = jest.fn();
    const append = jest.spyOn(document.body, 'appendChild').mockImplementation((node) => node);
    const remove = jest.spyOn(document.body, 'removeChild').mockImplementation((node) => node);
    jest.spyOn(document, 'createElement').mockReturnValue({
      href: '',
      download: '',
      click
    } as unknown as HTMLAnchorElement);

    component.downloadRecording(recording);
    expect(click).toHaveBeenCalled();
    expect(toast.info).toHaveBeenCalledWith(expect.stringContaining('recording-'));

    append.mockRestore();
    remove.mockRestore();
    jest.restoreAllMocks();
  });

  it('formats helpers for template', () => {
    expect(component.formatTime(65)).toBe('01:05');
    expect(component.formatFileSize(2048)).toContain('KB');
    expect(component.formatTimestamp(1_700_000_000_000)).toBeTruthy();
  });
});
