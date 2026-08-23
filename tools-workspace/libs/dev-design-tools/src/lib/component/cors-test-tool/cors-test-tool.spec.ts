import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CorsTestToolComponent } from './cors-test-tool';

describe('CorsTestToolComponent', () => {
  let component: CorsTestToolComponent;
  let fixture: ComponentFixture<CorsTestToolComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CorsTestToolComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(CorsTestToolComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
