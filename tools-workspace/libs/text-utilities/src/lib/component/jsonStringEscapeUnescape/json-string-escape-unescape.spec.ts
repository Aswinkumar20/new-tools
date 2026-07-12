import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { JsonStringEscapeUnescapeComponent } from './json-string-escape-unescape';
import { AssetService, ToastService } from '@tools-workspace/features-home';

describe('JsonStringEscapeUnescapeComponent', () => {
  let component: JsonStringEscapeUnescapeComponent;
  let fixture: ComponentFixture<JsonStringEscapeUnescapeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [JsonStringEscapeUnescapeComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AssetService, useValue: { getAssetPath: (p: string) => p } },
        { provide: ToastService, useValue: { info: jest.fn(), error: jest.fn() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(JsonStringEscapeUnescapeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('escapes JSON special characters', () => {
    component.selectMode('encode');
    component.inputText = 'line\n"quote"';
    component.onInputChange();
    expect(component.outputText).toContain('\\n');
    expect(component.outputText).toContain('\\"');
  });
});
