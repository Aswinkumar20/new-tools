import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { SortLinesComponent } from './sort-lines';
import { AssetService, ToastService } from '@tools-workspace/features-home';

describe('SortLinesComponent', () => {
  let component: SortLinesComponent;
  let fixture: ComponentFixture<SortLinesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SortLinesComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AssetService, useValue: { getAssetPath: (p: string) => p } },
        { provide: ToastService, useValue: { info: jest.fn(), error: jest.fn() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SortLinesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('sorts lines alphabetically', () => {
    component.inputText = 'c\na\nb';
    component.onInputChange();
    expect(component.outputText).toBe('a\nb\nc');
  });

  it('sorts lines in reverse order', () => {
    component.setSortMode('za');
    component.inputText = 'a\nb\nc';
    component.onInputChange();
    expect(component.outputText).toBe('c\nb\na');
  });
});
