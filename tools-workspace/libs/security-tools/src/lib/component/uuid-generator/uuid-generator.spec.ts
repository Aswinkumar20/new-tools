import { ComponentFixture, TestBed } from '@angular/core/testing';
import { UuidGeneratorComponent } from './uuid-generator';

describe('UuidGeneratorComponent', () => {
  let component: UuidGeneratorComponent;
  let fixture: ComponentFixture<UuidGeneratorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UuidGeneratorComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(UuidGeneratorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
