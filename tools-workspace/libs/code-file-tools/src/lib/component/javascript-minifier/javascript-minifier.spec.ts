import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { cftToolTestProviders } from '../../shared/cft-tool-test.utils';
import { JavascriptMinifierComponent } from './javascript-minifier';

describe('JavascriptMinifierComponent', () => {
  let component: JavascriptMinifierComponent;
  let fixture: ComponentFixture<JavascriptMinifierComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [JavascriptMinifierComponent],
      providers: [...cftToolTestProviders(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(JavascriptMinifierComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create and minify the sample on init', () => {
    expect(component).toBeTruthy();
    expect(component.hasResult()).toBe(true);
    expect(component.minifiedJs().length).toBeGreaterThan(0);
    expect(component.reductionPercentage()).toBeGreaterThan(0);
  });

  it('clears and reloads sample JavaScript', () => {
    component.clear();
    expect(component.hasResult()).toBe(false);
    component.loadSample();
    expect(component.hasInput()).toBe(true);
    expect(component.hasResult()).toBe(true);
  });

  it('records history when rememberHistory is enabled', () => {
    expect(component.history().length).toBeGreaterThan(0);
    component.clearHistory();
    expect(component.hasHistory()).toBe(false);
  });

  it('provides a dismissible suggestion', () => {
    const suggestion = component.primarySuggestion();
    expect(suggestion).toBeTruthy();
    if (suggestion) {
      component.dismissSuggestion(suggestion.id);
      expect(component.primarySuggestion()).toBeNull();
    }
  });
});
