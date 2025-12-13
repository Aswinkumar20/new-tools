import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface ToastConfig {
  message: string;
  duration?: number;
  background?: string;
  textColor?: string;
}

export interface Toast extends ToastConfig {
  id: string;
  duration: number;
  background: string;
  textColor: string;
}

@Injectable({
  providedIn: 'root'
})
export class ToastService {
  private toastsSubject = new BehaviorSubject<Toast[]>([]);
  public toasts$: Observable<Toast[]> = this.toastsSubject.asObservable();

  private defaultDuration = 2000;
  private defaultBackground = '#2563eb';
  private defaultTextColor = '#ffffff';

  /**
   * Show a toast notification
   * @param config Toast configuration
   * @returns The toast ID (can be used to dismiss manually)
   */
  show(config: ToastConfig): string {
    const toast: Toast = {
      id: this.generateId(),
      message: config.message,
      duration: config.duration ?? this.defaultDuration,
      background: config.background ?? this.defaultBackground,
      textColor: config.textColor ?? this.defaultTextColor,
    };

    const currentToasts = this.toastsSubject.value;
    this.toastsSubject.next([...currentToasts, toast]);

    // Auto-dismiss after duration
    if (toast.duration > 0) {
      setTimeout(() => {
        this.dismiss(toast.id);
      }, toast.duration);
    }

    return toast.id;
  }

  /**
   * Show a success toast (green)
   */
  success(message: string, duration?: number): string {
    return this.show({
      message,
      duration,
      background: '#10b981',
      textColor: '#ffffff',
    });
  }

  /**
   * Show an error toast (red)
   */
  error(message: string, duration?: number): string {
    return this.show({
      message,
      duration: duration ?? 4000, // Errors stay longer
      background: '#ef4444',
      textColor: '#ffffff',
    });
  }

  /**
   * Show a warning toast (yellow/orange)
   */
  warning(message: string, duration?: number): string {
    return this.show({
      message,
      duration,
      background: '#f59e0b',
      textColor: '#ffffff',
    });
  }

  /**
   * Show an info toast (blue)
   */
  info(message: string, duration?: number): string {
    return this.show({
      message,
      duration,
      background: '#2563eb',
      textColor: '#ffffff',
    });
  }

  /**
   * Dismiss a specific toast by ID
   */
  dismiss(id: string): void {
    const currentToasts = this.toastsSubject.value;
    this.toastsSubject.next(currentToasts.filter(toast => toast.id !== id));
  }

  /**
   * Dismiss all toasts
   */
  dismissAll(): void {
    this.toastsSubject.next([]);
  }

  /**
   * Get current toasts
   */
  getToasts(): Toast[] {
    return this.toastsSubject.value;
  }

  private generateId(): string {
    return `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

