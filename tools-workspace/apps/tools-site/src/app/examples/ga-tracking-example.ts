/**
 * Example: How to integrate Google Analytics tracking into a tool component
 * 
 * This is a reference implementation showing best practices for tracking
 * Copy and adapt these patterns to your tool components
 */

import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { GoogleAnalyticsService } from '../services/google-analytics.service';
import { ToolTrackingHelper, getToolCategoryFromPath, getToolNameFromPath } from '../utils/ga-helper';
import { GaClickDirective } from '../directives/ga-click.directive';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-example-tool',
  standalone: true,
  template: `
    <div>
      <h1>Example Tool</h1>
      
      <!-- Use directive for simple click tracking -->
      <button gaClick="upload-button" gaClickType="button" (click)="onUpload()">
        Upload File
      </button>
      
      <button gaClick="process-button" gaClickType="button" (click)="onProcess()">
        Process
      </button>
      
      <button gaClick="download-button" gaClickType="button" (click)="onDownload()">
        Download
      </button>
      
      <input 
        type="file" 
        (change)="onFileSelect($event)"
        accept=".pdf,.txt"
      />
      
      <form (ngSubmit)="onFormSubmit()">
        <input type="text" name="input" />
        <button type="submit" gaClick="submit-form">Submit</button>
      </form>
    </div>
  `,
  imports: [GaClickDirective]
})
export class ExampleToolComponent implements OnInit, OnDestroy {
  // Inject GA service
  private readonly gaService = inject(GoogleAnalyticsService);
  private readonly route = inject(ActivatedRoute);
  
  // Tool metadata
  private readonly TOOL_NAME = 'example-tool';
  private readonly TOOL_CATEGORY = 'example-category';
  
  // Tracking helper for lifecycle management
  private trackingHelper?: ToolTrackingHelper;
  private hasCompleted = false;

  ngOnInit(): void {
    // Option 1: Use hardcoded tool name/category
    this.gaService.trackToolUsage(this.TOOL_NAME, this.TOOL_CATEGORY, 'view');
    
    // Option 2: Extract from route (if route matches tool structure)
    const path = this.route.snapshot.url.join('/');
    const toolCategory = getToolCategoryFromPath(path);
    const toolName = getToolNameFromPath(path);
    
    // Initialize tracking helper
    this.trackingHelper = new ToolTrackingHelper(
      this.gaService,
      this.TOOL_NAME,
      this.TOOL_CATEGORY
    );
  }

  onFileSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = input.files;
    
    if (files && files.length > 0) {
      const file = files[0];
      
      // Track file upload (metadata only - never file content)
      this.gaService.trackFileUpload(
        this.TOOL_NAME,
        this.TOOL_CATEGORY,
        file.type || 'unknown',
        file.size,
        files.length
      );
      
      // Alternative: Use helper method
      this.trackingHelper?.trackFileOperation(
        'upload',
        file.type || 'unknown',
        file.size,
        files.length
      );
    }
  }

  onUpload(): void {
    // Track button click is handled by directive, but you can also track here
    this.gaService.trackClick('upload-button', 'button', 'tool-interface');
  }

  onProcess(): void {
    const startTime = Date.now();
    
    try {
      // ... perform processing ...
      
      // Track completion
      this.hasCompleted = true;
      this.trackingHelper?.trackCompletion({
        operation_type: 'process',
        duration_ms: Date.now() - startTime
      });
      
      // Or use service directly
      this.gaService.trackToolCompletion(
        this.TOOL_NAME,
        this.TOOL_CATEGORY,
        {
          operation_type: 'process',
          duration_ms: Date.now() - startTime
        }
      );
    } catch (error) {
      // Track error (type only, never error message)
      this.gaService.trackToolError(
        this.TOOL_NAME,
        this.TOOL_CATEGORY,
        'processing_error'
      );
      
      // Or use helper
      this.trackingHelper?.trackError('processing_error');
    }
  }

  onDownload(): void {
    // Track download
    this.gaService.trackFileDownload(
      this.TOOL_NAME,
      this.TOOL_CATEGORY,
      'pdf',
      undefined // file size if available
    );
  }

  onFormSubmit(): void {
    // Track form submission
    this.gaService.trackFormSubmit(
      'example-form',
      this.TOOL_NAME,
      this.TOOL_CATEGORY
    );
  }

  ngOnDestroy(): void {
    // Track abandonment if user leaves without completing
    if (!this.hasCompleted) {
      this.trackingHelper?.trackAbandonment();
    }
  }
}

