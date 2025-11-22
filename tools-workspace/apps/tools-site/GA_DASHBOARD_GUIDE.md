# Google Analytics Dashboard Guide

## How to View Tool Usage Analytics

This guide shows you how to find the most popular tools and track how many tools users use in your Google Analytics dashboard.

## 📊 Finding Most Popular Tools

### Method 1: Events Report (Recommended)

1. **Go to Google Analytics Dashboard**
   - Navigate to your GA4 property
   - Go to **Reports** → **Engagement** → **Events**

2. **Find Tool Usage Events**
   - Look for the event: **`tool_view`** or **`tool_usage`**
   - Click on the event name

3. **View Tool Popularity**
   - In the event details, you'll see:
     - **Event count** - Total number of views
     - **Event label** - Tool names
     - **Tool name** parameter - Individual tool names
     - **Tool category** parameter - Tool categories

4. **Create Custom Report**
   - Click **"Create exploration"** or **"Create report"**
   - Add dimensions:
     - `Event name` = `tool_view`
     - `Event parameter: tool_name`
   - Add metrics:
     - `Event count`
     - `Total users`
   - Sort by `Event count` (descending)

### Method 2: Custom Dimensions Report

1. **Go to Reports** → **Explore**
2. **Create Free Form Report**
3. **Add Dimensions:**
   - `Tool name` (custom dimension)
   - `Tool category` (custom dimension)
4. **Add Metrics:**
   - `Event count`
   - `Total users`
   - `Sessions`
5. **Filter:**
   - Event name = `tool_view` or `tool_usage`

### Method 3: Real-time Report

1. **Go to Reports** → **Real-time**
2. **View Events**
   - See which tools are being used right now
   - See event parameters including `tool_name`

## 👥 Tracking How Many Tools Users Use

### Method 1: Unique Tools Per Session

1. **Go to Reports** → **Engagement** → **Events**
2. **Find Event: `unique_tool_used`**
   - This event fires each time a user uses a new tool in their session
   - The parameter `tools_used_count` shows how many unique tools they've used

3. **Create Report:**
   - Dimension: `Event parameter: tools_used_count`
   - Metric: `Total users`
   - This shows distribution: "X users used 1 tool", "Y users used 2 tools", etc.

### Method 2: User Properties Report

1. **Go to Reports** → **User Attributes** → **User properties**
2. **Find Property: `tools_used_count`**
   - Shows how many tools each user has used
   - Updated in real-time as users explore tools

### Method 3: Session End Event

1. **Go to Reports** → **Engagement** → **Events**
2. **Find Event: `session_end`**
   - Parameter: `tools_used_count` - Total unique tools used
   - Parameter: `session_duration_seconds` - How long the session lasted
   - Parameter: `unique_tools_used` - Array of tools used

3. **Create Analysis:**
   - Dimension: `Event parameter: tools_used_count`
   - Metric: `Event count`
   - Shows distribution of tools used per session

## 📈 Creating Custom Dashboards

### Dashboard 1: Most Popular Tools

**Steps:**
1. Go to **Explore** → **Free Form**
2. **Dimensions:**
   - `Event parameter: tool_name`
   - `Event parameter: tool_category`
3. **Metrics:**
   - `Event count`
   - `Total users`
   - `Sessions`
4. **Filters:**
   - Event name = `tool_view`
5. **Visualization:** Table (sorted by Event count)

**What you'll see:**
- List of all tools sorted by popularity
- Number of times each tool was viewed
- Number of unique users per tool
- Tool categories

### Dashboard 2: Tools Per User Distribution

**Steps:**
1. Go to **Explore** → **Free Form**
2. **Dimensions:**
   - `Event parameter: tools_used_count`
3. **Metrics:**
   - `Total users`
   - `Event count`
4. **Filters:**
   - Event name = `unique_tool_used`
5. **Visualization:** Bar chart

