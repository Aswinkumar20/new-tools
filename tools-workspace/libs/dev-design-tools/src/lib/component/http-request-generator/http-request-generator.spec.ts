import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ddToolTestProviders } from '../../shared/dd-tool-test.utils';
import { HttpRequestGeneratorComponent } from './http-request-generator';

describe('HttpRequestGeneratorComponent', () => {
  let component: HttpRequestGeneratorComponent;
  let fixture: ComponentFixture<HttpRequestGeneratorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HttpRequestGeneratorComponent],
      providers: ddToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(HttpRequestGeneratorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
