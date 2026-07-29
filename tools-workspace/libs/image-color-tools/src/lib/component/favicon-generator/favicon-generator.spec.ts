import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ToastService } from '@tools-workspace/features-home';
import { FAVICON_INIT_DELAY_MS, FAVICON_RETRY_DELAY_MS } from '../../constants/favicon-generator.constants';
import { ictToolTestProviders } from '../../shared/ict-tool-test.utils';
import { FaviconGeneratorComponent } from './favicon-generator';

function mockCanvasApis(): void {
  const ctx = {
    fillStyle: '',
    font: '',
    textAlign: 'center',
    textBaseline: 'middle',
    clearRect: jest.fn(),
    fillRect: jest.fn(),
    fillText: jest.fn(),
    drawImage: jest.fn()
  };

  HTMLCanvasElement.prototype.getContext = jest.fn(() => ctx) as typeof HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.toDataURL = jest.fn(
    () => 'data:image/png;base64,abc'
  ) as typeof HTMLCanvasElement.prototype.toDataURL;
  HTMLCanvasElement.prototype.toBlob = jest.fn((cb: BlobCallback) => {
    cb(new Blob(['png'], { type: 'image/png' }));
  }) as typeof HTMLCanvasElement.prototype.toBlob;

  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    writable: true,
    value: jest.fn(() => 'blob:favicon')
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    writable: true,
    value: jest.fn()
  });
}

describe('FaviconGeneratorComponent', () => {
  let component: FaviconGeneratorComponent;
  let fixture: ComponentFixture<FaviconGeneratorComponent>;
  let toast: { info: jest.Mock; error: jest.Mock; success: jest.Mock };

  beforeEach(async () => {
    mockCanvasApis();

    await TestBed.configureTestingModule({
      imports: [FaviconGeneratorComponent],
      providers: [...ictToolTestProviders(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(FaviconGeneratorComponent);
    component = fixture.componentInstance;
    toast = TestBed.inject(ToastService) as unknown as {
      info: jest.Mock;
      error: jest.Mock;
      success: jest.Mock;
    };
    fixture.detectChanges();
  });

  function flushGeneration(): void {
    tick(FAVICON_INIT_DELAY_MS);
    tick(FAVICON_RETRY_DELAY_MS);
    if (!component.result()) {
      component.generateFavicon();
    }
  }

  it('should create and generate a default favicon', fakeAsync(() => {
    flushGeneration();
    expect(component).toBeTruthy();
    expect(component.result()?.size).toBe(32);
    expect(component.result()?.htmlCode).toContain('sizes="32x32"');
    expect(component.relatedTools.length).toBeGreaterThan(0);
    expect(component.primarySuggestion()).toBeTruthy();
  }));

  it('records unique history entries', fakeAsync(() => {
    flushGeneration();
    const count = component.history().length;
    expect(count).toBeGreaterThan(0);
    component.generateFavicon();
    expect(component.history().length).toBe(count);
  }));

  it('surfaces image-mode error without upload', fakeAsync(() => {
    flushGeneration();
    component.form.patchValue({ mode: 'image' });
    component.generateFavicon();
    expect(component.errors()[0]).toContain('No image uploaded');
  }));

  it('dismisses contextual suggestions', fakeAsync(() => {
    flushGeneration();
    const suggestion = component.primarySuggestion();
    expect(suggestion).toBeTruthy();
    if (suggestion) {
      component.dismissSuggestion(suggestion.id);
      expect(component.primarySuggestion()).toBeNull();
    }
  }));

  it('copies HTML and downloads with toast feedback', fakeAsync(async () => {
    flushGeneration();
    Object.assign(navigator, {
      clipboard: { writeText: jest.fn().mockResolvedValue(undefined) }
    });
    const clickSpy = jest
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);

    await component.copyHtmlCode();
    expect(toast.info).toHaveBeenCalledWith('HTML copied to clipboard');

    component.downloadFavicon();
    expect(toast.info).toHaveBeenCalledWith('Favicon downloaded');
    clickSpy.mockRestore();
  }));
});
