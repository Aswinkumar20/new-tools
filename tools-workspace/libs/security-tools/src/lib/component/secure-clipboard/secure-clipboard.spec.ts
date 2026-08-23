import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SecureClipboardComponent } from './secure-clipboard';

describe('SecureClipboardComponent', () => {
  let component: SecureClipboardComponent;
  let fixture: ComponentFixture<SecureClipboardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SecureClipboardComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(SecureClipboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
