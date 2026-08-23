import { ComponentFixture, TestBed } from '@angular/core/testing';
import { JwtDecoderComponent } from './jwt-decoder';

describe('JwtDecoderComponent', () => {
  let component: JwtDecoderComponent;
  let fixture: ComponentFixture<JwtDecoderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [JwtDecoderComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(JwtDecoderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
