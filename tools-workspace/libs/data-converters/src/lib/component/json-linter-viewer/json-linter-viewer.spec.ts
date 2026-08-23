import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { converterTestProviders } from '../../shared/converter-test.utils';
import { JsonLinterViewerComponent } from './json-linter-viewer';

describe('JsonLinterViewerComponent', () => {
  let component: JsonLinterViewerComponent;
  let fixture: ComponentFixture<JsonLinterViewerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [JsonLinterViewerComponent],
      providers: [...converterTestProviders(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(JsonLinterViewerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create and load sample JSON on init', () => {
    expect(component).toBeTruthy();
    expect(component.jsonInput).toContain('World Cities');
    expect(component.conversionStatus.status).toBe('idle');
    expect(component.metrics.lines).toBeGreaterThan(0);
  });

  it('validates sample JSON successfully', () => {
    component.validateJson();
    expect(component.conversionStatus.status).toBe('success');
    expect(component.resultOutput).toContain('Tokyo');
    expect(component.diagnostics.some((d) => d.level === 'info')).toBe(true);
    expect(component.operationHistory[0].label).toBe('Validated JSON');
  });

  it('formats JSON with indentation', () => {
    component.jsonInput = '{"b":2,"a":1}';
    component.onJsonInputChange(component.jsonInput);
    component.formatJson();
    expect(component.conversionStatus.status).toBe('success');
    expect(component.resultOutput).toContain('\n');
    expect(component.operationHistory[0].label).toBe('Formatted JSON');
  });

  it('surfaces an error for invalid JSON', () => {
    component.jsonInput = '{"broken":';
    component.validateJson();
    expect(component.conversionStatus.status).toBe('error');
    expect(component.diagnostics[0].level).toBe('error');
  });

  it('strips trailing commas when enabled', () => {
    component.allowTrailingCommas = true;
    component.jsonInput = '{"a":1,}';
    component.validateJson();
    expect(component.conversionStatus.status).toBe('success');
    expect(component.diagnostics.some((d) => d.message.includes('trailing commas'))).toBe(true);
  });

  it('caps operation history at six entries', () => {
    for (let i = 0; i < 8; i++) {
      component.validateJson();
    }
    expect(component.operationHistory.length).toBe(6);
  });

  it('provides a dismissible suggestion for empty input', () => {
    component.onJsonInputChange('');
    expect(component.primarySuggestion?.id).toBe('jlv-empty');
    const suggestion = component.primarySuggestion;
    if (suggestion) {
      component.dismissSuggestion(suggestion.id);
      expect(component.primarySuggestion).toBeNull();
    }
  });
});
