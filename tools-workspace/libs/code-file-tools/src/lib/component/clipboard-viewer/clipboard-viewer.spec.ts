import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { cftToolTestProviders } from '../../shared/cft-tool-test.utils';
import { processClipboardContent } from '../../utils/clipboard-viewer.utils';
import { ClipboardViewerComponent } from './clipboard-viewer';

describe('ClipboardViewerComponent', () => {
  let component: ClipboardViewerComponent;
  let fixture: ComponentFixture<ClipboardViewerComponent>;

  beforeEach(async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        readText: jest.fn().mockResolvedValue(''),
        writeText: jest.fn().mockResolvedValue(undefined)
      }
    });

    await TestBed.configureTestingModule({
      imports: [ClipboardViewerComponent],
      providers: [...cftToolTestProviders(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(ClipboardViewerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('exposes metadata helpers for processed content', () => {
    component.clipboardContent.set(processClipboardContent('hello world'));
    expect(component.hasContent()).toBe(true);
    expect(component.contentText()).toBe('hello world');
    expect(component.contentMetadata()?.words).toBe(2);
    expect(component.statusLabel()).toBe('Ready');
  });

  it('clears content and feedback state', () => {
    component.clipboardContent.set(processClipboardContent('temp'));
    component.errors.set(['err']);
    component.warnings.set(['warn']);
    component.clearContent();
    expect(component.clipboardContent()).toBeNull();
    expect(component.errors()).toEqual([]);
    expect(component.warnings()).toEqual([]);
  });

  it('provides a dismissible suggestion', () => {
    const suggestion = component.primarySuggestion();
    expect(suggestion).toBeTruthy();
    if (suggestion) {
      component.dismissSuggestion(suggestion.id);
      expect(component.primarySuggestion()).toBeNull();
    }
  });

  it('suggests URL tooling for URL clipboard content', () => {
    component.clipboardContent.set(processClipboardContent('https://example.com'));
    expect(component.primarySuggestion()?.path).toBe('/text-utilities/url-encode-and-decode');
  });
});
