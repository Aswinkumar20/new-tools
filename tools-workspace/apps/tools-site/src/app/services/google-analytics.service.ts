import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

declare global {
  interface Window {
    dataLayer: any[];
    gtag: (...args: any[]) => void;
  }
  // eslint-disable-next-line no-var
  var gtag: ((...args: any[]) => void) | undefined;
}

/**
 * Google Analytics Service
 * Privacy-safe tracking - never tracks user content, personal data, or sensitive information
 * Only tracks metadata: tool names, categories, file sizes/types, actions, errors
 */
@Injectable({
  providedIn: 'root',
})
export class GoogleAnalyticsService {
  private readonly GA_MEASUREMENT_ID = 'G-C7L2T1RHVW';
  private isInitialized = false;
  private toolsUsedInSession = new Set<string>(); // Track unique tools per session
  private sessionStartTime = Date.now();

  constructor(
    @Inject(PLATFORM_ID) private readonly platformId: Object,
    private readonly router: Router
  ) {
    if (isPlatformBrowser(this.platformId)) {
      this.initialize();
      this.initializeSessionTracking();
    }
  }

  /**
   * Initialize Google Analytics
   */
  private initialize(): void {
    if (this.isInitialized || typeof globalThis === 'undefined' || !(globalThis as any).gtag) {
      return;
    }

    this.isInitialized = true;

    // Track route changes for SPA
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed()
      )
      .subscribe((event: NavigationEnd) => {
        this.trackPageView(event.urlAfterRedirects);
      });

