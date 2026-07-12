import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ttToolTestProviders } from '../../shared/tt-tool-test.utils';
import { JwtDecoderComponent } from './jwt-decoder';

describe('JwtDecoderComponent', () => {
  let component: JwtDecoderComponent;
  let fixture: ComponentFixture<JwtDecoderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [JwtDecoderComponent],
      providers: ttToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(JwtDecoderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
