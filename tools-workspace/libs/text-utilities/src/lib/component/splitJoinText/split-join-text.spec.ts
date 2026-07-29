import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { textToolTestProviders } from '../../shared/text-tool-test.utils';
import { SplitJoinTextComponent } from './split-join-text';

describe('SplitJoinTextComponent', () => {
  let component: SplitJoinTextComponent;
  let fixture: ComponentFixture<SplitJoinTextComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SplitJoinTextComponent],
      providers: [...textToolTestProviders(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(SplitJoinTextComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create with get-started suggestion', () => {
    expect(component).toBeTruthy();
    expect(component.mode).toBe('split');
    expect(component.delimiter).toBe(',');
    expect(component.primarySuggestion?.id).toBe('sj-get-started');
    expect(component.relatedTools.length).toBeGreaterThan(0);
  });

  it('splits text by delimiter', () => {
    component.setMode('split');
    component.delimiter = ',';
    component.inputText = 'a,b,c';
    component.onInputChange();
    expect(component.outputText).toBe('a\nb\nc');
    expect(component.primarySuggestion?.id).toBe('sj-split-done');
  });

  it('joins lines with delimiter', () => {
    component.setMode('join');
    component.delimiter = ', ';
    component.inputText = 'a\nb\nc';
    component.onInputChange();
    expect(component.outputText).toBe('a, b, c');
    expect(component.primarySuggestion?.id).toBe('sj-join-done');
  });

  it('suggests join when split input looks like lines', () => {
    component.setMode('split');
    component.delimiter = ',';
    component.inputText = 'alpha\nbeta\ngamma';
    component.onInputChange();
    expect(component.primarySuggestion?.id).toBe('sj-looks-lines');
  });

  it('suggests when delimiter is empty', () => {
    component.setMode('split');
    component.delimiter = '';
    component.onOptionsChange();
    component.inputText = 'a,b';
    component.onInputChange();
    expect(component.primarySuggestion?.id).toBe('sj-empty-delimiter');
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
