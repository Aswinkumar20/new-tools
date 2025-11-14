import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SplitPdfsComponent } from './split-pdfs';

describe('SplitPdfsComponent', () => {
  let component: SplitPdfsComponent;
  let fixture: ComponentFixture<SplitPdfsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SplitPdfsComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(SplitPdfsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
