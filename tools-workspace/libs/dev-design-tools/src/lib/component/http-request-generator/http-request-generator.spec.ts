import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ddToolTestProviders } from '../../shared/dd-tool-test.utils';
import { HttpRequestGeneratorComponent } from './http-request-generator';

describe('HttpRequestGeneratorComponent', () => {
  let component: HttpRequestGeneratorComponent;
  let fixture: ComponentFixture<HttpRequestGeneratorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HttpRequestGeneratorComponent],
      providers: [...ddToolTestProviders(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(HttpRequestGeneratorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create with default fetch snippet', () => {
    expect(component).toBeTruthy();
    expect(component.form.controls.method.value).toBe('GET');
    expect(component.generatedCode()).toContain('fetch(');
    expect(component.primarySuggestion()).toBeNull();
  });

  it('switches code format to curl', () => {
    component.form.controls.codeFormat.setValue('curl');
    component['refreshGeneratedCode']();
    expect(component.generatedCode()).toContain('curl -X GET');
    expect(component.currentFormatLabel()).toBe('cURL');
  });

  it('keeps generating code for invalid URLs while showing an error', () => {
    component.form.controls.url.setValue('not-a-url');
    component['refreshGeneratedCode']();
    expect(component.errors()[0]).toContain('http:// or https://');
    expect(component.generatedCode().length).toBeGreaterThan(0);
  });

  it('records history uniquely by url/method/format', () => {
    component.form.patchValue({ url: 'https://one.test', method: 'POST', codeFormat: 'axios' });
    component['refreshGeneratedCode']();
    component['updateHistory']();
    component['updateHistory']();
    expect(component.history().filter((e) => e.url === 'https://one.test').length).toBe(1);
  });

  it('shows a dismissible CORS suggestion after copy', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: jest.fn().mockResolvedValue(undefined) }
    });

    await component.copyToClipboard(component.generatedCode(), 'Generated code');
    expect(component.primarySuggestion()?.id).toBe('hrg-cors');
    const suggestion = component.primarySuggestion();
    if (suggestion) {
      component.dismissSuggestion(suggestion.id);
      expect(component.primarySuggestion()).toBeNull();
    }
  });

  it('resets defaults on clear', () => {
    component.form.patchValue({ url: 'https://other.test', method: 'POST', body: '{}' });
    component.clear();
    expect(component.form.controls.url.value).toBe('https://api.example.com/endpoint');
    expect(component.form.controls.method.value).toBe('GET');
  });
});
