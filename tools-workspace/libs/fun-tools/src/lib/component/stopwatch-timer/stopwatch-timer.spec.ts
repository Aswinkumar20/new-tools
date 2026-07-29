import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ToastService } from '@tools-workspace/features-home';
import { STOPWATCH_TICK_MS } from '../../constants/stopwatch-timer.constants';
import { ftToolTestProviders } from '../../shared/ft-tool-test.utils';
import { StopwatchTimerComponent } from './stopwatch-timer';

describe('StopwatchTimerComponent', () => {
  let component: StopwatchTimerComponent;
  let fixture: ComponentFixture<StopwatchTimerComponent>;
  let toast: { info: jest.Mock; error: jest.Mock; success: jest.Mock };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StopwatchTimerComponent],
      providers: [...ftToolTestProviders(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(StopwatchTimerComponent);
    component = fixture.componentInstance;
    toast = TestBed.inject(ToastService) as unknown as {
      info: jest.Mock;
      error: jest.Mock;
      success: jest.Mock;
    };
    fixture.detectChanges();
  });

  it('should create with pomodoro suggestion and related tools', () => {
    expect(component).toBeTruthy();
    expect(component.primarySuggestion()?.id).toBe('st-pomodoro');
    expect(component.relatedTools.length).toBeGreaterThan(0);
    expect(component.formattedTime()).toBe('00:00.00');
  });

  it('starts, ticks, and pauses', fakeAsync(() => {
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1_000_000);
    component.start();
    expect(component.isRunning()).toBe(true);
    nowSpy.mockReturnValue(1_000_000 + 50);
    tick(STOPWATCH_TICK_MS);
    expect(component.elapsedTime()).toBe(50);
    component.pause();
    expect(component.isRunning()).toBe(false);
    nowSpy.mockRestore();
  }));

  it('records laps and clears them', fakeAsync(() => {
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(2_000_000);
    component.start();
    nowSpy.mockReturnValue(2_000_000 + 1000);
    tick(STOPWATCH_TICK_MS);
    component.lap();
    expect(component.lapTimes().length).toBe(1);
    expect(component.lapTimes()[0].lapTime).toBe(1000);
    component.clearLaps();
    expect(component.hasLaps()).toBe(false);
    expect(component.lastLapTime()).toBe(0);
    component.reset();
    nowSpy.mockRestore();
  }));

  it('ignores lap when idle at zero', () => {
    component.lap();
    expect(component.hasLaps()).toBe(false);
  });

  it('dismisses contextual suggestions', () => {
    const suggestion = component.primarySuggestion();
    expect(suggestion).toBeTruthy();
    if (suggestion) {
      component.dismissSuggestion(suggestion.id);
      expect(component.primarySuggestion()).toBeNull();
    }
  });

  it('copies time with toast feedback', fakeAsync(async () => {
    Object.assign(navigator, {
      clipboard: { writeText: jest.fn().mockResolvedValue(undefined) }
    });
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(3_000_000);
    component.start();
    nowSpy.mockReturnValue(3_000_000 + 100);
    tick(STOPWATCH_TICK_MS);
    component.pause();
    await component.copyTime();
    expect(toast.info).toHaveBeenCalledWith('Time copied to clipboard');
    nowSpy.mockRestore();
  }));
});
