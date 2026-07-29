import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ddToolTestProviders } from '../../shared/dd-tool-test.utils';
import { MockJsonGeneratorComponent } from './mock-json-generator';

describe('MockJsonGeneratorComponent', () => {
  let component: MockJsonGeneratorComponent;
  let fixture: ComponentFixture<MockJsonGeneratorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MockJsonGeneratorComponent],
      providers: [...ddToolTestProviders(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(MockJsonGeneratorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create with default mock object', () => {
    expect(component).toBeTruthy();
    expect(component.hasGeneratedJson()).toBe(true);
    expect(component.formattedJson()).toContain('"name"');
    expect(component.primarySuggestion()).toBeNull();
  });

  it('generates an array when object count > 1', () => {
    component.form.controls.arrayCount.setValue(3);
    component.generateJson();
    expect(Array.isArray(JSON.parse(component.generatedJson()))).toBe(true);
  });

  it('warns on duplicate field names', () => {
    component.fields.at(1)?.controls.key.setValue('name');
    component.generateJson();
    expect(component.warnings()[0]).toContain('Duplicate');
    expect(component.primarySuggestion()?.id).toBe('mjg-linter');
  });

  it('shows a dismissible suggestion after copying JSON', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: jest.fn().mockResolvedValue(undefined) }
    });

    await component.copyToClipboard(component.formattedJson(), 'JSON');
    expect(component.primarySuggestion()?.id).toBe('mjg-formatter');
    const suggestion = component.primarySuggestion();
    if (suggestion) {
      component.dismissSuggestion(suggestion.id);
      expect(component.primarySuggestion()).toBeNull();
    }
  });

  it('restores history fields', () => {
    component.form.controls.arrayCount.setValue(2);
    component.generateJson();
    const entry = component.history()[0];
    component.clear();
    component.applyHistory(entry);
    expect(component.generatedJson()).toBe(entry.generatedJson);
    expect(component.fields.length).toBe(entry.fields.length);
  });

  it('resets defaults on clear', () => {
    component.addField();
    component.clear();
    expect(component.fields.length).toBe(3);
    expect(component.form.controls.arrayCount.value).toBe(1);
  });
});