/**
 * Example: Tracking in a text processing tool
 */
@Component({
  selector: 'app-text-tool-example',
  standalone: true,
  template: `
    <div>
      <textarea 
        (input)="onTextChange($event)"
        placeholder="Enter text..."
      ></textarea>
      
      <button gaClick="convert-button" (click)="onConvert()">Convert</button>
      <button gaClick="copy-button" (click)="onCopy()">Copy</button>
    </div>
  `,
  imports: [GaClickDirective]
})
export class TextToolExampleComponent implements OnInit {
  private readonly gaService = inject(GoogleAnalyticsService);
  private readonly TOOL_NAME = 'text-converter';
  private readonly TOOL_CATEGORY = 'text-utilities';
  
  private textLength = 0;
  private conversionCount = 0;

  ngOnInit(): void {
    this.gaService.trackToolUsage(this.TOOL_NAME, this.TOOL_CATEGORY, 'view');
  }

  onTextChange(event: Event): void {
    const text = (event.target as HTMLTextAreaElement).value;
    this.textLength = text.length;
    
    // Track engagement (but never the text content)
    if (text.length > 0) {
      this.gaService.trackEngagement('interaction', 'text-input');
    }
  }

  onConvert(): void {
    const startTime = Date.now();
    
    // ... perform conversion ...
    
    this.conversionCount++;
    
    // Track completion with metadata
    this.gaService.trackToolCompletion(
      this.TOOL_NAME,
      this.TOOL_CATEGORY,
      {
        operation_type: 'convert',
        text_length: this.textLength, // Only length, never content
        conversion_count: this.conversionCount,
        duration_ms: Date.now() - startTime
      }
    );
  }

  onCopy(): void {
    // Track copy action
    this.gaService.trackEvent('copy_action', {
      event_category: this.TOOL_CATEGORY,
      event_label: this.TOOL_NAME,
      tool_name: this.TOOL_NAME,
      tool_category: this.TOOL_CATEGORY
    });
  }
}

/**
 * Example: Tracking search functionality (privacy-safe)
 */
export class SearchExample {
  private readonly gaService = inject(GoogleAnalyticsService);

  onSearch(searchTerm: string, results: any[]): void {
    // Only track length, never the search term itself
    this.gaService.trackSearch(
      searchTerm.length,
      results.length,
      'tool-search'
    );
  }
}

/**
 * Example: Tracking multi-step process
 */
export class MultiStepExample {
  private readonly gaService = inject(GoogleAnalyticsService);
  private readonly TOOL_NAME = 'multi-step-tool';
  private readonly TOOL_CATEGORY = 'tools';

  step1(): void {
    this.gaService.trackJourneyStep(1, 'file-upload', this.TOOL_NAME, this.TOOL_CATEGORY);
  }

  step2(): void {
    this.gaService.trackJourneyStep(2, 'processing', this.TOOL_NAME, this.TOOL_CATEGORY);
  }

  step3(): void {
    this.gaService.trackJourneyStep(3, 'download', this.TOOL_NAME, this.TOOL_CATEGORY);
    
    // Track completion
    this.gaService.trackToolCompletion(this.TOOL_NAME, this.TOOL_CATEGORY, {
      operation_type: 'multi-step-process'
    });
  }
}

