import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { HexEncodeDecodeComponent } from './hex-encode-decode';
import { AssetService, ToastService } from '@tools-workspace/features-home';

describe('HexEncodeDecodeComponent', () => {
  let component: HexEncodeDecodeComponent;
  let fixture: ComponentFixture<HexEncodeDecodeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HexEncodeDecodeComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AssetService, useValue: { getAssetPath: (p: string) => p } },
        { provide: ToastService, useValue: { info: jest.fn(), error: jest.fn() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(HexEncodeDecodeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('hex encodes text', () => {
    component.selectMode('encode');
    component.inputText = 'hi';
    component.onInputChange();
    expect(component.outputText.replace(/\s/g, '').toLowerCase()).toBe('6869');
  });
});
