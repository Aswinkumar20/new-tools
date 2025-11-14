import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpRequestGeneratorComponent } from './http-request-generator';

describe('HttpRequestGeneratorComponent', () => {
  let component: HttpRequestGeneratorComponent;
  let fixture: ComponentFixture<HttpRequestGeneratorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HttpRequestGeneratorComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(HttpRequestGeneratorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
