# Google Analytics Dashboard Guide - Component-Wise Analytics

## 📊 How to View Analytics for Each Component/Tool

This guide shows you step-by-step how to view analytics for individual components in your Google Analytics dashboard.

---

## 🎯 Quick Start: View All Components

### Method 1: Events Report (Easiest)

1. **Go to Google Analytics Dashboard**
   - Open your GA4 property
   - Click **Reports** in the left sidebar

2. **Navigate to Events**
   - Click **Engagement** → **Events**
   - Or go directly: **Reports** → **Engagement** → **Events**

3. **Find Tool Usage Event**
   - Look for the event: **`tool_usage`**
   - Click on the event name

4. **View Component Analytics**
   - You'll see a table with event parameters
   - Look for **Event parameter: `tool_name`**
   - Each tool name shows:
     - **Event count** - How many times it was used
     - **Total users** - How many unique users
     - **Total sessions** - Number of sessions

**Result:** You'll see a list of all your components with usage statistics!

---

## 🔍 Method 2: Filter by Specific Component

### Step-by-Step: Find Analytics for "Character Counter"

1. **Go to Reports** → **Engagement** → **Events**

2. **Click on `tool_usage` event**

3. **Click "Add filter"** (top right)

4. **Add Filter:**
   - **Dimension:** `Event parameter: tool_name`
   - **Match type:** `Exactly matches`
   - **Value:** `character-counter`
   - Click **Apply**

5. **View Results:**
   - You'll see analytics only for Character Counter
   - Total users, event count, sessions, etc.

---

## 📈 Method 3: Create Custom Report (Recommended)

### Create "Component Analytics Dashboard"

1. **Go to Explore**
   - Click **Explore** in the left sidebar
   - Click **Blank** (or **Free Form**)

2. **Add Dimensions:**
   - Click **Dimensions** → **Add dimension**
   - Search and add: `Event parameter: tool_name`
   - Search and add: `Event parameter: tool_category`
   - Search and add: `Event name`

3. **Add Metrics:**
   - Click **Metrics** → **Add metric**
   - Add: `Total users`
   - Add: `Event count`
   - Add: `Total sessions`
   - Add: `Average session duration`

4. **Add Filters:**
   - Click **Filters** → **Add filter**
   - **Dimension:** `Event name`
   - **Match type:** `Exactly matches`
   - **Value:** `tool_usage`
   - Click **Apply**

5. **Visualization:**
   - Choose **Table** visualization
   - Sort by **Total users** (descending)

**Result:** A table showing all components with:
- Component name
- Category
- Total users
- Event count
- Sessions
- Average session duration

---

## 🎯 Method 4: Component Comparison Report

### Compare Multiple Components

1. **Go to Explore** → **Free Form**

2. **Add Dimensions:**
   - `Event parameter: tool_name`

3. **Add Metrics:**
   - `Total users`
   - `Event count`

4. **Add Filters:**
   - `Event name` = `tool_usage`

5. **Visualization:** Bar chart

**Result:** Visual comparison of all components by user count

---

## 📊 Method 5: Component Details Report

### Deep Dive into One Component

1. **Go to Explore** → **Free Form**

2. **Add Dimensions:**
   - `Event parameter: tool_name`
   - `Event name`
   - `Event parameter: action_type` (if available)

3. **Add Metrics:**
   - `Total users`
   - `Event count`

4. **Add Filters:**
   - `Event parameter: tool_name` = `character-counter` (or any component)

5. **Visualization:** Table

**Result:** All events for that component:
- Tool usage
- Actions (copy, download, etc.)
- Completions
- Errors

---

## 🔍 Finding Specific Components

### Component Name Reference

Your components are tracked with these names:

**Text Utilities:**
- `character-counter`
- `text-case-convertor`
- `text-to-ascii`
- `remove-duplicate-lines`
- `text-reversal-and-palindrome-checker`
- `base64-encode-and-decode`
- `slug-generator`
- `text-difference`
- `code-merge`

**PDF Tools:**
- `merge-pdfs`
- `split-pdfs`
- `delete-pages`
- `rotate-pages`
- `compress-pdf`
- ... (and more)

**File Viewers:**
- `image-viewer`
- `pdf-viewer`
- `word-viewer`
- ... (and more)

**And many more categories!**

---

## 📈 Pre-Built Report Templates

### Report 1: "Top 20 Most Used Components"

**Steps:**
1. **Explore** → **Free Form**
2. **Dimensions:**
   - `Event parameter: tool_name`
3. **Metrics:**
   - `Total users`
   - `Event count`
4. **Filters:**
   - `Event name` = `tool_usage`
5. **Sort:** Total users (descending)
6. **Limit:** Top 20 rows

**Save this report** for quick access!

### Report 2: "Component Usage by Category"

**Steps:**
1. **Explore** → **Free Form**
2. **Dimensions:**
   - `Event parameter: tool_category`
   - `Event parameter: tool_name`
3. **Metrics:**
   - `Total users`
   - `Event count`
4. **Filters:**
   - `Event name` = `tool_usage`
5. **Visualization:** Tree map

**Shows:** Which categories are most popular, and components within each category

### Report 3: "Component Engagement Funnel"

**Steps:**
1. **Explore** → **Funnel Exploration**
2. **Steps:**
   - Step 1: `tool_usage` (component viewed)
   - Step 2: `tool_action` (user interacted)
   - Step 3: `tool_completion` (user completed action)
3. **Filters:**
   - `Event parameter: tool_name` = `[your-component]`

**Shows:** How many users view → interact → complete for each component

