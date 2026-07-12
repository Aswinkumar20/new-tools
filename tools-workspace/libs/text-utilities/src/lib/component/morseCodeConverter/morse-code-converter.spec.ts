import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { MorseCodeConverterComponent } from './morse-code-converter';
import { AssetService, ToastService } from '@tools-workspace/features-home';

describe('MorseCodeConverterComponent', () => {
  let component: MorseCodeConverterComponent;
  let fixture: ComponentFixture<MorseCodeConverterComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MorseCodeConverterComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AssetService, useValue: { getAssetPath: (p: string) => p } },
        { provide: ToastService, useValue: { info: jest.fn(), error: jest.fn() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MorseCodeConverterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('encodes text to morse', () => {
    component.selectMode('encode');
    component.inputText = 'SOS';
    component.onInputChange();
    expect(component.outputText).toContain('...');
    expect(component.hasOutput).toBe(true);
  });
});
