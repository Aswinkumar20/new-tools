import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { KeywordDensityComponent } from './keyword-density';
import { AssetService, ToastService } from '@tools-workspace/features-home';

describe('KeywordDensityComponent', () => {
  let component: KeywordDensityComponent;
  let fixture: ComponentFixture<KeywordDensityComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [KeywordDensityComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AssetService, useValue: { getAssetPath: (p: string) => p } },
        { provide: ToastService, useValue: { info: jest.fn(), error: jest.fn() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(KeywordDensityComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('computes keyword density', () => {
    component.inputText = 'hello hello world';
    component.onInputChange();
    expect(component.keywords[0]?.word).toBe('hello');
    expect(component.outputText).toContain('Density');
  });
});
