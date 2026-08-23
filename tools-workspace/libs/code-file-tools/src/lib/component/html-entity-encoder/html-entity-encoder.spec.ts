import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { cftToolTestProviders } from '../../shared/cft-tool-test.utils';
import { HtmlEntityEncoderComponent } from './html-entity-encoder';

describe('HtmlEntityEncoderComponent', () => {
  let component: HtmlEntityEncoderComponent;
  let fixture: ComponentFixture<HtmlEntityEncoderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HtmlEntityEncoderComponent],
      providers: [...cftToolTestProviders(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(HtmlEntityEncoderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create and encode the sample on init', () => {
    expect(component).toBeTruthy();
    expect(component.hasOutput()).toBe(true);
    expect(component.outputText()).toContain('&amp;lt;');
  });

  it('switches mode and clears editors', () => {
    component.selectMode('decode');
    expect(component.mode()).toBe('decode');
    component.clear();
    expect(component.inputText()).toBe('');
    expect(component.hasOutput()).toBe(false);
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