**What you'll see:**
- X-axis: Number of tools used (1, 2, 3, 4, etc.)
- Y-axis: Number of users
- Shows: "How many users used 1 tool?", "How many used 2 tools?", etc.

### Dashboard 3: Tool Usage by Category

**Steps:**
1. Go to **Explore** → **Free Form**
2. **Dimensions:**
   - `Event parameter: tool_category`
   - `Event parameter: tool_name`
3. **Metrics:**
   - `Event count`
   - `Total users`
4. **Filters:**
   - Event name = `tool_usage`
5. **Visualization:** Tree map or Table

**What you'll see:**
- Tools grouped by category
- Popularity within each category
- Category-level engagement

## 🔍 Useful Queries & Filters

### Find Top 10 Most Used Tools

```
Event name = "tool_view"
Sort by: Event count (descending)
Limit: 10
```

### Find Users Who Used 5+ Tools

```
Event name = "unique_tool_used"
Event parameter: tools_used_count >= 5
```

### Find Tool Completion Rate

```
Event name = "tool_completion"
Compare with: Event name = "tool_usage"
Calculate: (completions / views) * 100
```

### Find Most Active Tool Categories

```
Event name = "tool_usage"
Group by: Event parameter: tool_category
Sort by: Event count
```

## 📊 Key Metrics to Monitor

### Tool Popularity Metrics
- **Total tool views** - How many times each tool was viewed
- **Unique users per tool** - How many different users used each tool
- **Tool completion rate** - Percentage of views that resulted in completion
- **Average time per tool** - How long users spend on each tool

### User Engagement Metrics
- **Average tools per session** - How many tools users typically use
- **Tools per user** - Distribution of tool usage
- **Power users** - Users who use 5+ tools
- **Single-tool users** - Users who only use one tool

### Category Performance
- **Most popular category** - Which category gets most traffic
- **Category engagement** - Time spent per category
- **Category conversion** - Completion rates by category

## 🎯 Pre-built Reports You Can Create

### Report 1: "Top 20 Most Popular Tools"
- Shows your most-used tools
- Includes views, users, and completion rates

### Report 2: "User Tool Usage Distribution"
- Shows how many users use 1 tool, 2 tools, 3 tools, etc.
- Helps identify power users vs casual users

### Report 3: "Tool Category Performance"
- Compares categories (text-utilities, pdf-tools, etc.)
- Shows which categories are most engaging

### Report 4: "Tool Completion Funnel"
- Shows: View → Usage → Completion
- Identifies tools with low completion rates

## 💡 Pro Tips

1. **Use Date Ranges**
   - Compare this week vs last week
   - Track trends over time

2. **Segment by User Type**
   - New users vs returning users
   - Mobile vs desktop users

3. **Set Up Alerts**
   - Alert when a tool's usage drops significantly
   - Alert when new tools gain popularity

4. **Export Data**
   - Export reports to CSV for further analysis
   - Create scheduled email reports

## 📱 Mobile App Analytics

If you have a mobile app, you can also track:
- Tool usage by device type
- Mobile vs desktop preferences
- App-specific tool usage patterns

## 🔐 Privacy Note

All tracking is privacy-safe:
- ✅ Tool names and categories are tracked
- ✅ Usage counts are tracked
- ❌ User content is NEVER tracked
- ❌ Personal information is NEVER tracked

---

## Quick Reference

**Event Names:**
- `tool_view` - Tool page viewed (for popularity)
- `tool_usage` - Tool actively used
- `tool_completion` - Tool operation completed
- `unique_tool_used` - New tool used in session
- `session_end` - Session ended with summary

**Key Parameters:**
- `tool_name` - Name of the tool
- `tool_category` - Category of the tool
- `tools_used_count` - Number of unique tools used
- `total_tools_used` - Total tools in session

**User Properties:**
- `tools_used_count` - Current count of tools used

---

For more details, see the main tracking guide: `GA_TRACKING_GUIDE.md`

