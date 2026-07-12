import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { BinaryTextConverterComponent } from './binary-text-converter';
import { AssetService, ToastService } from '@tools-workspace/features-home';

describe('BinaryTextConverterComponent', () => {
  let component: BinaryTextConverterComponent;
  let fixture: ComponentFixture<BinaryTextConverterComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BinaryTextConverterComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AssetService, useValue: { getAssetPath: (p: string) => p } },
        { provide: ToastService, useValue: { info: jest.fn(), error: jest.fn() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BinaryTextConverterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('encodes text to binary', () => {
    component.selectMode('encode');
    component.inputText = 'A';
    component.onInputChange();
    expect(component.outputText).toContain('01000001');
  });
});
