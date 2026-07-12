import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { RegexTesterComponent } from './regex-tester';
import { AssetService, ToastService } from '@tools-workspace/features-home';

describe('RegexTesterComponent', () => {
  let component: RegexTesterComponent;
  let fixture: ComponentFixture<RegexTesterComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RegexTesterComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AssetService, useValue: { getAssetPath: (p: string) => p } },
        { provide: ToastService, useValue: { info: jest.fn(), error: jest.fn() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RegexTesterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('finds regex matches', () => {
    component.pattern = '\\w+';
    component.inputText = 'hello world';
    component.onPatternChange();
    expect(component.matchCount).toBe(2);
  });
});
