import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ToastService } from '@tools-workspace/features-home';
import { buToolTestProviders } from '../../shared/bu-tool-test.utils';
import { CookieEditorComponent } from './cookie-editor';

describe('CookieEditorComponent', () => {
  let component: CookieEditorComponent;
  let fixture: ComponentFixture<CookieEditorComponent>;
  let toast: { info: jest.Mock; error: jest.Mock; success: jest.Mock };

  beforeEach(async () => {
    Object.defineProperty(document, 'cookie', {
      configurable: true,
      writable: true,
      value: 'session=abc123; theme=dark'
    });

    await TestBed.configureTestingModule({
      imports: [CookieEditorComponent],
      providers: [...buToolTestProviders(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(CookieEditorComponent);
    component = fixture.componentInstance;
    toast = TestBed.inject(ToastService) as unknown as {
      info: jest.Mock;
      error: jest.Mock;
      success: jest.Mock;
    };
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('loads cookies from document.cookie', () => {
    expect(component.cookieCount()).toBe(2);
    expect(component.filteredCookies().map((cookie) => cookie.name)).toEqual([
      'session',
      'theme'
    ]);
  });

  it('filters cookies by query', () => {
    component.filterQuery.set('theme');
    expect(component.filteredCookies()).toEqual([{ name: 'theme', value: 'dark' }]);
  });

  it('validates empty cookie names', () => {
    component.form.patchValue({ name: '   ', value: 'x' });
    component.saveCookie();
    expect(component.errors()).toEqual(['Cookie name cannot be empty.']);
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('suggests storage viewer when no cookies exist', () => {
    component.cookies.set([]);
    component.form.patchValue({ value: '' });
    expect(component.primarySuggestion()?.path).toBe('/browser-utils/storage-viewer');
  });

  it('suggests jwt decoder for jwt-like values', () => {
    component.form.patchValue({
      value: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.signature'
    });
    fixture.detectChanges();
    expect(component.primarySuggestion()?.path).toBe('/testing-tools/jwt-decoder');
  });

  it('warns when SameSite=None without Secure', () => {
    component.form.patchValue({ sameSite: 'None', secure: false });
    fixture.detectChanges();
    expect(component.needsSecureForSameSiteNone()).toBe(true);
  });

  it('copies all cookies through shared clipboard helper', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    component.copyAllCookies();
    await Promise.resolve();

    expect(writeText).toHaveBeenCalledWith('session=abc123\ntheme=dark');
    expect(toast.info).toHaveBeenCalledWith('All cookies copied to clipboard');
  });
});
