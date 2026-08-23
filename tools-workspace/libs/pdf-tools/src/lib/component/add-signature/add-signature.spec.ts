import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AddSignatureComponent } from './add-signature';

describe('AddSignatureComponent', () => {
  let component: AddSignatureComponent;
  let fixture: ComponentFixture<AddSignatureComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddSignatureComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(AddSignatureComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
