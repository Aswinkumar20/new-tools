import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ToastService } from '@tools-workspace/features-home';
import { mathToolTestProviders } from '../../shared/math-tool-test.utils';
import { DateToDayOfWeekComponent } from './date-to-day-of-week';

describe('DateToDayOfWeekComponent', () => {
  let component: DateToDayOfWeekComponent;
  let fixture: ComponentFixture<DateToDayOfWeekComponent>;
  let toast: { info: jest.Mock; error: jest.Mock; success: jest.Mock };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DateToDayOfWeekComponent],
      providers: [...mathToolTestProviders(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(DateToDayOfWeekComponent);
    component = fixture.componentInstance;
    toast = TestBed.inject(ToastService) as unknown as {
      info: jest.Mock;
      error: jest.Mock;
      success: jest.Mock;
    };
    fixture.detectChanges();
  });

  it('should create with details, history, and related tools', () => {
    expect(component).toBeTruthy();
    expect(component.details()?.dayName).toBeTruthy();
    expect(component.details()?.isToday).toBe(true);
    expect(component.relatedTools.length).toBeGreaterThan(0);
    expect(component.primarySuggestion()).toBeTruthy();
    expect(component.hasHistory()).toBe(true);
    expect(component.upcomingWeekdays().length).toBe(3);
  });

  it('applies tomorrow and yesterday presets', fakeAsync(() => {
    component.presetDate('tomorrow');
    tick(150);
    expect(component.details()?.relativeLabel).toBe('Tomorrow');
    expect(toast.info).toHaveBeenCalledWith('Jumped to tomorrow.');

    component.presetDate('yesterday');
    tick(150);
    expect(component.details()?.relativeLabel).toBe('Yesterday');
  }));

  it('selects an upcoming date from the options panel', fakeAsync(() => {
    const upcoming = component.upcomingWeekdays()[0];
    component.selectUpcomingDate(upcoming.date);
    tick(150);
    expect(component.form.controls.inputDate.value).toBe(upcoming.date);
    expect(component.details()?.isoDate).toBe(upcoming.date);
  }));

  it('clears history and restores entries', fakeAsync(() => {
    const entry = component.history()[0];
    component.clearHistory();
    expect(component.hasHistory()).toBe(false);
    expect(toast.info).toHaveBeenCalledWith('History cleared.');

    component.applyHistory(entry);
    tick(150);
    expect(component.form.controls.inputDate.value).toBe(entry.isoDate);
    expect(toast.info).toHaveBeenCalledWith('History entry restored.');
  }));

  it('dismisses contextual suggestions', () => {
    const suggestion = component.primarySuggestion();
    expect(suggestion).toBeTruthy();
    if (suggestion) {
      component.dismissSuggestion(suggestion.id);
      expect(component.primarySuggestion()).toBeNull();
    }
  });

  it('copies results with toast feedback', async () => {
    Object.assign(navigator, {
      clipboard: { writeText: jest.fn().mockResolvedValue(undefined) }
    });
    await component.copyResult();
    expect(toast.info).toHaveBeenCalledWith('Result copied to clipboard');
  });

  it('jumps to the next weekday', fakeAsync(() => {
    component.jumpToWeekday(1);
    tick(150);
    expect(component.form.controls.inputDate.value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(toast.info).toHaveBeenCalledWith('Jumped to the next matching weekday.');
  }));
});
