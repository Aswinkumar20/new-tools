import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { WAV_SPECTRUM_FFT_SIZE } from '../../constants/wav-spectrum-viewer.constants';
import { fileViewerTestProviders } from '../../shared/file-viewer-test.utils';
import { WavSpectrumViewerComponent } from './wav-spectrum-viewer';

describe('WavSpectrumViewerComponent', () => {
  let component: WavSpectrumViewerComponent;
  let fixture: ComponentFixture<WavSpectrumViewerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WavSpectrumViewerComponent],
      providers: [...fileViewerTestProviders(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(WavSpectrumViewerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create with intro suggestion when empty', () => {
    expect(component).toBeTruthy();
    expect(component.audioUrl).toBeNull();
    expect(component.primarySuggestion?.id).toBe('wsv-intro');
    expect(component.relatedTools.length).toBeGreaterThan(0);
    expect(WAV_SPECTRUM_FFT_SIZE).toBe(2048);
  });

  it('rejects non-audio files', async () => {
    await component.handleFiles([new File(['x'], 'notes.txt', { type: 'text/plain' })]);
    expect(component.errorMessage).toMatch(/supported audio/i);
  });
});
