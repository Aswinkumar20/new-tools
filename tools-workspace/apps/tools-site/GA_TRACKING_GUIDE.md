# Google Analytics Tracking Guide

This guide explains how to use Google Analytics tracking throughout the tools website. All tracking is **privacy-safe** - we never track user content, personal data, or sensitive information.

## Overview

The tracking system consists of:
- **GoogleAnalyticsService**: Main service for all tracking operations
- **Directives**: Easy-to-use directives for common tracking patterns
- **Helper Utilities**: Helper functions for common tracking scenarios

## Privacy Guidelines

✅ **DO Track:**
- Tool names and categories
- File types and sizes (metadata only)
- User actions (clicks, form submissions)
- Error types (not error messages)
- Performance metrics
- Navigation patterns

❌ **DON'T Track:**
- File contents
- User input text
- Personal information
- Error messages with user data
- Query parameters with sensitive data
- Any identifiable user information

## Basic Usage

### 1. Inject the Service

```typescript
import { GoogleAnalyticsService } from '@tools-workspace/tools-site/app/services/google-analytics.service';

export class MyComponent {
  constructor(private gaService: GoogleAnalyticsService) {}
}
```

### 2. Track Tool Usage

```typescript
// When component initializes
ngOnInit() {
  this.gaService.trackToolUsage('character-counter', 'text-utilities', 'view');
}
```

### 3. Track Tool Completion

```typescript
onConvert() {
  const startTime = Date.now();
  
  // ... perform operation ...
  
  this.gaService.trackToolCompletion('character-counter', 'text-utilities', {
    operation_type: 'convert',
    duration_ms: Date.now() - startTime
  });
}
```

### 4. Track File Operations

```typescript
onFileUpload(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (file) {
    // Only track metadata, never file content
    this.gaService.trackFileUpload(
      'pdf-viewer',
      'file-viewers',
      file.type || 'unknown',
      file.size,
      1
    );
  }
}
```

### 5. Track Errors

```typescript
try {
  // ... operation ...
} catch (error) {
  // Only track error type, not the error message
  this.gaService.trackToolError(
    'merge-pdfs',
    'pdf-tools',
    'file_processing_error'
  );
}
```

## Using Directives

### Click Tracking

```html
<button gaClick="convert-button" gaClickType="button">
  Convert
</button>

<a gaClick="tool-link" gaClickType="link" [gaClickLocation]="'navigation'">
  Go to Tool
</a>
```

### Scroll Tracking

```html
<div gaScroll>
  <!-- Content that scrolls -->
</div>
```

## Using Helper Utilities

### Tool Lifecycle Tracking

```typescript
import { ToolTrackingHelper } from '@tools-workspace/tools-site/app/utils/ga-helper';

export class MyComponent implements OnInit, OnDestroy {
  private trackingHelper?: ToolTrackingHelper;

  constructor(private gaService: GoogleAnalyticsService) {}

  ngOnInit() {
    this.trackingHelper = new ToolTrackingHelper(
      this.gaService,
      'character-counter',
      'text-utilities'
    );
  }

  onComplete() {
    this.trackingHelper?.trackCompletion({
      operation_type: 'count'
    });
  }

  ngOnDestroy() {
    // Track abandonment if not completed
    this.trackingHelper?.trackAbandonment();
  }
}
```

### File Metadata Tracking

```typescript
import { trackFileMetadata } from '@tools-workspace/tools-site/app/utils/ga-helper';

onFileSelect(event: Event) {
  const files = (event.target as HTMLInputElement).files;
  if (files) {
    trackFileMetadata(
      this.gaService,
      'merge-pdfs',
      'pdf-tools',
      files
    );
  }
}
```

## Common Tracking Patterns

### Form Submission

```typescript
onSubmit() {
  this.gaService.trackFormSubmit(
    'converter-form',
    'unit-converter',
    'math-date-utils'
  );
  
  // ... submit form ...
}
```

### Button Clicks

```typescript
onButtonClick(buttonName: string) {
  this.gaService.trackClick(buttonName, 'button', 'tool-interface');
}
```

### Search (Privacy-Safe)

```typescript
onSearch(searchTerm: string) {
  // Only track length, never the search term itself
  this.gaService.trackSearch(
    searchTerm.length,
    results.length,
    'tool-search'
  );
}
```

### Performance Tracking

```typescript
const startTime = Date.now();
// ... perform operation ...
const duration = Date.now() - startTime;

this.gaService.trackPerformance('operation_duration', duration, 'ms');
```

### User Journey

```typescript
// Track multi-step processes
this.gaService.trackJourneyStep(1, 'file-upload', 'merge-pdfs', 'pdf-tools');
this.gaService.trackJourneyStep(2, 'processing', 'merge-pdfs', 'pdf-tools');
this.gaService.trackJourneyStep(3, 'download', 'merge-pdfs', 'pdf-tools');
```

## Available Tracking Methods

