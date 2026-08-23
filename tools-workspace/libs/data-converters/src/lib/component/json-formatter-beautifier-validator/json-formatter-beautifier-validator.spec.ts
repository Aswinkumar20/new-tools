import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { converterTestProviders } from '../../shared/converter-test.utils';
import { JsonFormatterBeautifierValidatorComponent } from './json-formatter-beautifier-validator';

describe('JsonFormatterBeautifierValidatorComponent', () => {
  let component: JsonFormatterBeautifierValidatorComponent;
  let fixture: ComponentFixture<JsonFormatterBeautifierValidatorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [JsonFormatterBeautifierValidatorComponent],
      providers: [...converterTestProviders(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(JsonFormatterBeautifierValidatorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create and load sample JSON on init', () => {
    expect(component).toBeTruthy();
    expect(component.rawInput).toContain('JSON Formatter & Validator');
    expect(component.formattedOutputAvailable).toBe(true);
    expect(component.validationResult?.status).toBe('success');
    expect(component.treeNodes.length).toBeGreaterThan(0);
  });

  it('beautifies and minifies valid JSON', () => {
    component.rawInput = '{"b":2,"a":1}';
    component.onRawInputChange(component.rawInput);
    component.formatJson();
    expect(component.formattedOutput).toContain('\n');
    expect(component.lastFormatMode).toBe('beautify');
    expect(component.operationHistory[0].label).toBe('Beautified JSON');

    component.minifyJson();
    expect(component.formattedOutput).toBe('{"b":2,"a":1}');
    expect(component.lastFormatMode).toBe('minify');
  });

  it('surfaces validation errors for invalid JSON', () => {
    component.rawInput = '{"broken":';
    component.validateJson();
    expect(component.validationResult?.status).toBe('error');
    expect(component.activeResultTab).toBe('validation');
  });

  it('auto-fixes trailing commas', () => {
    component.rawInput = '{"a":1,}';
    component.autoFixJson();
    expect(component.validationResult?.status).toBe('success');
    expect(component.rawInput).toContain('"a"');
    expect(component.formattedOutputAvailable).toBe(true);
  });

  it('caps operation history at five entries', () => {
    for (let i = 0; i < 7; i++) {
      component.formatJson();
    }
    expect(component.operationHistory.length).toBe(5);
  });

  it('dismisses contextual suggestions for invalid JSON', () => {
    component.rawInput = "{'a':1,}";
    component.onRawInputChange(component.rawInput);
    expect(component.primarySuggestion).toBeTruthy();
    const suggestion = component.primarySuggestion;
    if (suggestion) {
      component.dismissSuggestion(suggestion.id);
      expect(component.primarySuggestion).toBeNull();
    }
  });
});
