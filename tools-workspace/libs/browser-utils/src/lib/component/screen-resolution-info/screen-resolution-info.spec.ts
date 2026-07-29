import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { buToolTestProviders } from '../../shared/bu-tool-test.utils';
import { ScreenResolutionInfoComponent } from './screen-resolution-info';

describe('ScreenResolutionInfoComponent', () => {
  let component: ScreenResolutionInfoComponent;
  let fixture: ComponentFixture<ScreenResolutionInfoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ScreenResolutionInfoComponent],
      providers: [...buToolTestProviders(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(ScreenResolutionInfoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create with live metrics', () => {
    expect(component).toBeTruthy();
    expect(component.info().viewportWidth).toBeGreaterThan(0);
    expect(component.info().viewportHeight).toBeGreaterThan(0);
  });

  it('exposes retina detection from DPR', () => {
    const dpr = component.info().devicePixelRatio;
    expect(component.isRetina()).toBe(dpr > 1);
  });

  it('provides a dismissible suggestion', () => {
    const suggestion = component.primarySuggestion();
    expect(suggestion).toBeTruthy();
    if (suggestion) {
      component.dismissSuggestion(suggestion.id);
      expect(component.primarySuggestion()).toBeNull();
    }
  });

  it('refreshes metrics on resize', () => {
    const before = component.info().viewportWidth;
    window.dispatchEvent(new Event('resize'));
    expect(component.info().viewportWidth).toBe(before);
  });
});
