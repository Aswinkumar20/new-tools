import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { LineNumberToolComponent } from './line-number-tool';
import { AssetService, ToastService } from '@tools-workspace/features-home';

describe('LineNumberToolComponent', () => {
  let component: LineNumberToolComponent;
  let fixture: ComponentFixture<LineNumberToolComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LineNumberToolComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AssetService, useValue: { getAssetPath: (p: string) => p } },
        { provide: ToastService, useValue: { info: jest.fn(), error: jest.fn() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LineNumberToolComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('adds line numbers', () => {
    component.setMode('add');
    component.inputText = 'alpha\nbeta';
    component.onInputChange();
    expect(component.outputText).toBe('1. alpha\n2. beta');
  });

  it('removes line numbers', () => {
    component.setMode('remove');
    component.inputText = '1. alpha\n2. beta';
    component.onInputChange();
    expect(component.outputText).toBe('alpha\nbeta');
  });
});
