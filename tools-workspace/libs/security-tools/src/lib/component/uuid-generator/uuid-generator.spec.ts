import { webcrypto } from 'crypto';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ToastService } from '@tools-workspace/features-home';
import { stToolTestProviders } from '../../shared/st-tool-test.utils';
import { UuidGeneratorComponent } from './uuid-generator';

describe('UuidGeneratorComponent', () => {
  let component: UuidGeneratorComponent;
  let fixture: ComponentFixture<UuidGeneratorComponent>;
  let toast: { info: jest.Mock; error: jest.Mock; success: jest.Mock };

  beforeAll(() => {
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: webcrypto
    });
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UuidGeneratorComponent],
      providers: [...stToolTestProviders(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(UuidGeneratorComponent);
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
    expect(component.primarySuggestion()?.id).toBe('uuid-get-started');
    expect(component.relatedTools.length).toBeGreaterThan(0);
    expect(component.formatLabel()).toBe('hyphen');
  });

  it('generates a single UUID with defaults', () => {
    component.generate();
    expect(component.hasUuids()).toBe(true);
    expect(component.uuids()).toHaveLength(1);
    expect(component.lastUuid()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
    expect(component.errors()).toEqual([]);
  });

  it('applies formatting options and prepends history', () => {
    component.form.patchValue({
      count: 2,
      uppercase: true,
      withHyphens: false,
      withBraces: true
    });
    component.generate();
    expect(component.uuids()).toHaveLength(2);
    expect(component.lastUuid()).toMatch(/^\{[0-9A-F]{32}\}$/);
    expect(component.formatLabel()).toBe('upper+brace');

    component.form.patchValue({ count: 1, uppercase: false, withHyphens: true, withBraces: false });
    component.generate();
    expect(component.uuids()).toHaveLength(3);
  });

  it('rejects out-of-range count', () => {
    component.form.patchValue({ count: 0 });
    component.generate();
    expect(component.hasUuids()).toBe(false);
    expect(component.errors()[0]).toContain('between 1 and 50');
    expect(component.primarySuggestion()?.id).toBe('uuid-count-range');
  });

  it('clears list with toast feedback', () => {
    component.generate();
    component.clearList();
    expect(component.hasUuids()).toBe(false);
    expect(toast.info).toHaveBeenCalledWith('UUID list cleared');
  });

  it('copies UUID and all UUIDs with toast feedback', async () => {
    Object.assign(navigator, {
      clipboard: { writeText: jest.fn().mockResolvedValue(undefined) }
    });
    component.generate();
    await component.copy(component.lastUuid());
    expect(toast.info).toHaveBeenCalledWith('UUID copied to clipboard');

    await component.copyAll();
    expect(toast.info).toHaveBeenCalledWith('All UUIDs copied to clipboard');
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
