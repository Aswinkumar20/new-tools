import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ToastService } from '@tools-workspace/features-home';
import { ttToolTestProviders } from '../../shared/tt-tool-test.utils';
import { JsonSchemaValidatorComponent } from './json-schema-validator';

describe('JsonSchemaValidatorComponent', () => {
  let component: JsonSchemaValidatorComponent;
  let fixture: ComponentFixture<JsonSchemaValidatorComponent>;
  let toast: { info: jest.Mock; error: jest.Mock; success: jest.Mock };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [JsonSchemaValidatorComponent],
      providers: [...ttToolTestProviders(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(JsonSchemaValidatorComponent);
    component = fixture.componentInstance;
    toast = TestBed.inject(ToastService) as unknown as {
      info: jest.Mock;
      error: jest.Mock;
      success: jest.Mock;
    };
    fixture.detectChanges();
  });

  it('should create and auto-validate defaults', () => {
    expect(component).toBeTruthy();
    expect(component.hasResult()).toBe(true);
    expect(component.isValid()).toBe(true);
    expect(component.primarySuggestion()?.id).toBe('jsv-valid');
    expect(component.relatedTools.length).toBeGreaterThan(0);
  });

  it('reports missing required properties', () => {
    component.form.patchValue({
      data: JSON.stringify({ name: 'Ada' })
    });
    component.validate();
    expect(component.isValid()).toBe(false);
    expect(component.issues().some((i) => i.path === 'email')).toBe(true);
    expect(component.primarySuggestion()?.id).toBe('jsv-issues');
  });

  it('reports invalid schema JSON', () => {
    component.form.patchValue({ schema: '{ bad' });
    component.validate();
    expect(component.hasResult()).toBe(false);
    expect(component.errors()[0]).toContain('Schema is not valid JSON');
    expect(component.primarySuggestion()?.id).toBe('jsv-schema-json');
  });

  it('clears with toast feedback', () => {
    component.clear();
    expect(component.hasInput()).toBe(false);
    expect(component.hasResult()).toBe(false);
    expect(toast.info).toHaveBeenCalledWith('Cleared');
  });

  it('copies schema with toast feedback', async () => {
    Object.assign(navigator, {
      clipboard: { writeText: jest.fn().mockResolvedValue(undefined) }
    });
    await component.copySchema();
    expect(toast.info).toHaveBeenCalledWith('Schema copied to clipboard');
  });

  it('dismisses contextual suggestions', () => {
    const suggestion = component.primarySuggestion();
    expect(suggestion).toBeTruthy();
    if (suggestion) {
      component.dismissSuggestion(suggestion.id);
      expect(component.primarySuggestion()).toBeNull();
    }
  });
});
