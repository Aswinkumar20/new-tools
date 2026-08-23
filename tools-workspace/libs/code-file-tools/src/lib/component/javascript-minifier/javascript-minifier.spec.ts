import { ComponentFixture, TestBed } from '@angular/core/testing';
import { JavascriptMinifierComponent } from './javascript-minifier';

describe('JavascriptMinifierComponent', () => {
  let component: JavascriptMinifierComponent;
  let fixture: ComponentFixture<JavascriptMinifierComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [JavascriptMinifierComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(JavascriptMinifierComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
