import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Rot13CipherComponent } from './rot13-cipher';
import { AssetService, ToastService } from '@tools-workspace/features-home';

describe('Rot13CipherComponent', () => {
  let component: Rot13CipherComponent;
  let fixture: ComponentFixture<Rot13CipherComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Rot13CipherComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AssetService, useValue: { getAssetPath: (p: string) => p } },
        { provide: ToastService, useValue: { info: jest.fn(), error: jest.fn() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Rot13CipherComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('applies ROT13', () => {
    component.inputText = 'Hello';
    component.onInputChange();
    expect(component.outputText).toBe('Uryyb');
  });
});
