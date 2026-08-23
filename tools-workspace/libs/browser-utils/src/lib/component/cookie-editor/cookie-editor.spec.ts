import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CookieEditorComponent } from './cookie-editor';

describe('CookieEditorComponent', () => {
  let component: CookieEditorComponent;
  let fixture: ComponentFixture<CookieEditorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CookieEditorComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(CookieEditorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
