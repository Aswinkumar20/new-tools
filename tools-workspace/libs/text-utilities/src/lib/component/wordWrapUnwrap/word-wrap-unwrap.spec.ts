import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { WordWrapUnwrapComponent } from './word-wrap-unwrap';
import { AssetService, ToastService } from '@tools-workspace/features-home';

describe('WordWrapUnwrapComponent', () => {
  let component: WordWrapUnwrapComponent;
  let fixture: ComponentFixture<WordWrapUnwrapComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WordWrapUnwrapComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AssetService, useValue: { getAssetPath: (p: string) => p } },
        { provide: ToastService, useValue: { info: jest.fn(), error: jest.fn() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(WordWrapUnwrapComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('wraps text at column width', () => {
    component.setMode('wrap');
    component.wrapWidth = 10;
    component.inputText = 'hello world test';
    component.onInputChange();
    expect(component.outputText).toContain('\n');
    expect(component.hasOutput).toBe(true);
  });

  it('unwraps hard line breaks', () => {
    component.setMode('unwrap');
    component.inputText = 'hello\nworld';
    component.onInputChange();
    expect(component.outputText).toBe('hello world');
  });
});
