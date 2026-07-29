import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ddToolTestProviders } from '../../shared/dd-tool-test.utils';
import { CorsTestToolComponent } from './cors-test-tool';

describe('CorsTestToolComponent', () => {
  let component: CorsTestToolComponent;
  let fixture: ComponentFixture<CorsTestToolComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CorsTestToolComponent],
      providers: [...ddToolTestProviders(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(CorsTestToolComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create with default GitHub URL', () => {
    expect(component).toBeTruthy();
    expect(component.form.controls.url.value).toBe('https://api.github.com');
    expect(component.form.controls.method.value).toBe('GET');
    expect(component.primarySuggestion()).toBeNull();
  });

  it('rejects invalid URLs before fetching', async () => {
    component.form.controls.url.setValue('not-a-url');
    await component.testCors();
    expect(component.errors().length).toBeGreaterThan(0);
    expect(component.isTesting()).toBe(false);
  });

  it('records a successful fetch into history and surfaces a suggestion', async () => {
    const headers = new Headers({
      'access-control-allow-origin': '*',
      'content-type': 'application/json'
    });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers,
      text: async () => '{"ok":true}'
    }) as unknown as typeof fetch;

    await component.testCors();

    expect(component.hasResult()).toBe(true);
    expect(component.result()?.success).toBe(true);
    expect(component.hasHistory()).toBe(true);
    expect(component.primarySuggestion()?.id).toBe('ctt-json-format');

    const suggestion = component.primarySuggestion();
    if (suggestion) {
      component.dismissSuggestion(suggestion.id);
      expect(component.primarySuggestion()).toBeNull();
    }
  });

  it('handles browser fetch failures as request errors', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Failed to fetch')) as unknown as typeof fetch;

    await component.testCors();

    expect(component.result()?.success).toBe(false);
    expect(component.errors()[0]).toContain('Failed to fetch');
    expect(component.primarySuggestion()?.id).toBe('ctt-cors-blocked');
  });

  it('applies history url and method', () => {
    component.applyHistory({
      timestamp: Date.now(),
      url: 'https://example.com/api',
      method: 'POST',
      success: true,
      status: 201,
      corsHeaders: {}
    });
    expect(component.form.controls.url.value).toBe('https://example.com/api');
    expect(component.form.controls.method.value).toBe('POST');
  });

  it('resets to defaults on clear', () => {
    component.form.patchValue({ url: 'https://other.test', method: 'POST', body: '{}' });
    component.clear();
    expect(component.form.controls.url.value).toBe('https://api.github.com');
    expect(component.form.controls.method.value).toBe('GET');
    expect(component.result()).toBeNull();
  });
});
