import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BoxShadowGeneratorComponent } from './box-shadow-generator';

describe('BoxShadowGeneratorComponent', () => {
  let component: BoxShadowGeneratorComponent;
  let fixture: ComponentFixture<BoxShadowGeneratorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BoxShadowGeneratorComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(BoxShadowGeneratorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
