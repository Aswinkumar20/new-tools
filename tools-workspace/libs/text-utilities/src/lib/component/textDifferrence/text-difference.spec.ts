import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { provideRouter } from '@angular/router';
import { NGX_MONACO_EDITOR_CONFIG } from 'ngx-monaco-editor-v2';
import { textToolTestProviders } from '../../shared/text-tool-test.utils';
import { TextDifferenceComponent } from './text-difference';

describe('TextDifferenceComponent', () => {
  let component: TextDifferenceComponent;
  let fixture: ComponentFixture<TextDifferenceComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TextDifferenceComponent],
      providers: [
        ...textToolTestProviders(),
        provideRouter([]),
        { provide: NGX_MONACO_EDITOR_CONFIG, useValue: {} },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(TextDifferenceComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create with related tools and a suggestion', () => {
    expect(component).toBeTruthy();
    expect(component.relatedTools.length).toBeGreaterThan(0);
    expect(component.primarySuggestion).toBeTruthy();
  });

  it('toggles sidebar visibility', () => {
    expect(component.showSidebar).toBe(true);
    component.toggleSidebar();
    expect(component.showSidebar).toBe(false);
    component.toggleSidebar();
    expect(component.showSidebar).toBe(true);
  });

  it('sets split and unified view modes', () => {
    component.setViewMode(false);
    expect(component.showSideBySide).toBe(false);
    component.setViewMode(true);
    expect(component.showSideBySide).toBe(true);
  });

  it('reports diff stats from models', () => {
    component.originalModel = { ...component.originalModel, code: 'abc' };
    component.modifiedModel = { ...component.modifiedModel, code: 'abcd' };
    component['refreshDiffStats']();
    expect(component.diffStats.originalChars).toBe(3);
    expect(component.diffStats.modifiedChars).toBe(4);
  });

  it('clears both sides and suggests get-started', () => {
    component.clearAll();
    expect(component.originalModel.code).toBe('');
    expect(component.modifiedModel.code).toBe('');
    expect(component.primarySuggestion?.id).toBe('td-get-started');
  });

  it('suggests identical when both sides match', () => {
    component.clearAll();
    component['setOriginalContent']('same');
    component['setModifiedContent']('same');
    expect(component.primarySuggestion?.id).toBe('td-identical');
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