### Core Methods
- `trackPageView(url)` - Track page navigation
- `trackEvent(name, params)` - Track custom event
- `trackToolUsage(toolName, category, action)` - Track tool view/usage
- `trackToolCompletion(toolName, category, metadata)` - Track successful operation
- `trackToolError(toolName, category, errorType)` - Track errors

### File Operations
- `trackFileUpload(toolName, category, fileType, fileSize, count)` - Track file uploads
- `trackFileDownload(toolName, category, fileType, fileSize)` - Track downloads

### User Interactions
- `trackClick(elementName, type, location)` - Track clicks
- `trackFormSubmit(formName, toolName, category)` - Track form submissions
- `trackSearch(termLength, resultCount, location)` - Track searches (privacy-safe)
- `trackScrollDepth(depth)` - Track scroll depth
- `trackTimeOnPage(seconds, path)` - Track time spent

### Engagement
- `trackEngagement(type, elementName)` - Track user engagement
- `trackVideoEngagement(action, title, progress)` - Track video interactions

### Performance
- `trackPerformance(metricName, value, unit)` - Track performance metrics
- `trackException(description, fatal, toolName)` - Track exceptions

### Advanced
- `setUserProperty(name, value)` - Set user properties (non-identifiable)
- `setCustomDimension(index, value)` - Set custom dimensions
- `trackJourneyStep(step, name, toolName, category)` - Track user journey
- `trackToolAbandonment(toolName, category, timeSpent)` - Track abandonment
- `trackToolRecommendation(recommended, source, category)` - Track recommendations
- `trackOutboundLink(url)` - Track outbound link clicks

## Example: Complete Tool Component

```typescript
import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { GoogleAnalyticsService } from '@tools-workspace/tools-site/app/services/google-analytics.service';
import { ToolTrackingHelper } from '@tools-workspace/tools-site/app/utils/ga-helper';

@Component({
  selector: 'app-my-tool',
  standalone: true,
  template: `
    <div>
      <input type="file" (change)="onFileSelect($event)" />
      <button gaClick="process-button" (click)="onProcess()">Process</button>
      <button gaClick="download-button" (click)="onDownload()">Download</button>
    </div>
  `,
  imports: [GaClickDirective]
})
export class MyToolComponent implements OnInit, OnDestroy {
  private gaService = inject(GoogleAnalyticsService);
  private trackingHelper?: ToolTrackingHelper;
  private readonly TOOL_NAME = 'my-tool';
  private readonly TOOL_CATEGORY = 'tools-category';

  ngOnInit() {
    // Track tool view
    this.gaService.trackToolUsage(this.TOOL_NAME, this.TOOL_CATEGORY, 'view');
    
    // Initialize tracking helper
    this.trackingHelper = new ToolTrackingHelper(
      this.gaService,
      this.TOOL_NAME,
      this.TOOL_CATEGORY
    );
  }

  onFileSelect(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
      // Track file upload (metadata only)
      this.gaService.trackFileUpload(
        this.TOOL_NAME,
        this.TOOL_CATEGORY,
        file.type || 'unknown',
        file.size,
        1
      );
    }
  }

  onProcess() {
    const startTime = Date.now();
    
    try {
      // ... process file ...
      
      // Track completion
      this.trackingHelper?.trackCompletion({
        operation_type: 'process',
        duration_ms: Date.now() - startTime
      });
    } catch (error) {
      // Track error (type only, not message)
      this.gaService.trackToolError(
        this.TOOL_NAME,
        this.TOOL_CATEGORY,
        'processing_error'
      );
    }
  }

  onDownload() {
    this.gaService.trackFileDownload(
      this.TOOL_NAME,
      this.TOOL_CATEGORY,
      'pdf',
      undefined
    );
  }

  ngOnDestroy() {
    // Track abandonment if not completed
    this.trackingHelper?.trackAbandonment();
  }
}
```

## Automatic Tracking

The following are tracked automatically:
- ✅ Page views (SPA navigation)
- ✅ Route changes
- ✅ JavaScript errors
- ✅ Unhandled promise rejections
- ✅ Core Web Vitals (LCP, FID, CLS)
- ✅ Page load performance
- ✅ Time on page

## Best Practices

1. **Always track tool usage on component init**
2. **Track completion on successful operations**
3. **Track errors on failures (error type only)**
4. **Use helper utilities for common patterns**
5. **Never track user content or personal data**
6. **Track file metadata, not file contents**
7. **Use directives for simple click tracking**
8. **Track abandonment when users leave without completing**

## Testing

To test tracking in development:
1. Open browser DevTools
2. Go to Network tab
3. Filter by "collect" or "gtag"
4. Perform actions and verify events are sent
5. Check that no sensitive data is included

## Privacy Compliance

All tracking follows these principles:
- ✅ No PII (Personally Identifiable Information)
- ✅ No user content tracking
- ✅ No file content tracking
- ✅ Only metadata and aggregated data
- ✅ Compliant with GDPR and privacy regulations

