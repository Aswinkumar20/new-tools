import { ComponentFixture, TestBed } from '@angular/core/testing';
import { stToolTestProviders } from '../../shared/st-tool-test.utils';
import { TextEncryptDecryptComponent } from './text-encrypt-decrypt';

describe('TextEncryptDecryptComponent', () => {
  let component: TextEncryptDecryptComponent;
  let fixture: ComponentFixture<TextEncryptDecryptComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TextEncryptDecryptComponent],
      providers: stToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(TextEncryptDecryptComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
