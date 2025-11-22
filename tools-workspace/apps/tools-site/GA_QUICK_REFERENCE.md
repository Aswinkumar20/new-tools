# Google Analytics Quick Reference Card

## 🚀 Quick Access: Component Analytics

### Fastest Way to View Component Analytics

1. **Google Analytics** → **Reports** → **Engagement** → **Events**
2. Click **`tool_usage`** event
3. View **Event parameter: `tool_name`** column
4. **Done!** See all components with user counts

---

## 📊 Common Views

### View All Components
```
Path: Reports → Engagement → Events → tool_usage
See: All components with metrics
```

### View Specific Component
```
Path: Reports → Engagement → Events → tool_usage
Filter: tool_name = [component-name]
See: Analytics for that component only
```

### Compare Components
```
Path: Explore → Free Form
Dimensions: tool_name
Metrics: Total users, Event count
Filter: Event name = tool_usage
```

---

## 🔍 Component Name Lookup

### Text Utilities
- `character-counter` - Word & Character Counter
- `text-case-convertor` - Text Case Converter
- `text-to-ascii` - Text to ASCII
- `remove-duplicate-lines` - Remove Duplicate Lines
- `text-reversal-and-palindrome-checker` - Text Reversal
- `base64-encode-and-decode` - Base64 Encoder/Decoder
- `slug-generator` - Slug Generator
- `text-difference` - Text Difference
- `code-merge` - Code Merge

### PDF Tools
- `merge-pdfs` - Merge PDFs
- `split-pdfs` - Split PDFs
- `delete-pages` - Delete Pages
- `rotate-pages` - Rotate Pages
- `compress-pdf` - Compress PDF
- `pdf-viewer` - PDF Viewer
- ... (20+ more)

### File Viewers
- `image-viewer` - Image Viewer
- `pdf-viewer` - PDF Viewer
- `word-viewer` - Word Viewer
- `excel-viewer` - Excel Viewer
- ... (13 total)

### Categories
- `text-utilities` - Text & Utilities
- `pdf-tools` - PDF Tools
- `file-viewers` - File Viewers
- `data-converters` - Data Converters
- `math-date-utils` - Math & Date Utils
- `image-color-tools` - Image & Color Tools
- `code-file-tools` - Code & File Tools
- `dev-design-tools` - Dev & Design Tools
- `testing-tools` - Testing Tools
- `security-tools` - Security Tools
- `media-tools` - Media Tools
- `browser-utils` - Browser Utils
- `fun-tools` - Fun Tools

---

## 🎯 Key Metrics Explained

- **Total users** - Unique users who used the component
- **Event count** - Total number of times component was used
- **Total sessions** - Number of sessions that used component
- **Average session duration** - Average time spent

---

## 📈 Event Types

- `tool_usage` - Component viewed/used
- `tool_view` - Component page viewed
- `tool_action` - User action (copy, download, etc.)
- `tool_completion` - Action completed successfully
- `tool_error` - Error occurred

---

## 🔧 Quick Filters

### By Component
```
Event parameter: tool_name = [component-name]
```

### By Category
```
Event parameter: tool_category = [category-name]
```

### By Action
```
Event parameter: action_type = [action-name]
```

---

## 💡 Pro Tips

1. **Save reports** for quick access
2. **Schedule emails** for regular updates
3. **Export data** for deeper analysis
4. **Set alerts** for important changes
5. **Compare periods** to see trends

---

## 📱 Mobile Access

Same steps work on:
- Mobile browser
- GA mobile app
- Tablet

---

**For detailed guide:** See `GA_COMPONENT_ANALYTICS_GUIDE.md`

