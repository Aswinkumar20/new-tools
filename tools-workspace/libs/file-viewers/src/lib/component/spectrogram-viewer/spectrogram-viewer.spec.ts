import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { fileViewerTestProviders } from '../../shared/file-viewer-test.utils';
import { SpectrogramViewerComponent } from './spectrogram-viewer';

describe('SpectrogramViewerComponent', () => {
  let component: SpectrogramViewerComponent;
  let fixture: ComponentFixture<SpectrogramViewerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SpectrogramViewerComponent],
      providers: [...fileViewerTestProviders(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(SpectrogramViewerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create with intro suggestion when empty', () => {
    expect(component).toBeTruthy();
    expect(component.spectrogramData).toBeNull();
    expect(component.primarySuggestion?.id).toBe('sgv-intro');
    expect(component.relatedTools.length).toBeGreaterThan(0);
  });

  it('rejects non-audio files', async () => {
    await component.handleFiles([new File(['x'], 'notes.txt', { type: 'text/plain' })]);
    expect(component.errorMessage).toMatch(/supported audio/i);
  });

  it('clamps zoom range when start exceeds end', () => {
    component.zoomStart = 80;
    component.zoomEnd = 70;
    component.onZoomChange();
    expect(component.zoomEnd).toBeGreaterThan(component.zoomStart);
  });
});
