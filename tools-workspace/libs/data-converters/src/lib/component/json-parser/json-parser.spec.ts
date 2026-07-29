import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { converterTestProviders } from '../../shared/converter-test.utils';
import { JsonParserComponent } from './json-parser';

describe('JsonParserComponent', () => {
  let component: JsonParserComponent;
  let fixture: ComponentFixture<JsonParserComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [JsonParserComponent],
      providers: [...converterTestProviders(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(JsonParserComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create and load sample JSON on init', () => {
    expect(component).toBeTruthy();
    expect(component.jsonInput).toContain('Ada Lovelace');
    expect(component.parseStatus.status).toBe('idle');
    expect(component.metrics.lines).toBeGreaterThan(0);
  });

  it('parses sample JSON into a tree', () => {
    component.parseJson();
    expect(component.parseStatus.status).toBe('success');
    expect(component.treeNodes.length).toBeGreaterThan(0);
    expect(component.filteredTree.length).toBeGreaterThan(0);
    expect(component.nodeCount).toBeGreaterThan(1);
    expect(component.operationHistory[0].label).toBe('Parsed JSON successfully');
  });

  it('formats and minifies input JSON', () => {
    component.jsonInput = '{"b":2,"a":1}';
    component.formatJson();
    expect(component.jsonInput).toContain('\n');
    expect(component.parseStatus.message).toContain('formatted');

    component.minifyJson();
    expect(component.jsonInput).toBe('{"b":2,"a":1}');
  });

  it('surfaces parse errors for invalid JSON', () => {
    component.jsonInput = '{"broken":';
    component.parseJson();
    expect(component.parseStatus.status).toBe('error');
    expect(component.diagnostics.length).toBe(1);
    expect(component.treeNodes).toHaveLength(0);
  });

  it('filters tree nodes by term', () => {
    component.parseJson();
    component.filterTree('Ada');
    expect(component.filteredTree.length).toBeGreaterThan(0);
    component.filterTree('');
    expect(component.filteredTree).toEqual(component.treeNodes);
  });

  it('stringifies JSON in the options panel', () => {
    component.stringifyInput = '{"a":1}';
    component.stringifyJsonInput();
    expect(component.stringifyStatus.status).toBe('success');
    expect(component.stringifyOutput).toBe('{"a":1}');
  });

  it('caps operation history at six entries', () => {
    for (let i = 0; i < 8; i++) {
      component.parseJson();
    }
    expect(component.operationHistory.length).toBe(6);
  });

  it('provides a dismissible suggestion for empty input', () => {
    component.onJsonInputChange('');
    expect(component.primarySuggestion?.id).toBe('jp-empty');
    const suggestion = component.primarySuggestion;
    if (suggestion) {
      component.dismissSuggestion(suggestion.id);
      expect(component.primarySuggestion).toBeNull();
    }
  });
});