---

## 🎯 Real Example: Character Counter Analytics

### Step-by-Step Walkthrough

1. **Open Google Analytics**
   - Go to your GA4 property

2. **Navigate to Events**
   - **Reports** → **Engagement** → **Events**

3. **Find `tool_usage` Event**
   - Scroll or search for `tool_usage`
   - Click on it

4. **View Event Details**
   - You'll see event parameters
   - Look for `tool_name` parameter
   - Find `character-counter` in the list

5. **See Metrics:**
   - **Total users:** X users
   - **Event count:** Y times
   - **Total sessions:** Z sessions

6. **Click on `character-counter`**
   - See detailed breakdown
   - View by date, device, etc.

---

## 📊 Advanced: Component Performance Analysis

### View Component Actions

1. **Go to Explore** → **Free Form**

2. **Add Dimensions:**
   - `Event parameter: tool_name`
   - `Event parameter: action_type`

3. **Add Metrics:**
   - `Total users`
   - `Event count`

4. **Add Filters:**
   - `Event name` = `tool_action`
   - `Event parameter: tool_name` = `character-counter`

5. **Visualization:** Table

**Shows:** All actions users take in that component:
- `copy_text` - X users, Y times
- `copy_stats` - X users, Y times
- `clear_text` - X users, Y times
- `download_pdf` - X users, Y times
- etc.

---

## 🔍 Quick Filters & Searches

### Filter by Category

1. In any report, add filter:
   - **Dimension:** `Event parameter: tool_category`
   - **Value:** `text-utilities` (or any category)

### Search for Component

1. In Events report, use search box
2. Type component name (e.g., "character-counter")
3. Results filtered automatically

### Date Range

1. Use date picker (top right)
2. Select:
   - Last 7 days
   - Last 30 days
   - Custom range
   - Compare periods

---

## 📱 Mobile View

### View on Mobile App

1. Same steps as desktop
2. Use mobile browser or GA mobile app
3. All reports accessible on mobile

---

## 💡 Pro Tips

### Tip 1: Save Reports
- After creating a report, click **Save**
- Name it (e.g., "Component Analytics")
- Access quickly from **Saved Reports**

### Tip 2: Schedule Reports
- Click **Share** → **Schedule email**
- Get weekly/monthly reports automatically

### Tip 3: Export Data
- Click **Export** (top right)
- Choose format: PDF, CSV, Google Sheets
- Download for further analysis

### Tip 4: Compare Components
- Use **Compare** feature
- Select two components
- See side-by-side comparison

### Tip 5: Set Up Alerts
- Go to **Admin** → **Custom Alerts**
- Alert when component usage drops
- Alert when new component gains popularity

---

## 🎯 Common Queries

### Query 1: "Which component has the most users?"
```
Event: tool_usage
Sort by: Total users (descending)
Limit: 1
```

### Query 2: "How many users used Character Counter?"
```
Event: tool_usage
Filter: tool_name = character-counter
Metric: Total users
```

### Query 3: "What actions do users take in Character Counter?"
```
Event: tool_action
Filter: tool_name = character-counter
Group by: action_type
```

### Query 4: "Component completion rate?"
```
Step 1: tool_usage (component viewed)
Step 2: tool_completion (action completed)
Calculate: (Step 2 / Step 1) * 100
```

---

## 📊 Dashboard Views

### View 1: Component List
- Shows all components
- Sorted by popularity
- Quick overview

### View 2: Component Details
- Deep dive into one component
- All events and actions
- User journey

### View 3: Category Comparison
- Compare categories
- See which category is most popular
- Component breakdown per category

### View 4: Time Series
- Component usage over time
- Trends and patterns
- Growth analysis

---

## 🔐 Privacy Note

All tracking is privacy-safe:
- ✅ Component names are tracked
- ✅ User actions are tracked
- ✅ Metadata is tracked
- ❌ User content is NEVER tracked
- ❌ Personal information is NEVER tracked

---

## 📝 Quick Reference

**Event Names:**
- `tool_usage` - Component viewed/used
- `tool_view` - Component page viewed
- `tool_action` - User action in component
- `tool_completion` - Action completed
- `tool_error` - Error occurred

**Key Parameters:**
- `tool_name` - Component name
- `tool_category` - Component category
- `action_type` - Type of action
- `operation_type` - Type of operation

**Key Metrics:**
- `Total users` - Unique users
- `Event count` - Total events
- `Total sessions` - Number of sessions
- `Average session duration` - Time spent

---

## ✅ Summary

**To view component analytics:**

1. **Quick View:** Reports → Engagement → Events → `tool_usage`
2. **Specific Component:** Add filter for `tool_name`
3. **Custom Report:** Explore → Free Form → Add dimensions/metrics
4. **Compare Components:** Use comparison feature
5. **Save Reports:** For quick future access

**All your ~100 components are automatically tracked!** 🎉

---

## 🆘 Troubleshooting

### Can't see events?
- Wait 24-48 hours for data to appear
- Check date range (default is last 7 days)
- Verify tracking is working (check browser console)

### Can't find component name?
- Check the route mapping in `auto-ga-tracker.service.ts`
- Component name matches route path (e.g., `character-counter`)

### Data looks wrong?
- Check filters are correct
- Verify date range
- Ensure tracking is active

---

**Need more help?** Check the other guides:
- `GA_TRACKING_GUIDE.md` - General tracking guide
- `GA_DASHBOARD_GUIDE.md` - Dashboard overview
- `AUTO_TRACKING_GUIDE.md` - Automatic tracking info

