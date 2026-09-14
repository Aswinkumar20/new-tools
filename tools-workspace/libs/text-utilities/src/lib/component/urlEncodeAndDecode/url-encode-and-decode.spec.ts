import { ComponentFixture, TestBed } from '@angular/core/testing';
import { UrlEncodeAndDecodeComponent } from './url-encode-and-decode';
import { textToolTestProviders } from '../../shared/text-tool-test.utils';

describe('UrlEncodeAndDecodeComponent', () => {
  let component: UrlEncodeAndDecodeComponent;
  let fixture: ComponentFixture<UrlEncodeAndDecodeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UrlEncodeAndDecodeComponent],
      providers: [...textToolTestProviders()],
    }).compileComponents();

    fixture = TestBed.createComponent(UrlEncodeAndDecodeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('encodes text in encode mode', () => {
    component.selectMode('encode');
    component.inputText = 'hello world';
    component.onInputChange();
    expect(component.hasOutput).toBe(true);
    expect(component.outputText).toBe('hello%20world');
  });

  it('decodes percent-encoded text', () => {
    component.selectMode('decode');
    component.inputText = 'hello%20world';
    component.onInputChange();
    expect(component.outputText).toBe('hello world');
  });
});
