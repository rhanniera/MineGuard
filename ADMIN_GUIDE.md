# MineGuard Admin Panel - Database Management System

## Overview
The MineGuard Admin Panel provides comprehensive database management and reporting capabilities for administrators. All hazard reports submitted by users are stored securely and can only be accessed and managed by administrators.

## Cross-Device Sync Setup (Required for Different Locations)
By default, browsers store data in local storage, which is isolated per device. To make reports appear in the admin dashboard across different users and locations, configure a shared Firebase Realtime Database URL.

1. Create a Firebase Realtime Database project.
2. Set database rules to allow your intended reads/writes.
3. In browser console (or app bootstrap), set:
        localStorage.setItem('mineguardCloudDbUrl', 'https://YOUR_PROJECT_ID-default-rtdb.firebaseio.com')
4. Reload the app on both reporter and admin devices.

Once configured, the app automatically syncs users and reports every few seconds and when tabs regain focus.

## Admin Credentials
- **Email:** admin@admin.com
- **Password:** Totheremix123!

> ⚠️ **Important:** Keep these credentials secure. Never share with unauthorized personnel.

## Getting Started

### 1. Logging In
1. Open the MineGuard application
2. Click on the "Home" button or login directly
3. On the authentication section, click "Login here" if on signup form
4. Enter credentials:
   - Email: `admin@admin.com`
   - Password: `Totheremix123!`
5. Click "Login"
6. You will be automatically redirected to the Admin Dashboard

### 2. Admin Dashboard Overview
Once logged in as admin, you'll see:
- An "Admin Dashboard" link in the navigation bar (red highlight)
- Access to all system hazard reports
- Real-time statistics and analytics

## Dashboard Features

### 📊 Statistics Dashboard
The admin dashboard displays key metrics:
- **Total Reports:** Total hazard reports in the system
- **Critical Reports:** Count of critical severity hazards
- **High Severity Reports:** Count of high severity hazards
- **Pending Reports:** Reports awaiting review
- **In Review Reports:** Reports currently being investigated
- **Resolved Reports:** Completed hazard reports
- **Total Users:** Number of registered hazard reporters
- **Avg. Resolution Time:** Average days to resolve hazards

### 🔍 Search & Filter
Find specific reports using:

**Search by:**
- Hazard title
- Description content
- Location
- Submitter name
- Company name

**Filter by:**
- Status: Pending, In Review, Resolved
- Severity: Low, Medium, High, Critical

Example: Search for "roof" AND filter by "Critical" to find critical roof-related hazards.

### 📝 Report Management

#### View Report Details
1. Click "View Details" button on any report card
2. See complete information including:
   - Full description and location
   - Severity and current status
   - Submitter information
   - Submission date and time
   - All comments and updates
3. Add comments to reports (visible to all admins)
4. Close modal to return to dashboard

#### Update Report Status
1. Locate the report card
2. Click the "Change Status" dropdown menu
3. Select new status:
   - **Pending:** Initial state when submitted
   - **In Review:** Under investigation by team
   - **Resolved:** Issue has been addressed
4. Status updates immediately and is recorded in database

#### Delete Reports
1. Click "Delete" button on report card
2. Confirm deletion (this action cannot be undone)
3. Report is permanently removed from database
4. Dashboard updates automatically

### 💾 Data Export

#### Export as JSON
- Click "Export as JSON" button
- Downloads all reports as structured JSON file
- Filename format: `hazard-reports-YYYY-MM-DD.json`
- Use for: Data backup, system integration, advanced analysis

#### Export as CSV
- Click "Export as CSV" button
- Downloads all reports in spreadsheet format
- Filename format: `hazard-reports-YYYY-MM-DD.csv`
- Use for: Excel analysis, reporting, printing

**CSV Columns Included:**
- Report ID
- Title
- Description (first 100 chars)
- Location
- Severity Level
- Current Status
- Submitted By
- Company
- Date Observed
- Time Observed
- Submission Timestamp

## Database Storage

### Data Persistence
All data is stored securely in browser localStorage:
- User accounts (encrypted passwords)
- All hazard reports
- Comments and updates
- Admin access logs

### Data Backup
Regular backups are recommended:
1. Export all reports as JSON weekly
2. Store exported files in secure location
3. Keep version history with dates

### Data Security
- Only admin can access database
- Passwords are encoded for security
- Session-based authentication
- Logout automatically clears session

## Report Processing Workflow

```
User Submits Report
        ↓
Report Status: PENDING
        ↓
Admin Reviews (Change to IN REVIEW)
        ↓
Investigation & Assessment
        ↓
Admin Updates Status (Change to RESOLVED)
        ↓
Report Archived
```

## Best Practices

### ✅ Do's
- ✓ Review critical/high severity reports immediately
- ✓ Add comments with investigation findings
- ✓ Update status regularly to track progress
- ✓ Export data weekly for backup
- ✓ Verify report details before marking resolved
- ✓ Maintain confidentiality of sensitive reports

### ❌ Don'ts
- ✗ Don't share admin credentials
- ✗ Don't delete reports without proper review
- ✗ Don't ignore critical severity hazards
- ✗ Don't modify user data directly
- ✗ Don't leave system unattended while logged in

## Common Tasks

### Task: Find All Critical Hazards
1. Click "Admin Dashboard"
2. In Filter Controls, select Severity → "Critical"
3. All critical reports displayed
4. Click to review and update status

### Task: Export Monthly Report
1. Go to Admin Dashboard
2. Click "Export as CSV"
3. Open file in Excel/Sheets
4. Create pivot table for analysis
5. Generate charts and summary

### Task: Resolve Pending Reports
1. Filter by Status → "Pending"
2. Click each report to review
3. Add investigation comments
4. Update status to "In Review" or "Resolved"
5. Verify resolution

### Task: Search Specific Location
1. In Search box, type location (e.g., "Level 3")
2. Results filtered in real-time
3. Review all reports from that location
4. Identify patterns or recurring issues

## Troubleshooting

### Issue: Admin Link Not Showing
- **Solution:** Log out and log back in with correct credentials
- **Check:** Ensure email is `admin@admin.com` exactly

### Issue: Cannot Delete Report
- **Solution:** Verify you're logged in as admin
- **Check:** Admin Dashboard link should be visible in navbar

### Issue: Export File Not Downloading
- **Solution:** Check browser download settings
- **Try:** Use different export format (JSON vs CSV)
- **Check:** Browser popup blocker isn't interfering

### Issue: Data Not Appearing
- **Solution:** Refresh the page (Ctrl+F5 or Cmd+Shift+R)
- **Check:** Reports exist by checking Total Reports stat
- **Try:** Clear browser cache if persistent

## Support Information

For technical issues or questions:
1. Check this guide first
2. Verify admin credentials
3. Try clearing browser cache
4. Backup data before troubleshooting

## System Requirements

- Modern web browser (Chrome, Firefox, Safari, Edge)
- JavaScript enabled
- LocalStorage enabled
- 5MB free browser storage minimum

## Security Reminders

🔒 **Important Security Notes:**
- Never share admin credentials with regular users
- Change password regularly if possible
- Logout after each session
- Don't access system from public computers
- Keep backup exports in secure location
- Review unauthorized access attempts

---

**Last Updated:** December 2024
**Version:** 1.0
**System:** MineGuard Hazard Reporting System
