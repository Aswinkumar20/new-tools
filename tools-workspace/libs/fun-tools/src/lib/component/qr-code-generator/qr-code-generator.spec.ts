import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ftToolTestProviders } from '../../shared/ft-tool-test.utils';
import { QrCodeGeneratorComponent } from './qr-code-generator';

describe('QrCodeGeneratorComponent', () => {
  let component: QrCodeGeneratorComponent;
  let fixture: ComponentFixture<QrCodeGeneratorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [QrCodeGeneratorComponent],
      providers: ftToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(QrCodeGeneratorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
