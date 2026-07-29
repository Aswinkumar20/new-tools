import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { WordWrapUnwrapComponent } from './word-wrap-unwrap';
import { textToolTestProviders } from '../../shared/text-tool-test.utils';

describe('WordWrapUnwrapComponent', () => {
  let component: WordWrapUnwrapComponent;
  let fixture: ComponentFixture<WordWrapUnwrapComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WordWrapUnwrapComponent],
      providers: [...textToolTestProviders(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(WordWrapUnwrapComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create with get-started suggestion and related tools', () => {
    expect(component).toBeTruthy();
    expect(component.primarySuggestion?.id).toBe('wwu-get-started');
    expect(component.relatedTools.length).toBeGreaterThan(0);
  });

  it('wraps text at column width', () => {
    component.setMode('wrap');
    component.wrapWidth = 10;
    component.inputText = 'hello world test';
    component.onInputChange();
    expect(component.outputText).toContain('\n');
    expect(component.hasOutput).toBe(true);
    expect(component.primarySuggestion?.id).toBe('wwu-wrapped');
  });

  it('unwraps hard line breaks', () => {
    component.setMode('unwrap');
    component.inputText = 'hello\nworld';
    component.onInputChange();
    expect(component.outputText).toBe('hello world');
    expect(component.primarySuggestion?.id).toBe('wwu-unwrapped');
  });

  it('suggests already-short when lines fit the width', () => {
    component.setMode('wrap');
    component.wrapWidth = 80;
    component.inputText = 'short line';
    component.onInputChange();
    expect(component.primarySuggestion?.id).toBe('wwu-already-short');
  });

  it('clamps wrap width on change', () => {
    component.wrapWidth = 999;
    component.onWrapWidthChange();
    expect(component.wrapWidth).toBe(500);
  });

  it('dismisses contextual suggestions', () => {
    const suggestion = component.primarySuggestion;
    expect(suggestion).toBeTruthy();
    if (suggestion) {
      component.dismissSuggestion(suggestion.id);
      expect(component.primarySuggestion).toBeNull();
    }
  });
});
