import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ddToolTestProviders } from '../../shared/dd-tool-test.utils';
import { HttpHeaderDecoderComponent } from './http-header-decoder';

describe('HttpHeaderDecoderComponent', () => {
  let component: HttpHeaderDecoderComponent;
  let fixture: ComponentFixture<HttpHeaderDecoderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HttpHeaderDecoderComponent],
      providers: [...ddToolTestProviders(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(HttpHeaderDecoderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create with empty decoded state', () => {
    expect(component).toBeTruthy();
    expect(component.hasDecodedHeaders()).toBe(false);
    expect(component.primarySuggestion()).toBeNull();
  });

  it('decodes raw headers and surfaces a CORS suggestion', () => {
    component.form.patchValue({
      inputMode: 'raw',
      rawHeaders: 'Access-Control-Allow-Origin: *\nContent-Type: application/json'
    });
    component.decodeHeaders();
    expect(component.headerCount()).toBe(2);
    expect(component.corsHeadersCount()).toBe(1);
    expect(component.primarySuggestion()?.id).toBe('hhd-cors');
  });

  it('parses JSON input mode', () => {
    component.form.patchValue({
      inputMode: 'keyvalue',
      rawHeaders: '{"Accept":"application/json"}'
    });
    component.decodeHeaders();
    expect(component.decodedHeaders()[0].key).toBe('Accept');
    expect(component.exportAsJson()).toContain('"Accept"');
  });

  it('warns about skipped raw lines', () => {
    component.form.patchValue({
      inputMode: 'raw',
      rawHeaders: 'Content-Type: text/plain\nnot-a-header'
    });
    component.decodeHeaders();
    expect(component.warnings()[0]).toContain("missing ':'");
  });

  it('copies with toast feedback', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: jest.fn().mockResolvedValue(undefined) }
    });
    component.form.patchValue({ rawHeaders: 'Host: example.com' });
    component.decodeHeaders();
    await component.copyToClipboard(component.exportAsRaw(), 'Raw');
    expect(component.errors()).toEqual([]);
  });

  it('clears state and can restore history', () => {
    component.form.patchValue({ rawHeaders: 'Accept: */*' });
    component.decodeHeaders();
    expect(component.hasHistory()).toBe(true);
    const entry = component.history()[0];
    component.clear();
    expect(component.hasDecodedHeaders()).toBe(false);
    component.applyHistory(entry);
    expect(component.form.controls.rawHeaders.value).toBe(entry.rawInput);
  });
});
