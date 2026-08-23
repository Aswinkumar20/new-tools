import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ToastService } from '@tools-workspace/features-home';
import { POMODORO_TICK_MS } from '../../constants/pomodoro-timer.constants';
import { ftToolTestProviders } from '../../shared/ft-tool-test.utils';
import { PomodoroTimerComponent } from './pomodoro-timer';

describe('PomodoroTimerComponent', () => {
  let component: PomodoroTimerComponent;
  let fixture: ComponentFixture<PomodoroTimerComponent>;
  let toast: { info: jest.Mock; error: jest.Mock; success: jest.Mock };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PomodoroTimerComponent],
      providers: [...ftToolTestProviders(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(PomodoroTimerComponent);
    component = fixture.componentInstance;
    toast = TestBed.inject(ToastService) as unknown as {
      info: jest.Mock;
      error: jest.Mock;
      success: jest.Mock;
    };
    fixture.detectChanges();
  });

  it('should create with default work duration and quote suggestion', () => {
    expect(component).toBeTruthy();
    expect(component.timeRemaining()).toBe(25 * 60);
    expect(component.mode()).toBe('work');
    expect(component.primarySuggestion()?.id).toBe('pt-quote');
    expect(component.relatedTools.length).toBeGreaterThan(0);
  });

  it('starts and ticks down once per second', fakeAsync(() => {
    component.startTimer();
    expect(component.isRunning()).toBe(true);
    tick(POMODORO_TICK_MS);
    expect(component.timeRemaining()).toBe(25 * 60 - 1);
    component.pauseTimer();
    expect(component.isRunning()).toBe(false);
  }));

  it('skips work into a short break and toasts', () => {
    component.skipTimer();
    expect(component.completedPomodoros()).toBe(1);
    expect(component.currentSession()).toBe(1);
    expect(component.mode()).toBe('break');
    expect(toast.info).toHaveBeenCalled();
  });

  it('enters long break after the configured interval', () => {
    component.form.controls.longBreakInterval.setValue(2);
    component.skipTimer();
    expect(component.mode()).toBe('break');
    component.skipTimer();
    expect(component.mode()).toBe('work');
    component.skipTimer();
    expect(component.completedPomodoros()).toBe(2);
    expect(component.mode()).toBe('longBreak');
  });

  it('resets stats back to work', () => {
    component.skipTimer();
    component.resetStats();
    expect(component.completedPomodoros()).toBe(0);
    expect(component.currentSession()).toBe(0);
    expect(component.mode()).toBe('work');
    expect(component.timeRemaining()).toBe(25 * 60);
  });

  it('dismisses contextual suggestions', () => {
    const suggestion = component.primarySuggestion();
    expect(suggestion).toBeTruthy();
    if (suggestion) {
      component.dismissSuggestion(suggestion.id);
      expect(component.primarySuggestion()).toBeNull();
    }
  });
});
