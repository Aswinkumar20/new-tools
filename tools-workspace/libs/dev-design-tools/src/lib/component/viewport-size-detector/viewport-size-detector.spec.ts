import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ToastService } from '@tools-workspace/features-home';
import { ddToolTestProviders } from '../../shared/dd-tool-test.utils';
import { ViewportSizeDetectorComponent } from './viewport-size-detector';

describe('ViewportSizeDetectorComponent', () => {
  let component: ViewportSizeDetectorComponent;
  let fixture: ComponentFixture<ViewportSizeDetectorComponent>;
  let toast: { info: jest.Mock; error: jest.Mock; success: jest.Mock };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ViewportSizeDetectorComponent],
      providers: [...ddToolTestProviders(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(ViewportSizeDetectorComponent);
    component = fixture.componentInstance;
    toast = TestBed.inject(ToastService) as unknown as {
      info: jest.Mock;
      error: jest.Mock;
      success: jest.Mock;
    };
    fixture.detectChanges();
  });

  it('should create and read viewport metrics', () => {
    expect(component).toBeTruthy();
    expect(component.viewportInfo()).toBeTruthy();
    expect(component.activeBreakpoint()).toBeTruthy();
    expect(component.primarySuggestion()).toBeTruthy();
  });

  it('copies metrics via toast clipboard helper and suggests simulation', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: jest.fn().mockResolvedValue(undefined) }
    });

    await component.copyMetrics();
    expect(toast.info).toHaveBeenCalled();
    expect(component.primarySuggestion()?.id).toBe('vsd-simulate');
  });

  it('copies JSON metrics', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: jest.fn().mockResolvedValue(undefined) }
    });

    await component.copyJson();
    expect(toast.info).toHaveBeenCalled();
    expect(component.errors()).toEqual([]);
  });

  it('dismisses contextual suggestions', () => {
    const suggestion = component.primarySuggestion();
    expect(suggestion).toBeTruthy();
    if (suggestion) {
      component.dismissSuggestion(suggestion.id);
      expect(component.primarySuggestion()).toBeNull();
    }
  });

  it('clears and removes history entries', () => {
    component['addToHistory'](1000, 800, 1.25);
    component['addToHistory'](1100, 800, 1.375);
    expect(component.hasHistory()).toBe(true);
    const first = component.history()[0];
    component.removeHistoryEntry(first.timestamp);
    expect(component.history().some((entry) => entry.timestamp === first.timestamp)).toBe(false);
    component.clearHistory();
    expect(component.hasHistory()).toBe(false);
  });
});
