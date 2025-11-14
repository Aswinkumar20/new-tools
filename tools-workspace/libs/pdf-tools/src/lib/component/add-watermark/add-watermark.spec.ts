import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AddWatermarkComponent } from './add-watermark';

describe('AddWatermarkComponent', () => {
  let component: AddWatermarkComponent;
  let fixture: ComponentFixture<AddWatermarkComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddWatermarkComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(AddWatermarkComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
