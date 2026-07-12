import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { UnicodeEscapeUnescapeComponent } from './unicode-escape-unescape';
import { AssetService, ToastService } from '@tools-workspace/features-home';

describe('UnicodeEscapeUnescapeComponent', () => {
  let component: UnicodeEscapeUnescapeComponent;
  let fixture: ComponentFixture<UnicodeEscapeUnescapeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UnicodeEscapeUnescapeComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AssetService, useValue: { getAssetPath: (p: string) => p } },
        { provide: ToastService, useValue: { info: jest.fn(), error: jest.fn() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(UnicodeEscapeUnescapeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('unicode-escapes non-ascii characters', () => {
    component.selectMode('encode');
    component.inputText = '€';
    component.onInputChange();
    expect(component.outputText).toContain('\\u');
  });
});
