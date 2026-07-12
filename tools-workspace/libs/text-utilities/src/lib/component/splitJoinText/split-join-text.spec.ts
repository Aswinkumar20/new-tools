import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { SplitJoinTextComponent } from './split-join-text';
import { AssetService, ToastService } from '@tools-workspace/features-home';

describe('SplitJoinTextComponent', () => {
  let component: SplitJoinTextComponent;
  let fixture: ComponentFixture<SplitJoinTextComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SplitJoinTextComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AssetService, useValue: { getAssetPath: (p: string) => p } },
        { provide: ToastService, useValue: { info: jest.fn(), error: jest.fn() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SplitJoinTextComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('splits text by delimiter', () => {
    component.setMode('split');
    component.delimiter = ',';
    component.inputText = 'a,b,c';
    component.onInputChange();
    expect(component.outputText).toBe('a\nb\nc');
  });

  it('joins lines with delimiter', () => {
    component.setMode('join');
    component.delimiter = ', ';
    component.inputText = 'a\nb\nc';
    component.onInputChange();
    expect(component.outputText).toBe('a, b, c');
  });
});
