import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TextSimilarityComponent } from './text-similarity';
import { AssetService, ToastService } from '@tools-workspace/features-home';

describe('TextSimilarityComponent', () => {
  let component: TextSimilarityComponent;
  let fixture: ComponentFixture<TextSimilarityComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TextSimilarityComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AssetService, useValue: { getAssetPath: (p: string) => p } },
        { provide: ToastService, useValue: { info: jest.fn(), error: jest.fn() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TextSimilarityComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('computes similarity', () => {
    component.inputText = 'kitten';
    component.textB = 'sitting';
    component.onTextBChange();
    expect(component.similarity).toBeGreaterThan(0);
    expect(component.distance).toBeGreaterThan(0);
  });
});
