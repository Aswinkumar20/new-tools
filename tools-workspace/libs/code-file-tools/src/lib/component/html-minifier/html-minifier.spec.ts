import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { cftToolTestProviders } from '../../shared/cft-tool-test.utils';
import { HtmlMinifierComponent } from './html-minifier';

describe('HtmlMinifierComponent', () => {
  let component: HtmlMinifierComponent;
  let fixture: ComponentFixture<HtmlMinifierComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HtmlMinifierComponent],
      providers: [...cftToolTestProviders(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(HtmlMinifierComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create and minify the sample on init', () => {
    expect(component).toBeTruthy();
    expect(component.hasResult()).toBe(true);
    expect(component.minifiedHtml().length).toBeGreaterThan(0);
    expect(component.reductionPercentage()).toBeGreaterThan(0);
  });

  it('clears and reloads sample HTML', () => {
    component.clear();
    expect(component.hasResult()).toBe(false);
    component.loadSample();
    expect(component.hasInput()).toBe(true);
    expect(component.hasResult()).toBe(true);
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
