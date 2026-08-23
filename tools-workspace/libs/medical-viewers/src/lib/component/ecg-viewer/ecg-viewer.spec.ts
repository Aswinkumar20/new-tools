import { ElementRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AssetService, ToastService } from '@tools-workspace/features-home';
import { EcgViewerComponent } from './ecg-viewer';

describe('EcgViewerComponent', () => {
  let fixture: ComponentFixture<EcgViewerComponent>;
  let component: EcgViewerComponent;
  const toast = { success: jest.fn(), error: jest.fn(), info: jest.fn() };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EcgViewerComponent],
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

    fixture = TestBed.createComponent(EcgViewerComponent);
    component = fixture.componentInstance;
    const canvas = document.createElement('canvas');
    component.canvasHost = { nativeElement: canvas } as ElementRef<HTMLCanvasElement>;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('loads sample 12-lead ECG with expected leads', async () => {
    await component.loadSample();
    expect(component.currentRecording?.name).toBe('sample-12lead-ecg.json');
    expect(component.currentRecording?.waveform.channels.length).toBe(12);
    expect(component.visibleChannels.length).toBe(12);
  });

  it('adds caliper measurements in caliper mode', async () => {
    await component.loadSample();
    component.setInteractionMode('caliper');
    component.onCanvasClick({ clientX: 100, clientY: 50 } as MouseEvent);
    component.onCanvasClick({ clientX: 200, clientY: 80 } as MouseEvent);
    expect(component.calipers.length).toBe(1);
    expect(component.calipers[0].deltaTimeMs).toBeGreaterThan(0);
  });

  it('applies paper speed presets', async () => {
    await component.loadSample();
    component.setPaperSpeed(200);
    expect(component.pixelsPerSecond).toBe(200);
    component.setPaperSpeed(100);
    expect(component.pixelsPerSecond).toBe(100);
  });
});
