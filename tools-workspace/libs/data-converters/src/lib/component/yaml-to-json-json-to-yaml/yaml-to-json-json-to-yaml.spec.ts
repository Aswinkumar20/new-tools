import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { converterTestProviders } from '../../shared/converter-test.utils';
import { YamlToJsonJsonToYamlComponent } from './yaml-to-json-json-to-yaml';

describe('YamlToJsonJsonToYamlComponent', () => {
  let component: YamlToJsonJsonToYamlComponent;
  let fixture: ComponentFixture<YamlToJsonJsonToYamlComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [YamlToJsonJsonToYamlComponent],
      providers: [...converterTestProviders(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(YamlToJsonJsonToYamlComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create and load sample YAML on init', () => {
    expect(component).toBeTruthy();
    expect(component.conversionMode).toBe('yaml-to-json');
    expect(component.yamlInput).toContain('Ada Lovelace');
    expect(component.metrics.lines).toBeGreaterThan(0);
  });

  it('converts YAML to JSON', () => {
    component.convert();
    expect(component.conversionStatus.status).toBe('success');
    expect(component.resultOutput).toContain('"Ada Lovelace"');
    expect(component.operationHistory[0].label).toBe('Converted YAML to JSON');
  });

  it('converts JSON to YAML', () => {
    component.onModeChange('json-to-yaml');
    expect(component.jsonInput).toContain('Atlas');
    component.convert();
    expect(component.conversionStatus.status).toBe('success');
    expect(component.resultOutput).toContain('project:');
    expect(component.operationHistory[0].label).toBe('Converted JSON to YAML');
  });

  it('surfaces an error for empty YAML conversion', () => {
    component.yamlInput = '';
    component.convert();
    expect(component.conversionStatus.status).toBe('error');
    expect(component.conversionStatus.message).toContain('empty');
  });

  it('caps operation history at six entries', () => {
    for (let i = 0; i < 8; i++) {
      component.convert();
    }
    expect(component.operationHistory.length).toBe(6);
  });

  it('applies mode-switch suggestions while preserving input', () => {
    component.yamlInput = '{"project":"Atlas"}';
    component.onYamlInputChange(component.yamlInput);
    expect(component.primarySuggestion?.id).toBe('yj-switch-json');
    component.applySuggestion(component.primarySuggestion!);
    expect(component.conversionMode).toBe('json-to-yaml');
    expect(component.jsonInput).toContain('Atlas');
  });

  it('provides a dismissible empty-state suggestion', () => {
    component.onYamlInputChange('');
    expect(component.primarySuggestion?.id).toBe('yj-empty');
    const suggestion = component.primarySuggestion;
    if (suggestion) {
      component.dismissSuggestion(suggestion.id);
      expect(component.primarySuggestion).toBeNull();
    }
  });
});
