# MineGuard - User Access & Testing Guide

## ✅ Login Issue Fixed!

The login system is now fully operational. All users can log in with their credentials using Base64-encoded passwords (which the frontend handles automatically).

---

## 🔐 Admin Account

**Email:** `admin@mineguard.local`  
**Password:** `admin123`  
**Role:** System Administrator (can see all reports from all users)

---

## 👥 Test User Accounts

All test user accounts have been imported into the SQLite database. You can log in with any of these credentials:

### 1. Sarah Johnson - Safety Officer
- **Email:** `sarah.johnson@goldfield.com`
- **Password:** `Password123`
- **Company:** Goldfield Mining
- **Reports Submitted:** 1 (High severity)
  - "Unstable Support Beam - Level 2" (In Progress)

### 2. Marcus Chen - Site Manager
- **Email:** `marcus.chen@copperridge.com`
- **Password:** `SecurePass456`
- **Company:** Copper Ridge Mines
- **Reports Submitted:** 1 (Critical severity)
  - "Gas Leak Detection Equipment Malfunction" (Pending)

### 3. Elena Rodriguez - Hazard Analyst
- **Email:** `elena.rodriguez@sierra-lithium.com`
- **Password:** `MineHazard789`
- **Company:** Sierra Lithium
- **Reports Submitted:** 1 (Medium severity)
  - "Inadequate PPE Storage" (Resolved)

### 4. James Williams - Operations Director
- **Email:** `james.williams@diamond-peak.com`
- **Password:** `DiamondOps2026`
- **Company:** Diamond Peak Operations
- **Reports Submitted:** 1 (High severity)
  - "Improper Safety Procedures" (In Progress)

### 5. Lisa Thompson - Environmental Specialist
- **Email:** `lisa.thompson@orevalley.com`
- **Password:** `SafetyFirst2026`
- **Company:** Ore Valley Mining
- **Reports Submitted:** 1 (Critical severity)
  - "Environmental Water Contamination" (Pending)

---

## 📊 Sample Hazard Reports

### Critical Priority Reports (2)
1. **Gas Leak Detection Equipment Malfunction**
   - Submitted by: Marcus Chen (Copper Ridge Mines)
   - Status: Pending
   - Issue: Gas detection equipment at Station C not responding correctly

2. **Environmental Water Contamination**
   - Submitted by: Lisa Thompson (Ore Valley Mining)
   - Status: Pending
   - Issue: Heavy metal contamination near tailings dam

### High Priority Reports (2)
1. **Unstable Support Beam - Level 2**
   - Submitted by: Sarah Johnson (Goldfield Mining)
   - Status: In Progress
   - Issue: Visible crack in support beam near main shaft

2. **Improper Safety Procedures**
   - Submitted by: James Williams (Diamond Peak Operations)
   - Status: In Progress
   - Issue: Workers bypassing safety checkpoints

### Medium Priority Reports (1)
1. **Inadequate PPE Storage**
   - Submitted by: Elena Rodriguez (Sierra Lithium)
   - Status: Resolved
   - Issue: Poor ventilation and humidity control in equipment storage

---

## 🔧 System Architecture

### Backend Server
- **Status:** ✅ Running on `http://localhost:3001`
- **Database:** SQLite (`./backend/data/mineguard.db`)
- **API Endpoints:** 20+ endpoints available

### Frontend
- **URL:** `c:\HCI-Finals\RhannierA-1\index.html`
- **API Integration:** SQL-based (no more JSONBin.io)
- **Features:** User authentication, report submission, admin dashboard

### Database
- **Location:** `c:\HCI-Finals\RhannierA-1\backend\data\mineguard.db`
- **Users:** 6 (1 admin + 5 test users)
- **Reports:** 5 sample hazard reports
- **Sync:** Real-time polling (5-second intervals)

---

## 🧪 How to Test the System

### Test User Login
1. Open `index.html` in a browser
2. Click **Login** button
3. Enter any test user email and password from the list above
4. Click **Sign In**
5. You should see: "Login successful!" message
6. Navigate to "My Hazard Reports" to see user's reports

### Test Admin Login
1. Click **Login** button
2. Enter: `admin@mineguard.local`
3. Password: `admin123`
4. Click **Sign In**
5. You should see: "Welcome Admin!" message
6. Click **Admin Panel** to view all reports from all users
7. Use filters to search by status (Pending, In Progress, Resolved) or severity (Low, Medium, High, Critical)

### Test Admin Features
- **View All Reports:** Admin can see all 5 sample reports from all users
- **Export Data:** Use "Export as JSON" or "Export as CSV" buttons
- **Filter Reports:** Filter by status, severity, or search by title/location
- **Refresh Data:** Click "Refresh Data" button to sync latest from database

---

## 📋 Database Access

If you need to directly access the database:

```bash
# Navigate to backend
cd c:\HCI-Finals\RhannierA-1\backend

# Open database shell
sqlite3 data/mineguard.db

# Useful queries:
# View all users
SELECT id, email, fullName, isAdmin FROM users;

# View all reports
SELECT hazardTitle, submittedBy, severity, status FROM reports;

# View specific user's reports
SELECT * FROM reports WHERE submittedBy = 'Sarah Johnson';

# Exit
.quit
```

---

## 🚀 What's Been Fixed

✅ **Login System:**
- Backend now properly validates email/password combinations
- Frontend correctly encodes passwords as Base64
- Case-insensitive email matching added for robustness

✅ **CORS Configuration:**
- Updated to accept connections from localhost
- Properly configured headers for API requests

✅ **Data Migration:**
- JSONBin.io migration script created (attempted, returned 403 - API may be expired)
- Sample data seeding script created with 5 test users and 5 reports
- All data stored in SQLite database (no longer dependent on cloud storage)

✅ **User Accounts:**
- 1 admin account with elevated privileges
- 5 test user accounts from different mining companies
- Each user has hazard reports with varying severity levels

---

## 📝 SQL API Integration

The frontend uses the SQL API module (`sql-api-integration.js`) which:
- Replaces all JSONBin.io API calls
- Makes HTTP requests to `http://localhost:3001/api`
- Includes retry logic (3 attempts)
- Has localStorage fallback for offline support
- Uses Base64 password encoding for security

---

## ✨ Quick Start Checklist

- [x] Backend server running on port 3001
- [x] Database initialized with schema and test data
- [x] All user accounts created and verified
- [x] Sample hazard reports added (5 total)
- [x] Login authentication working
- [x] Admin panel functional
- [x] CORS properly configured
- [x] Frontend connected to SQL API

**You can now log in and test the application with any of the provided credentials!**

---

## 🔗 Useful Links

- **Admin Panel:** After login as admin, click "Admin Panel" in navigation
- **My Reports:** View personal hazard reports (normal users) or all reports (admin)
- **Report Hazard:** Submit new hazard reports
- **Profile:** Update account information
- **FAQ & Guidelines:** Learn more about hazard reporting

---

## 📞 Support

If you encounter any issues:

1. **Can't log in?** Check the email and password are exact matches from above
2. **Backend not running?** Check `npm start` in `c:\HCI-Finals\RhannierA-1\backend`
3. **Database issues?** Query with `sqlite3 data/mineguard.db` to verify data exists
4. **CORS errors?** Backend CORS is configured - check browser console for other errors

