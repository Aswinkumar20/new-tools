import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { cftToolTestProviders } from '../../shared/cft-tool-test.utils';
import { CssMinifierComponent } from './css-minifier';

describe('CssMinifierComponent', () => {
  let component: CssMinifierComponent;
  let fixture: ComponentFixture<CssMinifierComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CssMinifierComponent],
      providers: [...cftToolTestProviders(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(CssMinifierComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create and minify the sample on init', () => {
    expect(component).toBeTruthy();
    expect(component.hasResult()).toBe(true);
    expect(component.minifiedCss().length).toBeGreaterThan(0);
    expect(component.reductionPercentage()).toBeGreaterThan(0);
  });

  it('clears input and result', () => {
    component.clear();
    expect(component.inputCss()).toBe('');
    expect(component.hasResult()).toBe(false);
  });

  it('reloads sample CSS', () => {
    component.clear();
    component.loadSample();
    expect(component.hasInput()).toBe(true);
    expect(component.hasResult()).toBe(true);
  });

  it('records history when rememberHistory is enabled', () => {
    const before = component.history().length;
    component.onInputChange('body { color: red; }');
    expect(component.history().length).toBeGreaterThanOrEqual(before);
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
