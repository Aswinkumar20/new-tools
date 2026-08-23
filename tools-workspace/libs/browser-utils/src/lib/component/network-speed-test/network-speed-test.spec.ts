import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ToastService } from '@tools-workspace/features-home';
import { buToolTestProviders } from '../../shared/bu-tool-test.utils';
import { NetworkSpeedTestComponent } from './network-speed-test';

describe('NetworkSpeedTestComponent', () => {
  let component: NetworkSpeedTestComponent;
  let fixture: ComponentFixture<NetworkSpeedTestComponent>;
  let toast: { info: jest.Mock; error: jest.Mock; success: jest.Mock };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NetworkSpeedTestComponent],
      providers: [...buToolTestProviders(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(NetworkSpeedTestComponent);
    component = fixture.componentInstance;
    toast = TestBed.inject(ToastService) as unknown as {
      info: jest.Mock;
      error: jest.Mock;
      success: jest.Mock;
    };
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('validates empty url before running', async () => {
    component.form.patchValue({ url: '   ' });
    await component.runTest();
    expect(component.errors()).toEqual(['Enter a URL to download from.']);
    expect(component.isRunning()).toBe(false);
  });

  it('formats metrics via shared helpers', () => {
    expect(component.formatMbps(1.234)).toBe('1.23 Mbps');
    expect(component.formatMs(12.6)).toBe('13 ms');
    expect(component.formatBytes(1024)).toBe('1.00 KB');
  });

  it('suggests battery check when idle with no results', () => {
    component.results.set([]);
    component.errors.set([]);
    expect(component.primarySuggestion()?.path).toBe('/browser-utils/battery-status-viewer');
  });

  it('suggests cors tool when fetch failed', () => {
    component.errors.set(['Run 1 failed: Failed to fetch']);
    expect(component.primarySuggestion()?.path).toBe('/dev-design-tools/cors-test-tool');
  });

  it('clears results with toast feedback', () => {
    component.results.set([
      {
        url: 'https://example.com/file.bin',
        bytes: 1000,
        durationMs: 100,
        mbps: 1,
        timestamp: Date.now()
      }
    ]);
    component.clearResults();
    expect(component.results()).toEqual([]);
    expect(toast.info).toHaveBeenCalledWith('Results cleared');
  });

  it('copies results through shared clipboard helper', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText }
    });

    component.results.set([
      {
        url: 'https://example.com/file.bin',
        bytes: 1024,
        durationMs: 200,
        mbps: 2.5,
        timestamp: 1_700_000_000_000
      }
    ]);

    component.copyResults();
    await Promise.resolve();

    expect(writeText).toHaveBeenCalled();
    expect(toast.info).toHaveBeenCalledWith('Speed test results copied to clipboard');
  });
});
