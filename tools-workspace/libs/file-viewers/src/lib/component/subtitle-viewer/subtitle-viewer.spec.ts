import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ToastService } from '@tools-workspace/features-home';
import { fileViewerTestProviders } from '../../shared/file-viewer-test.utils';
import { SubtitleViewerComponent } from './subtitle-viewer';

describe('SubtitleViewerComponent', () => {
  let component: SubtitleViewerComponent;
  let fixture: ComponentFixture<SubtitleViewerComponent>;
  let toast: { info: jest.Mock; error: jest.Mock; success: jest.Mock };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SubtitleViewerComponent],
      providers: [...fileViewerTestProviders(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(SubtitleViewerComponent);
    component = fixture.componentInstance;
    toast = TestBed.inject(ToastService) as unknown as {
      info: jest.Mock;
      error: jest.Mock;
      success: jest.Mock;
    };
    fixture.detectChanges();
  });

  it('should create with upload suggestion when empty', () => {
    expect(component).toBeTruthy();
    expect(component.cueCount).toBe(0);
    expect(component.primarySuggestion?.id).toBe('sv-video');
    expect(component.relatedTools.length).toBeGreaterThan(0);
    expect(component.formatsLabel).toContain('SRT');
  });

  it('dismisses contextual suggestions', () => {
    const suggestion = component.primarySuggestion;
    expect(suggestion?.id).toBe('sv-video');
    if (suggestion) {
      component.dismissSuggestion(suggestion.id);
      expect(component.primarySuggestion).toBeNull();
    }
  });

  it('loads SRT cues and filters by search', async () => {
    const srt = [
      '1',
      '00:00:01,000 --> 00:00:04,000',
      'Hello world',
      '',
      '2',
      '00:00:05,000 --> 00:00:08,000',
      'Goodbye moon'
    ].join('\n');

    const file = new File([srt], 'demo.srt', { type: 'text/plain' });
    Object.defineProperty(file, 'text', { value: async () => srt });

    await component.handleFiles([file]);

    expect(component.cueCount).toBe(2);
    expect(component.durationLabel).toContain('0:08');

    component.onSearchChange('moon');
    expect(component.filteredCues).toHaveLength(1);
    expect(component.filteredCues[0].text).toBe('Goodbye moon');
    expect(toast.success).toHaveBeenCalled();
  });

  it('copies cue text via clipboard when available', async () => {
    const srt = ['1', '00:00:01,000 --> 00:00:02,000', 'Copy me'].join('\n');
    const file = new File([srt], 'demo.srt');
    Object.defineProperty(file, 'text', { value: async () => srt });
    await component.handleFiles([file]);

    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText }
    });

    await component.copyCueText(component.cues[0]);
    expect(writeText).toHaveBeenCalledWith('Copy me');
    expect(toast.success).toHaveBeenCalledWith('Cue text copied');
  });
});
