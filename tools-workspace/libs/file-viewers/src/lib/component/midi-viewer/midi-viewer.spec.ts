import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { fileViewerTestProviders } from '../../shared/file-viewer-test.utils';
import { MidiViewerComponent } from './midi-viewer';

describe('MidiViewerComponent', () => {
  let component: MidiViewerComponent;
  let fixture: ComponentFixture<MidiViewerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MidiViewerComponent],
      providers: [...fileViewerTestProviders(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(MidiViewerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create with related tools when empty', () => {
    expect(component).toBeTruthy();
    expect(component.midiData).toBeNull();
    expect(component.primarySuggestion).toBeNull();
    expect(component.relatedTools.length).toBeGreaterThan(0);
    expect(component.formatsLabel).toContain('MID');
  });

  it('rejects non-MIDI files', async () => {
    await component.handleFiles([new File(['x'], 'notes.txt', { type: 'text/plain' })]);
    expect(component.errorMessage).toMatch(/valid MIDI/i);
  });
});
