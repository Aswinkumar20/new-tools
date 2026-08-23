import { ElementRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AssetService, ToastService } from '@tools-workspace/features-home';
import { EegViewerComponent } from './eeg-viewer';

describe('EegViewerComponent', () => {
  let fixture: ComponentFixture<EegViewerComponent>;
  let component: EegViewerComponent;
  const toast = { success: jest.fn(), error: jest.fn(), info: jest.fn() };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EegViewerComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ToastService, useValue: toast },
        {
          provide: AssetService,
          useValue: { getAssetPath: (path: string) => `/assets/${path}` }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(EegViewerComponent);
    component = fixture.componentInstance;
    const canvas = document.createElement('canvas');
    component.canvasHost = { nativeElement: canvas } as ElementRef<HTMLCanvasElement>;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('loads sample 8-channel EEG', async () => {
    await component.loadSample();
    expect(component.currentRecording?.name).toBe('sample-8ch-eeg.json');
    expect(component.currentRecording?.waveform.channels.length).toBe(8);
    expect(component.displayChannels.length).toBe(8);
  });

  it('applies bipolar montage with one fewer trace', async () => {
    await component.loadSample();
    component.setMontage('bipolar');
    expect(component.displayChannels.length).toBe(7);
  });

  it('adds caliper measurements in caliper mode', async () => {
    await component.loadSample();
    component.setInteractionMode('caliper');
    component.onCanvasClick({ clientX: 80, clientY: 40 } as MouseEvent);
    component.onCanvasClick({ clientX: 180, clientY: 70 } as MouseEvent);
    expect(component.calipers.length).toBe(1);
    expect(component.calipers[0].deltaTimeMs).toBeGreaterThan(0);
  });
});

