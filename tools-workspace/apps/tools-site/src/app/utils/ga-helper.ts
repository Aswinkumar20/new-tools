/**
 * Helper utilities for Google Analytics tracking
 * Provides common patterns and utilities for tracking across the application
 */

import { GoogleAnalyticsService } from '../services/google-analytics.service';

/**
 * Extract tool category from route path
 */
export function getToolCategoryFromPath(path: string): string {
  const parts = path.split('/').filter(Boolean);
  if (parts.length >= 1) {
    return parts[0];
  }
  return 'unknown';
}

/**
 * Extract tool name from route path
 */
export function getToolNameFromPath(path: string): string {
  const parts = path.split('/').filter(Boolean);
  if (parts.length >= 2) {
    return parts[parts.length - 1];
  }
  return 'home';
}

/**
 * Format tool name for display
 */
export function formatToolName(toolName: string): string {
  return toolName
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Track tool lifecycle
 */
export class ToolTrackingHelper {
  private readonly startTime: number;
  private readonly toolName: string;
  private readonly toolCategory: string;
  private readonly gaService: GoogleAnalyticsService;

  constructor(
    gaService: GoogleAnalyticsService,
    toolName: string,
    toolCategory: string
  ) {
    this.gaService = gaService;
    this.toolName = toolName;
    this.toolCategory = toolCategory;
    this.startTime = Date.now();

    // Track tool view
    this.gaService.trackToolUsage(toolName, toolCategory, 'view');
  }

  /**
   * Track tool completion
   */
  trackCompletion(metadata?: {
    file_type?: string;
    file_size?: number;
    operation_type?: string;
    [key: string]: any;
  }): void {
    const duration = Date.now() - this.startTime;
    this.gaService.trackToolCompletion(this.toolName, this.toolCategory, {
      ...metadata,
      duration_ms: duration,
    });
  }

  /**
   * Track tool error
   */
  trackError(errorType: string, errorMessage?: string): void {
    this.gaService.trackToolError(this.toolName, this.toolCategory, errorType, errorMessage);
  }

  /**
   * Track file operation
   */
  trackFileOperation(
    operation: 'upload' | 'download' | 'process',
    fileType: string,
    fileSize?: number,
    fileCount: number = 1
  ): void {
    if (operation === 'upload') {
      this.gaService.trackFileUpload(
        this.toolName,
        this.toolCategory,
        fileType,
        fileSize || 0,
        fileCount
      );
    } else if (operation === 'download') {
      this.gaService.trackFileDownload(
        this.toolName,
        this.toolCategory,
        fileType,
        fileSize
      );
    }
  }

  /**
   * Get time spent in tool
   */
  getTimeSpent(): number {
    return Math.round((Date.now() - this.startTime) / 1000);
  }

  /**
   * Track abandonment (call when user leaves without completing)
   */
  trackAbandonment(): void {
    const timeSpent = this.getTimeSpent();
    this.gaService.trackToolAbandonment(this.toolName, this.toolCategory, timeSpent);
  }
}

/**
 * Track file metadata (privacy-safe)
 */
export function trackFileMetadata(
  gaService: GoogleAnalyticsService,
  toolName: string,
  toolCategory: string,
  file: File | FileList
): void {
  if (file instanceof FileList) {
    const files = Array.from(file);
    const totalSize = files.reduce((sum, f) => sum + f.size, 0);
    const fileType = files[0]?.type || 'unknown';
    
    gaService.trackFileUpload(
      toolName,
      toolCategory,
      fileType,
      totalSize,
      files.length
    );
  } else {
    gaService.trackFileUpload(
      toolName,
      toolCategory,
      file.type || 'unknown',
      file.size,
      1
    );
  }
}

