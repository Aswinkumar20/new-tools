import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TrimNormalizeWhitespaceComponent } from './trim-normalize-whitespace';
import { AssetService, ToastService } from '@tools-workspace/features-home';

describe('TrimNormalizeWhitespaceComponent', () => {
  let component: TrimNormalizeWhitespaceComponent;
  let fixture: ComponentFixture<TrimNormalizeWhitespaceComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TrimNormalizeWhitespaceComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AssetService, useValue: { getAssetPath: (p: string) => p } },
        { provide: ToastService, useValue: { info: jest.fn(), error: jest.fn() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TrimNormalizeWhitespaceComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('trims line edges', () => {
    component.inputText = '  hello  \n  world  ';
    component.onInputChange();
    expect(component.outputText).toBe('hello\nworld');
  });
});
