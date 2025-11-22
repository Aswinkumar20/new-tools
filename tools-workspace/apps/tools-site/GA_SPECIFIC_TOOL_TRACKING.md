# Tracking Specific Tools in Google Analytics

## Example: Words & Character Counter Tool

This guide shows you how to view detailed analytics for a specific tool (like `wordsAndCharacterCounter`) in your Google Analytics dashboard.

## ✅ What's Being Tracked

For the **Words & Character Counter** tool, the following events are automatically tracked:

### 1. **Tool Usage Events**
- `tool_usage` - When user views/uses the tool
- `tool_view` - When user navigates to the tool page
- `unique_tool_used` - First time user uses this tool in session

### 2. **Interaction Events**
- `tool_action` - User actions within the tool:
  - `copy_text` - User copies text
  - `copy_stats` - User copies statistics
  - `clear_text` - User clears text
- `click` - Button clicks (copy, stats, download, clear)

### 3. **Analysis Events**
- `text_analysis` - Every time text is analyzed (with text length metadata)
- `tool_first_analysis` - First time user analyzes text in session

### 4. **Completion Events**
- `tool_completion` - Successful operations:
  - `download_pdf` - PDF download completed
  - `download_txt` - TXT download completed

### 5. **Session Events**
- `tool_session_summary` - Summary when user leaves tool
- `session_end` - End of session with tool usage summary

## 📊 How to View in Google Analytics Dashboard

### Method 1: Find Total Users for Words & Character Counter

1. **Go to Reports** → **Engagement** → **Events**
2. **Find Event: `tool_usage`**
3. **Click on the event** to see details
4. **Filter by Event Parameter: `tool_name` = `character-counter`**
5. **View Metrics:**
   - **Total users** - How many unique users used the tool
   - **Event count** - Total number of times tool was used
   - **Total sessions** - Number of sessions that used the tool

### Method 2: Using Event Parameters

1. **Go to Reports** → **Explore** → **Free Form**
2. **Add Dimensions:**
   - `Event name`
   - `Event parameter: tool_name`
3. **Add Metrics:**
   - `Total users`
   - `Event count`
4. **Add Filter:**
   - `Event parameter: tool_name` = `character-counter`
5. **Visualization:** Table

**Result:** You'll see all events for this tool with user counts.

### Method 3: User Count by Tool

1. **Go to Reports** → **Engagement** → **Events**
2. **Find Event: `tool_view`**
3. **Click on it**
4. **View Event Parameters:**
   - Look for `tool_name` parameter
   - Find `character-counter` in the list
   - See **Total users** next to it

## 🔍 Viewing Interactions & Events

### See All Interactions for Words & Character Counter

1. **Go to Reports** → **Explore** → **Free Form**
2. **Add Dimensions:**
   - `Event name`
   - `Event parameter: action_type`
3. **Add Metrics:**
   - `Total users`
   - `Event count`
4. **Add Filters:**
   - `Event parameter: tool_name` = `character-counter`
5. **Visualization:** Table

**What you'll see:**
- `copy_text` - How many users copied text
- `copy_stats` - How many users copied statistics
- `clear_text` - How many users cleared text
- `download_pdf` - How many users downloaded PDF
- `download_txt` - How many users downloaded TXT
- `text_analysis` - How many times text was analyzed

### See Button Clicks

1. **Go to Reports** → **Engagement** → **Events**
2. **Find Event: `click`**
3. **Filter by Event Parameter: `location` = `character-counter`**
4. **View Event Parameter: `element_name`** to see:
   - `copy-text` - Copy button clicks
   - `copy-stats` - Stats button clicks
   - `download-pdf` - PDF download button clicks
   - `download-txt` - TXT download button clicks
   - `clear-text` - Clear button clicks

## 📈 Creating Custom Reports

### Report 1: "Words & Character Counter - User Engagement"

**Steps:**
1. Go to **Explore** → **Free Form**
2. **Dimensions:**
   - `Event parameter: tool_name`
   - `Event name`
3. **Metrics:**
   - `Total users`
   - `Event count`
   - `Average session duration`
4. **Filters:**
   - `Event parameter: tool_name` = `character-counter`
5. **Visualization:** Table

**Shows:**
- Total users who used the tool
- Breakdown by event type
- Engagement metrics

### Report 2: "Words & Character Counter - Action Analysis"