    // Track initial pageview
    this.trackPageView(this.router.url);
  }

  /**
   * Track pageview (for SPA navigation)
   * Privacy-safe: Only tracks URL path, not query params with sensitive data
   */
  trackPageView(url: string): void {
    if (!isPlatformBrowser(this.platformId) || !(globalThis as any).gtag) return;

    // Remove query parameters to avoid tracking sensitive data
    const cleanUrl = url.split('?')[0];
    
    // Extract tool info from URL for tracking
    const toolCategory = this.extractToolCategory(cleanUrl);
    const toolName = this.extractToolName(cleanUrl);
    
    (globalThis as any).gtag('config', this.GA_MEASUREMENT_ID, {
      page_path: cleanUrl,
      page_title: this.extractPageTitle(cleanUrl),
      // Add custom dimensions for easier filtering in GA
      tool_category: toolCategory,
      tool_name: toolName,
    });

    // Track tool view for popularity analysis (if it's a tool page)
    if (toolName && toolCategory && toolCategory !== 'tools') {
      this.trackToolViewForPopularity(toolName, toolCategory);
    }
  }

  /**
   * Extract tool category from URL
   */
  private extractToolCategory(url: string): string {
    const parts = url.split('/').filter(Boolean);
    if (parts.length >= 1 && parts[0] !== 'tools') {
      return parts[0];
    }
    return 'home';
  }

  /**
   * Extract tool name from URL
   */
  private extractToolName(url: string): string | undefined {
    const parts = url.split('/').filter(Boolean);
    if (parts.length >= 2) {
      return parts[parts.length - 1];
    }
    return undefined;
  }

  /**
   * Track custom event
   * Privacy-safe: Only tracks action metadata, never user content
   */
  trackEvent(
    eventName: string,
    eventParams?: {
      event_category?: string;
      event_label?: string;
      value?: number;
      tool_name?: string;
      tool_category?: string;
      action_type?: string;
      file_type?: string;
      file_size?: number; // in bytes
      operation_type?: string;
      error_type?: string;
      [key: string]: any;
    }
  ): void {
    if (!isPlatformBrowser(this.platformId) || !(globalThis as any).gtag) return;

    (globalThis as any).gtag('event', eventName, {
      ...eventParams,
      // Ensure no sensitive data is tracked
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Track tool usage
   * Also tracks unique tools per session for analytics
   */
  trackToolUsage(
    toolName: string,
    toolCategory: string,
    action: string = 'view',
    metadata?: {
      file_type?: string;
      file_size?: number;
      operation_type?: string;
      [key: string]: any;
    }
  ): void {
    // Track unique tools used in this session
    const toolKey = `${toolCategory}:${toolName}`;
    const isNewTool = !this.toolsUsedInSession.has(toolKey);
    
    if (isNewTool) {
      this.toolsUsedInSession.add(toolKey);
      
      // Track unique tool count per session
      this.trackEvent('unique_tool_used', {
        event_category: 'user_engagement',
        event_label: toolName,
        tool_name: toolName,
        tool_category: toolCategory,
        tools_used_count: this.toolsUsedInSession.size,
        action_type: 'first_use_in_session',
      });

      // Update user property for tools used count
      this.setUserProperty('tools_used_count', this.toolsUsedInSession.size);
    }

    // Track the actual tool usage event
    this.trackEvent('tool_usage', {
      event_category: toolCategory,
      event_label: toolName,
      tool_name: toolName,
      tool_category: toolCategory,
      action_type: action,
      is_new_tool_in_session: isNewTool,
      total_tools_used: this.toolsUsedInSession.size,
      ...metadata,
    });
  }

  /**
   * Track tool completion (successful operation)
   */
  trackToolCompletion(
    toolName: string,
    toolCategory: string,
    metadata?: {
      file_type?: string;
      file_size?: number;
      operation_type?: string;
      duration_ms?: number;
      [key: string]: any;
    }
  ): void {
    this.trackEvent('tool_completion', {
      event_category: toolCategory,
      event_label: toolName,
      tool_name: toolName,
      tool_category: toolCategory,
      action_type: 'complete',
      ...metadata,
    });
  }

  /**
   * Track tool error
   */
  trackToolError(
    toolName: string,
    toolCategory: string,
    errorType: string,
    errorMessage?: string
  ): void {
    // Only track error type, never the actual error message which might contain user data
    this.trackEvent('tool_error', {
      event_category: toolCategory,
      event_label: toolName,
      tool_name: toolName,
      tool_category: toolCategory,
      error_type: errorType,
      // Don't track error_message to avoid sensitive data
    });
  }

  /**
   * Track file upload (metadata only)
   */
  trackFileUpload(
    toolName: string,
    toolCategory: string,
    fileType: string,
    fileSize: number,
    fileCount: number = 1
  ): void {
    this.trackEvent('file_upload', {
      event_category: toolCategory,
      event_label: toolName,
      tool_name: toolName,
      tool_category: toolCategory,
      file_type: fileType,
      file_size: fileSize,
      file_count: fileCount,
      action_type: 'upload',
    });
  }

  /**
   * Track file download
   */
  trackFileDownload(
    toolName: string,
    toolCategory: string,
    fileType: string,
    fileSize?: number
  ): void {
    this.trackEvent('file_download', {
      event_category: toolCategory,
      event_label: toolName,
      tool_name: toolName,
      tool_category: toolCategory,
      file_type: fileType,
      file_size: fileSize,
      action_type: 'download',
    });
  }

  /**
   * Track button/link click
   */
  trackClick(
    elementName: string,
    elementType: 'button' | 'link' | 'icon' | 'menu',
    location?: string
  ): void {
    this.trackEvent('click', {
      event_category: 'ui_interaction',
      event_label: elementName,
      element_type: elementType,
      location: location,
    });
  }

  /**
   * Track form submission
   */
  trackFormSubmit(
    formName: string,
    toolName?: string,
    toolCategory?: string
  ): void {
    this.trackEvent('form_submit', {
      event_category: 'form',
      event_label: formName,
      tool_name: toolName,
      tool_category: toolCategory,
    });
  }

  /**
   * Track search (query length only, never the query itself)
   */
  trackSearch(
    searchTermLength: number,
    resultCount?: number,
    location?: string
  ): void {
    this.trackEvent('search', {
      event_category: 'search',
      search_term_length: searchTermLength, // Only length, never content
      result_count: resultCount,
      location: location,
    });
  }

  /**
   * Track scroll depth
   */
  trackScrollDepth(depth: number): void {
    this.trackEvent('scroll', {
      event_category: 'engagement',
      scroll_depth: depth,
    });
  }

  /**
   * Track time on page
   */
  trackTimeOnPage(timeInSeconds: number, pagePath: string): void {
    this.trackEvent('time_on_page', {
      event_category: 'engagement',
      time_seconds: timeInSeconds,
      page_path: pagePath.split('?')[0], // Remove query params
    });
  }

  /**
   * Track user engagement
   */
  trackEngagement(
    engagementType: 'hover' | 'focus' | 'interaction',
    elementName?: string
  ): void {
    this.trackEvent('engagement', {
      event_category: 'user_engagement',
      engagement_type: engagementType,
      element_name: elementName,
    });
  }

  /**
   * Track performance metrics
   */
  trackPerformance(
    metricName: string,
    value: number,
    unit: 'ms' | 's' | 'bytes' = 'ms'
  ): void {
    this.trackEvent('performance', {
      event_category: 'performance',
      metric_name: metricName,
      metric_value: value,
      metric_unit: unit,
    });
  }

  /**
   * Track exception/error
   */
  trackException(
    description: string,
    fatal: boolean = false,
    toolName?: string
  ): void {
    // Only track generic error descriptions, never stack traces or user data
    this.trackEvent('exception', {
      event_category: 'error',
      description: description,
      fatal: fatal,
      tool_name: toolName,
    });
  }

  /**
   * Track outbound link click
   */
  trackOutboundLink(url: string): void {
    this.trackEvent('outbound_click', {
      event_category: 'outbound',
      link_url: url,
    });
  }

  /**
   * Track video engagement (if applicable)
   */
  trackVideoEngagement(
    action: 'play' | 'pause' | 'complete' | 'progress',
    videoTitle?: string,
    progress?: number
  ): void {
    this.trackEvent('video_engagement', {
      event_category: 'video',
      video_action: action,
      video_title: videoTitle,
      progress_percent: progress,
    });
  }

  /**
   * Set user properties (non-identifiable)
   */
  setUserProperty(propertyName: string, value: string | number | boolean): void {
    if (!isPlatformBrowser(this.platformId) || !(globalThis as any).gtag) return;

    (globalThis as any).gtag('set', `user_properties.${propertyName}`, value);
  }

  /**
   * Track custom dimension
   */
  setCustomDimension(index: number, value: string): void {
    if (!isPlatformBrowser(this.platformId) || !(globalThis as any).gtag) return;

    (globalThis as any).gtag('config', this.GA_MEASUREMENT_ID, {
      [`custom_dimension_${index}`]: value,
    });
  }

  /**
   * Track user journey step
   */
  trackJourneyStep(
    step: number,
    stepName: string,
    toolName?: string,
    toolCategory?: string
  ): void {
    this.trackEvent('journey_step', {
      event_category: 'user_journey',
      step_number: step,
      step_name: stepName,
      tool_name: toolName,
      tool_category: toolCategory,
    });
  }

  /**
   * Track tool abandonment (user leaves without completing)
   */
  trackToolAbandonment(
    toolName: string,
    toolCategory: string,
    timeSpent: number
  ): void {
    this.trackEvent('tool_abandonment', {
      event_category: toolCategory,
      event_label: toolName,
      tool_name: toolName,
      tool_category: toolCategory,
      time_spent_seconds: timeSpent,
    });
  }

  /**
   * Track tool recommendation click
   */
  trackToolRecommendation(
    recommendedTool: string,
    sourceTool: string,
    sourceCategory: string
  ): void {
    this.trackEvent('tool_recommendation', {
      event_category: 'recommendation',
      recommended_tool: recommendedTool,
      source_tool: sourceTool,
      source_category: sourceCategory,
    });
  }

  /**
   * Extract page title from URL
   */
  private extractPageTitle(url: string): string {
    const pathParts = url.split('/').filter(Boolean);
    if (pathParts.length === 0) return 'Home';
    
    const lastPart = pathParts[pathParts.length - 1];
    return lastPart
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Get file type from file name (privacy-safe)
   */
  getFileType(fileName: string): string {
    const extension = fileName.split('.').pop()?.toLowerCase() || 'unknown';
    return extension;
  }

  /**
   * Format file size for tracking (privacy-safe)
   */
  formatFileSize(bytes: number): number {
    // Round to nearest KB to avoid tracking exact file sizes
    return Math.round(bytes / 1024);
  }

  /**
   * Initialize session tracking
   * Tracks session-level metrics for user engagement
   */
  private initializeSessionTracking(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    // Track session start
    this.trackEvent('session_start', {
      event_category: 'session',
      timestamp: new Date().toISOString(),
    });

    // Track session end when user leaves (using beforeunload)
    window.addEventListener('beforeunload', () => {
      this.trackSessionEnd();
    });

    // Track session end on visibility change (tab switch)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.trackSessionEnd();
      }
    });
  }

  /**
   * Track session end with summary metrics
   */
  private trackSessionEnd(): void {
    const sessionDuration = Math.round((Date.now() - this.sessionStartTime) / 1000);
    
    this.trackEvent('session_end', {
      event_category: 'session',
      session_duration_seconds: sessionDuration,
      tools_used_count: this.toolsUsedInSession.size,
      unique_tools_used: Array.from(this.toolsUsedInSession),
    });
  }

  /**
   * Get current session statistics
   */
  getSessionStats(): {
    toolsUsed: number;
    toolsList: string[];
    sessionDuration: number;
  } {
    return {
      toolsUsed: this.toolsUsedInSession.size,
      toolsList: Array.from(this.toolsUsedInSession),
      sessionDuration: Math.round((Date.now() - this.sessionStartTime) / 1000),
    };
  }

  /**
   * Track most popular tool (for dashboard analytics)
   * This event is optimized for "Top Tools" reports
   */
  trackToolViewForPopularity(
    toolName: string,
    toolCategory: string
  ): void {
    // Use a dedicated event name for easy filtering in GA
    this.trackEvent('tool_view', {
      event_category: 'tool_popularity',
      event_label: toolName,
      tool_name: toolName,
      tool_category: toolCategory,
      // This makes it easy to create "Most Popular Tools" report
    });
  }
}

