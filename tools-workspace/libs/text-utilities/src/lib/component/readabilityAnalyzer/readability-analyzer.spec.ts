import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ReadabilityAnalyzerComponent } from './readability-analyzer';
import { AssetService, ToastService } from '@tools-workspace/features-home';

describe('ReadabilityAnalyzerComponent', () => {
  let component: ReadabilityAnalyzerComponent;
  let fixture: ComponentFixture<ReadabilityAnalyzerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReadabilityAnalyzerComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AssetService, useValue: { getAssetPath: (p: string) => p } },
        { provide: ToastService, useValue: { info: jest.fn(), error: jest.fn() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ReadabilityAnalyzerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('analyzes readability', () => {
    component.inputText = 'The quick brown fox jumps over the lazy dog.';
    component.onInputChange();
    expect(component.readability?.words).toBeGreaterThan(0);
    expect(component.outputText).toContain('Flesch Reading Ease');
  });
});
