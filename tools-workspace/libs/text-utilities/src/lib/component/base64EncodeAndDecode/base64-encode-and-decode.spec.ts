import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Base64EncodeAndDecode } from './base64-encode-and-decode';

describe('Base64EncodeAndDecode', () => {
  let component: Base64EncodeAndDecode;
  let fixture: ComponentFixture<Base64EncodeAndDecode>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [Base64EncodeAndDecode],
    }).compileComponents();

    fixture = TestBed.createComponent(Base64EncodeAndDecode);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
