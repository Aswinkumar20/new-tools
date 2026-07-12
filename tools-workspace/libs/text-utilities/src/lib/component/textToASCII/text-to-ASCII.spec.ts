import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TextToASCIIComponent } from './text-to-ASCII';
import { AssetService, ToastService } from '@tools-workspace/features-home';

describe('TextToASCIIComponent', () => {
  let component: TextToASCIIComponent;
  let fixture: ComponentFixture<TextToASCIIComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TextToASCIIComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: AssetService,
          useValue: { getAssetPath: (path: string) => path },
        },
        {
          provide: ToastService,
          useValue: { info: jest.fn(), error: jest.fn() },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TextToASCIIComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('converts text to ascii', () => {
    component.leftType = 'text';
    component.rightType = 'ascii';
    component.inputValue = 'Hi';
    component.convert();
    expect(component.outputValue).toBe('72 105');
  });

  it('swaps types and values', () => {
    component.leftType = 'text';
    component.rightType = 'ascii';
    component.inputValue = 'Hi';
    component.convert();
    component.swapTypes();
    expect(component.leftType).toBe('ascii');
    expect(component.rightType).toBe('text');
    expect(component.inputValue).toBe('72 105');
  });
});
