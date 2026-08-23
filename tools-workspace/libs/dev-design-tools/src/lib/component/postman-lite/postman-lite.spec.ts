import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ToastService } from '@tools-workspace/features-home';
import { ddToolTestProviders } from '../../shared/dd-tool-test.utils';
import { PostmanLiteComponent } from './postman-lite';

describe('PostmanLiteComponent', () => {
  let component: PostmanLiteComponent;
  let fixture: ComponentFixture<PostmanLiteComponent>;
  let toast: { info: jest.Mock; error: jest.Mock; success: jest.Mock };

  beforeEach(async () => {
    localStorage.clear();

    await TestBed.configureTestingModule({
      imports: [PostmanLiteComponent],
      providers: [...ddToolTestProviders(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(PostmanLiteComponent);
    component = fixture.componentInstance;
    toast = TestBed.inject(ToastService) as unknown as {
      info: jest.Mock;
      error: jest.Mock;
      success: jest.Mock;
    };
    fixture.detectChanges();
  });

  it('should create with defaults', () => {
    expect(component).toBeTruthy();
    expect(component.form.controls.method.value).toBe('GET');
    expect(component.form.controls.url.value).toContain('api.github.com');
    expect(component.primarySuggestion()).toBeNull();
  });

  it('rejects invalid URLs before sending', async () => {
    component.form.controls.url.setValue('not-a-url');
    await component.sendRequest();
    expect(component.errors()[0]).toContain('http:// or https://');
    expect(component.isSending()).toBe(false);
  });

  it('soft-validates JSON bodies and suggests the formatter', async () => {
    component.form.patchValue({
      method: 'POST',
      body: '{bad'
    });
    component.headers.at(0)?.patchValue({ key: 'Content-Type', value: 'application/json' });
    await component.sendRequest();
    expect(component.errors()[0]).toContain('not valid JSON');
    expect(component.primarySuggestion()?.id).toBe('pl-json-body');
  });

  it('saves named requests without prompt and persists them', () => {
    component.form.patchValue({
      requestName: 'Octocat',
      url: 'https://api.github.com/users/octocat',
      method: 'GET'
    });
    component.saveRequest();
    expect(component.savedRequests()[0].name).toBe('Octocat');
    expect(toast.info).toHaveBeenCalled();
    expect(localStorage.getItem('postman-lite-saved-requests')).toContain('Octocat');
  });

  it('copies response body via toast clipboard helper', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: jest.fn().mockResolvedValue(undefined) }
    });

    await component.copyToClipboard('{"ok":true}', 'Response body');
    expect(toast.info).toHaveBeenCalled();
    expect(component.errors()).toEqual([]);
  });

  it('resets defaults on clear', () => {
    component.form.patchValue({
      url: 'https://other.test',
      method: 'POST',
      body: '{}',
      requestName: 'X'
    });
    component.clear();
    expect(component.form.controls.url.value).toBe('https://api.github.com/users/octocat');
    expect(component.form.controls.method.value).toBe('GET');
    expect(component.result()).toBeNull();
  });

  it('dismisses contextual suggestions', async () => {
    component.form.patchValue({ method: 'POST', body: '{bad' });
    component.headers.at(0)?.patchValue({ key: 'Content-Type', value: 'application/json' });
    await component.sendRequest();
    const suggestion = component.primarySuggestion();
    expect(suggestion?.id).toBe('pl-json-body');
    if (suggestion) {
      component.dismissSuggestion(suggestion.id);
      expect(component.primarySuggestion()).toBeNull();
    }
  });
});
