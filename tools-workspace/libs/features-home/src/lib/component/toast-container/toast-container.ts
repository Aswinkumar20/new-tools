import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService, Toast } from '../../services/toast.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'lib-toast-container',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './toast-container.html',
  styleUrls: ['./toast-container.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ToastContainerComponent implements OnInit, OnDestroy {
  toasts: Toast[] = [];
  private subscription?: Subscription;

  constructor(
    private toastService: ToastService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.subscription = this.toastService.toasts$.subscribe(toasts => {
      this.toasts = toasts;
      this.cdr.markForCheck();
    });
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  onDismiss(id: string): void {
    this.toastService.dismiss(id);
  }

  getToastStyles(toast: Toast) {
    return {
      background: toast.background,
      color: toast.textColor,
    };
  }
}

