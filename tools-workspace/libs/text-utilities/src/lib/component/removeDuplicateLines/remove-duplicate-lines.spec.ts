import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RemoveDuplicateLines } from './remove-duplicate-lines';

describe('RemoveDuplicateLines', () => {
  let component: RemoveDuplicateLines;
  let fixture: ComponentFixture<RemoveDuplicateLines>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [RemoveDuplicateLines],
    }).compileComponents();

    fixture = TestBed.createComponent(RemoveDuplicateLines);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
