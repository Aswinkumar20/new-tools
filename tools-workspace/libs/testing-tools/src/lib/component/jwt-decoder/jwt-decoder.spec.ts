import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ToastService } from '@tools-workspace/features-home';
import { ttToolTestProviders } from '../../shared/tt-tool-test.utils';
import { JwtDecoderComponent } from './jwt-decoder';

const SAMPLE_JWT =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

describe('JwtDecoderComponent', () => {
  let component: JwtDecoderComponent;
  let fixture: ComponentFixture<JwtDecoderComponent>;
  let toast: { info: jest.Mock; error: jest.Mock; success: jest.Mock };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [JwtDecoderComponent],
      providers: [...ttToolTestProviders(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(JwtDecoderComponent);
    component = fixture.componentInstance;
    toast = TestBed.inject(ToastService) as unknown as {
      info: jest.Mock;
      error: jest.Mock;
      success: jest.Mock;
    };
    fixture.detectChanges();
  });

  it('should create with get-started suggestion', () => {
    expect(component).toBeTruthy();
    expect(component.primarySuggestion()?.id).toBe('jwt-get-started');
    expect(component.relatedTools.length).toBeGreaterThan(0);
  });

  it('decodes a sample JWT on input', () => {
    component.form.controls.token.setValue(SAMPLE_JWT);
    component.onTokenInput();
    expect(component.hasDecoded()).toBe(true);
    expect(component.errors()).toEqual([]);
    expect(component.decoded()?.payload.json).toContain('"sub"');
    expect(component.primarySuggestion()?.id).toBe('jwt-decoded');
    expect(component.tokenParts()).toBe(3);
  });

  it('warns for unsigned tokens', () => {
    const unsigned = SAMPLE_JWT.split('.').slice(0, 2).join('.');
    component.form.controls.token.setValue(unsigned);
    component.onTokenInput();
    expect(component.warnings()[0]).toContain('No signature');
    expect(component.primarySuggestion()?.id).toBe('jwt-unsigned');
  });

  it('reports invalid part count while still decoding', () => {
    component.form.controls.token.setValue('not-a-jwt');
    component.onTokenInput();
    expect(component.errors()[0]).toContain('2 or 3 parts');
    expect(component.hasDecoded()).toBe(true);
    expect(component.primarySuggestion()?.id).toBe('jwt-parts');
  });

  it('toggles compact JSON when pretty print changes', () => {
    component.form.controls.token.setValue(SAMPLE_JWT);
    component.onTokenInput();
    component.form.controls.prettyPrint.setValue(false);
    component.onOptionChange();
    expect(component.decoded()?.header.json).toBe('{"alg":"HS256","typ":"JWT"}');
  });

  it('clears with toast feedback', () => {
    component.form.controls.token.setValue(SAMPLE_JWT);
    component.onTokenInput();
    component.clear();
    expect(component.hasToken()).toBe(false);
    expect(component.hasDecoded()).toBe(false);
    expect(toast.info).toHaveBeenCalledWith('Cleared');
    expect(component.primarySuggestion()?.id).toBe('jwt-get-started');
  });

  it('copies token with toast feedback', async () => {
    Object.assign(navigator, {
      clipboard: { writeText: jest.fn().mockResolvedValue(undefined) }
    });
    component.form.controls.token.setValue(SAMPLE_JWT);
    component.onTokenInput();
    await component.copyToken();
    expect(toast.info).toHaveBeenCalledWith('Token copied to clipboard');
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
