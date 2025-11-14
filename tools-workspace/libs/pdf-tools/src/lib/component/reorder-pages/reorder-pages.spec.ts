import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReorderPagesComponent } from './reorder-pages';

describe('ReorderPagesComponent', () => {
  let component: ReorderPagesComponent;
  let fixture: ComponentFixture<ReorderPagesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReorderPagesComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(ReorderPagesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
