# Automatic Google Analytics Tracking Guide

## 🎉 No Manual Implementation Needed!

The tracking system now **automatically tracks all tools** based on routes. You don't need to add tracking code to each component!

## ✅ What's Automatic

### 1. **Tool View Tracking** (Automatic)
- ✅ Automatically tracks when users visit any tool
- ✅ Identifies tool name and category from route
- ✅ Tracks `tool_usage` and `tool_view` events
- ✅ **No code needed in components!**

### 2. **Route-Based Tracking** (Automatic)
- ✅ All ~100 tools are automatically mapped
- ✅ Tracking happens on route navigation
- ✅ Works for all tools in your library

## 🚀 Optional: Track Actions (Minimal Code)

If you want to track specific actions (like button clicks), you can use simple directives:

### Option 1: Use Directives (Easiest)

```html
<!-- Track any action - automatically uses current tool -->
<button gaToolAction="copy">Copy</button>
<button gaToolAction="download" [gaToolMetadata]="{file_type: 'pdf'}">Download</button>
<button gaToolCompletion [gaToolMetadata]="{duration_ms: 1000}">Complete</button>
```

**That's it!** The directive automatically:
- Knows which tool you're in (from route)
- Tracks the action with correct tool name/category
- No need to specify tool name or category

### Option 2: Use Service (If Needed)

```typescript
import { AutoGATrackerService } from '@tools-workspace/tools-site/app/services/auto-ga-tracker.service';

export class MyComponent {
  constructor(private autoTracker: AutoGATrackerService) {}

  onAction() {
    // Automatically uses current tool from route
    this.autoTracker.trackAction('custom_action', { metadata: 'value' });
  }

  onComplete() {
    // Automatically uses current tool from route
    this.autoTracker.trackCompletion({ duration_ms: 1000 });
  }
}
```

## 📊 What Gets Tracked Automatically

For **every tool** (all ~100 of them):

1. ✅ **Tool View** - When user visits tool
2. ✅ **Tool Usage** - Tracked automatically
3. ✅ **Tool Popularity** - For dashboard reports
4. ✅ **User Count** - Total users per tool
5. ✅ **Route Navigation** - All route changes

## 🎯 Example: Adding Action Tracking

### Before (Manual - Don't Do This)
```typescript
// ❌ Old way - too much code
export class MyComponent {
  private readonly TOOL_NAME = 'my-tool';
  private readonly TOOL_CATEGORY = 'my-category';
  
  ngOnInit() {
    this.gaService.trackToolUsage(this.TOOL_NAME, this.TOOL_CATEGORY, 'view');
  }
  
  onAction() {
    this.gaService.trackEvent('tool_action', {
      tool_name: this.TOOL_NAME,
      tool_category: this.TOOL_CATEGORY,
      action_type: 'copy'
    });
  }
}
```

### After (Automatic - Recommended)
```html
<!-- ✅ New way - just add directive! -->
<button gaToolAction="copy">Copy</button>
```

**That's it!** No TypeScript code needed.

## 📝 Component Template Example

```html
<div>
  <h1>My Tool</h1>
  
  <!-- Actions are automatically tracked -->
  <button gaToolAction="upload" [gaToolMetadata]="{file_count: 1}">
    Upload
  </button>
  
  <button gaToolAction="process">
    Process
  </button>
  
  <button gaToolCompletion [gaToolMetadata]="{duration_ms: 500}">
    Download
  </button>
</div>
```

**No component code changes needed!**

## 🔧 If You Need More Control

If you need custom tracking beyond the automatic system:

```typescript
import { AutoGATrackerService } from '@tools-workspace/tools-site/app/services/auto-ga-tracker.service';

export class MyComponent {
  constructor(private autoTracker: AutoGATrackerService) {}

  customTracking() {
    // Get current tool info
    const tool = this.autoTracker.getCurrentTool();
    if (tool) {
      console.log(`Current tool: ${tool.name} in ${tool.category}`);
    }

    // Track custom action
    this.autoTracker.trackAction('custom_action', {
      custom_param: 'value'
    });
  }
}
```

## 📊 Viewing Data in Google Analytics

All tools are automatically tracked! To view data:

1. **Go to Reports** → **Engagement** → **Events**
2. **Find Event: `tool_usage`**
3. **Filter by Event Parameter: `tool_name`**
4. **See all your tools with user counts!**

## ✅ Summary

### Automatic (No Code Needed)
- ✅ Tool view tracking
- ✅ Tool usage tracking
- ✅ Route-based identification
- ✅ All ~100 tools tracked

### Optional (Minimal Code)
- ✅ Action tracking (use `gaToolAction` directive)
- ✅ Completion tracking (use `gaToolCompletion` directive)
- ✅ Custom tracking (use `AutoGATrackerService`)

## 🎉 Benefits

1. **No Manual Work** - All tools tracked automatically
2. **Consistent** - Same tracking for all tools
3. **Easy** - Just add directives if you want action tracking
4. **Maintainable** - One place to update (route map)
5. **Scalable** - Add new tools to route map, tracking works automatically

---

**You don't need to implement tracking in each component anymore!** 🚀

