import { webcrypto } from 'crypto';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ToastService } from '@tools-workspace/features-home';
import { stToolTestProviders } from '../../shared/st-tool-test.utils';
import { HashGeneratorComponent } from './hash-generator';

describe('HashGeneratorComponent', () => {
  let component: HashGeneratorComponent;
  let fixture: ComponentFixture<HashGeneratorComponent>;
  let toast: { info: jest.Mock; error: jest.Mock; success: jest.Mock };

  beforeAll(() => {
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: webcrypto
    });
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HashGeneratorComponent],
      providers: [...stToolTestProviders(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(HashGeneratorComponent);
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
    expect(component.primarySuggestion()?.id).toBe('hg-get-started');
    expect(component.relatedTools.length).toBeGreaterThan(0);
    expect(component.hasInput()).toBe(false);
  });

  it('generates a SHA-256 digest', async () => {
    component.form.patchValue({ input: 'hello', algorithm: 'sha256' });
    await component.generate();
    expect(component.hasResult()).toBe(true);
    expect(component.result()?.lengthBits).toBe(256);
    expect(component.displayHex()).toHaveLength(64);
    expect(component.errors()).toEqual([]);
  });

  it('rejects unsupported algorithms with guidance', async () => {
    component.form.patchValue({ input: 'hello', algorithm: 'md5' });
    await component.generate();
    expect(component.hasResult()).toBe(false);
    expect(component.errors()[0]).toContain('MD5 and SHA-1');
    expect(component.primarySuggestion()?.id).toBe('hg-unsupported-algo');
  });

  it('clears state with toast feedback', async () => {
    component.form.patchValue({ input: 'hello' });
    await component.generate();
    component.clear();
    expect(component.form.controls.input.value).toBe('');
    expect(component.hasResult()).toBe(false);
    expect(toast.info).toHaveBeenCalledWith('Cleared');
  });

  it('copies hex output with toast feedback', async () => {
    Object.assign(navigator, {
      clipboard: { writeText: jest.fn().mockResolvedValue(undefined) }
    });
    component.form.patchValue({ input: 'abc', algorithm: 'sha256' });
    await component.generate();
    await component.copyHex();
    expect(toast.info).toHaveBeenCalledWith('Hex hash copied to clipboard');
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
