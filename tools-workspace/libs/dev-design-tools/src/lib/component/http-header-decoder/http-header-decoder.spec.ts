import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ddToolTestProviders } from '../../shared/dd-tool-test.utils';
import { HttpHeaderDecoderComponent } from './http-header-decoder';

describe('HttpHeaderDecoderComponent', () => {
  let component: HttpHeaderDecoderComponent;
  let fixture: ComponentFixture<HttpHeaderDecoderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HttpHeaderDecoderComponent],
      providers: ddToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(HttpHeaderDecoderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