**Steps:**
1. Go to **Explore** → **Free Form**
2. **Dimensions:**
   - `Event parameter: action_type`
3. **Metrics:**
   - `Total users`
   - `Event count`
4. **Filters:**
   - `Event parameter: tool_name` = `character-counter`
   - `Event name` = `tool_action`
5. **Visualization:** Bar chart

**Shows:**
- Which actions users take most
- User count per action type
- Action frequency

### Report 3: "Words & Character Counter - Completion Funnel"

**Steps:**
1. Go to **Explore** → **Funnel Exploration**
2. **Steps:**
   - Step 1: `tool_usage` (tool viewed)
   - Step 2: `text_analysis` (text analyzed)
   - Step 3: `tool_completion` (download completed)
3. **Filters:**
   - `Event parameter: tool_name` = `character-counter`

**Shows:**
- How many users viewed tool
- How many analyzed text
- How many completed download
- Drop-off rates

## 🎯 Key Metrics to Monitor

### User Metrics
- **Total users** - Unique users who used the tool
- **New users** - First-time users
- **Returning users** - Users who came back

### Engagement Metrics
- **Average session duration** - Time spent in tool
- **Text analyses per user** - How many times users analyze text
- **Actions per user** - Average interactions per user

### Conversion Metrics
- **View to analysis rate** - % of users who analyze text
- **Analysis to download rate** - % who download results
- **Completion rate** - % who complete full workflow

### Interaction Metrics
- **Most used actions** - Which buttons are clicked most
- **Copy vs Download** - User preferences
- **PDF vs TXT** - Download format preferences

## 📱 Real-time Monitoring

### See Live Usage

1. **Go to Reports** → **Real-time**
2. **View Events**
3. **Filter by Event Parameter: `tool_name` = `character-counter`**

**Shows:**
- Users currently using the tool
- Events happening right now
- Recent interactions

## 🔍 Advanced Queries

### Find Users Who Analyzed Text 10+ Times

```
Event name = "text_analysis"
Event parameter: tool_name = "character-counter"
Event parameter: analysis_count >= 10
```

### Find Users Who Downloaded PDF

```
Event name = "tool_completion"
Event parameter: tool_name = "character-counter"
Event parameter: operation_type = "download_pdf"
```

### Find Power Users (Multiple Actions)

```
Event name = "tool_action"
Event parameter: tool_name = "character-counter"
Group by: User ID
Count events per user >= 5
```

## 📊 Sample Dashboard Queries

### Query 1: Total Users
```
Event parameter: tool_name = "character-counter"
Metric: Total users
```

### Query 2: Interactions Breakdown
```
Event name = "tool_action"
Event parameter: tool_name = "character-counter"
Group by: Event parameter: action_type
Metric: Total users, Event count
```

### Query 3: Completion Rate
```
Step 1: tool_usage (tool_name = "character-counter")
Step 2: tool_completion (tool_name = "character-counter")
Calculate: (Step 2 / Step 1) * 100
```

## 💡 Pro Tips

1. **Use Date Ranges**
   - Compare this week vs last week
   - Track growth over time

2. **Segment Users**
   - New vs returning users
   - Mobile vs desktop
   - Different time periods

3. **Set Up Alerts**
   - Alert when user count drops
   - Alert when completion rate changes

4. **Export Data**
   - Export to CSV for deeper analysis
   - Create scheduled reports

## 🎯 Quick Reference

**Event Names for Words & Character Counter:**
- `tool_usage` - Tool viewed/used
- `tool_view` - Page view
- `tool_action` - User actions (copy, clear, etc.)
- `text_analysis` - Text analyzed
- `tool_completion` - Download completed
- `tool_session_summary` - Session summary

**Key Parameters:**
- `tool_name` = `character-counter`
- `tool_category` = `text-utilities`
- `action_type` = `copy_text`, `copy_stats`, `clear_text`, `download_pdf`, `download_txt`
- `text_length` = Length of analyzed text (privacy-safe)
- `word_count` = Word count (metadata)
- `char_count` = Character count (metadata)

---

## ✅ Summary

**Yes, you can now track:**
- ✅ **Total users** who used Words & Character Counter
- ✅ **All interactions** (copy, clear, download)
- ✅ **All events** (analysis, completion, etc.)
- ✅ **User engagement** metrics
- ✅ **Completion rates**
- ✅ **Action preferences**

All data is available in your Google Analytics dashboard with the tracking we've implemented!

