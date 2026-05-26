# Frontend Migration Guide: JSONBin.io → SQL Database

This guide explains how to update your MineGuard frontend to use the new SQL database backend instead of JSONBin.io.

## Quick Start

1. **Include the SQL API Integration Module** in your `index.html`:
```html
<!-- NEW: Add this before script.js -->
<script src="sql-api-integration.js"></script>
<script src="script.js"></script>
```

2. **Configure the API Endpoint** (optional, defaults to `http://localhost:3001/api`):
```javascript
// In your app initialization code:
setApiUrl('http://localhost:3001/api');
```

3. **Update key functions** in `script.js` (see sections below)

## Architecture Changes

### Old Architecture (JSONBin.io)
```
Frontend → localStorage → JSONBin.io API
                ↓
         (Periodic polling)
         (Real-time issues)
```

### New Architecture (SQL Database)
```
Frontend → localStorage → SQL Backend API (Express + SQLite)
                ↓
         (Near real-time polling: 3-5 seconds)
         (Reliable data persistence)
         (Better performance)
```

## Key Functions to Update

### 1. Replace `handleReportSubmit()` 

**OLD CODE:**
```javascript
function handleReportSubmit(e) {
    // ... validation code ...
    
    const reports = getStorageData('reports');
    reports.push(newReport);
    saveStorageData('reports', reports);
    
    if (isCloudSyncEnabled()) {
        syncCloudData();
    }
}
```

**NEW CODE:**
```javascript
async function handleReportSubmit(e) {
    e.preventDefault();
    
    if (currentEditingReportId !== null) {
        updateReport(currentEditingReportId);
        return;
    }
    
    const user = getCurrentUser();
    if (!user) {
        showToast('Please log in first', 'error');
        return;
    }
    
    const hazardTitle = document.getElementById('hazardTitle').value.trim();
    const description = document.getElementById('hazardDescription').value.trim();
    const location = document.getElementById('location').value.trim();
    const severity = document.getElementById('severity').value;
    const dateObserved = document.getElementById('dateObserved').value;
    const timeObserved = document.getElementById('timeObserved').value;
    const anonymous = document.getElementById('anonymous').checked;
    
    if (!hazardTitle || !description || !location || !severity || !dateObserved || !timeObserved) {
        showToast('Please fill all required fields', 'error');
        return;
    }
    
    const newReport = {
        userId: user.id,
        submittedBy: anonymous ? 'Anonymous' : user.fullName,
        company: user.company,
        hazardTitle,
        description,
        location,
        severity,
        dateObserved,
        timeObserved
    };
    
    try {
        // Save to SQL API instead of localStorage
        const savedReport = await sqlApiCreateReport(newReport);
        
        // Also save locally for offline access
        const reports = getStorageData('reports');
        reports.push(savedReport);
        localStorage.setItem('reports', JSON.stringify(reports));
        
        addNotification('Hazard Report Submitted', `Your hazard report "${hazardTitle}" has been submitted successfully`, 'success');
        addAdminNotification('New Hazard Report', `New ${severity} severity hazard report from ${user.fullName}`, 'warning');
        
        showToast('Hazard report submitted successfully!', 'success');
        document.getElementById('hazardForm').reset();
        
        setTimeout(() => {
            showSection('dashboard');
            loadUserReports();
        }, 1000);
    } catch (error) {
        showToast('Failed to submit report: ' + error.message, 'error');
    }
}
```

### 2. Replace `handleSignup()` 

**NEW CODE:**
```javascript
async function handleSignup(e) {
    e.preventDefault();
    
    const fullName = document.getElementById('signupName').value.trim();
    const company = document.getElementById('signupCompany').value.trim();
    const jobRole = document.getElementById('signupJobRole').value.trim();
    const email = document.getElementById('signupEmail').value.trim();
    const password = document.getElementById('signupPassword').value;
    const confirmPassword = document.getElementById('signupConfirmPassword').value;
    
    if (!fullName || !company || !jobRole || !email || !password || !confirmPassword) {
        showToast('Please fill all required fields', 'error');
        return;
    }
    
    if (password !== confirmPassword) {
        showToast('Passwords do not match', 'error');
        return;
    }
    
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showToast('Please enter a valid email', 'error');
        return;
    }
    
    try {
        // Create user on SQL API
        const newUser = await sqlApiCreateUser({
            fullName,
            company,
            jobRole,
            email,
            password: btoa(password) // Base64 encode like before
        });
        
        // Also save locally
        const users = getStorageData('users');
        users.push(newUser);
        localStorage.setItem('users', JSON.stringify(users));
        
        setCurrentUser(newUser);
        
        addNotification('New Account Created', `Welcome ${fullName}!`, 'success');
        addAdminNotification('New User Registration', `New user ${fullName} (${email}) has registered.`, 'info');
        
        showToast('Account created successfully!', 'success');
        document.getElementById('signupForm').reset();
        
        setTimeout(() => {
            initializeApp();
            showSection('home');
        }, 1000);
    } catch (error) {
        if (error.message.includes('already exists')) {
            showToast('Email already registered', 'error');
        } else {
            showToast('Failed to create account: ' + error.message, 'error');
        }
    }
}
```

### 3. Replace `handleLogin()` 

**NEW CODE:**
```javascript
async function handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    
    if (!email || !password) {
        showToast('Please enter email and password', 'error');
        return;
    }
    
    try {
        // Authenticate with SQL API
        const user = await sqlApiLoginUser(email, btoa(password));
        
        setCurrentUser(user);
        
        if (user.isAdmin) {
            showToast('Welcome Admin!', 'success');
        } else {
            showToast('Login successful!', 'success');
        }
        
        document.getElementById('loginForm').reset();
        
        setTimeout(() => {
            initializeApp();
            if (user.isAdmin) {
                showSection('admin');
            } else {
                showSection('home');
            }
        }, 1000);
    } catch (error) {
        showToast('Invalid email or password', 'error');
    }
}
```

### 4. Replace `deleteReport()` 

**NEW CODE:**
```javascript
async function deleteReport(reportId) {
    if (confirm('Are you sure you want to delete this report?')) {
        try {
            // Delete from SQL API
            await sqlApiDeleteReport(reportId);
            
            // Remove from localStorage
            const reports = getStorageData('reports');
            const filteredReports = reports.filter(r => r.id !== reportId);
            localStorage.setItem('reports', JSON.stringify(filteredReports));
            
            showToast('Report deleted successfully', 'success');
            loadUserReports();
        } catch (error) {
            showToast('Failed to delete report: ' + error.message, 'error');
        }
    }
}
```

### 5. Replace `updateReport()` 

**NEW CODE:**
```javascript
async function updateReport(reportId) {
    const reports = getStorageData('reports');
    const reportIndex = reports.findIndex(r => r.id === reportId);
    
    if (reportIndex === -1) {
        showToast('Report not found', 'error');
        return;
    }
    
    const hazardTitle = document.getElementById('hazardTitle').value.trim();
    const description = document.getElementById('hazardDescription').value.trim();
    const location = document.getElementById('location').value.trim();
    const severity = document.getElementById('severity').value;
    const dateObserved = document.getElementById('dateObserved').value;
    const timeObserved = document.getElementById('timeObserved').value;
    
    if (!hazardTitle || !description || !location || !severity || !dateObserved || !timeObserved) {
        showToast('Please fill all required fields', 'error');
        return;
    }
    
    try {
        // Update on SQL API
        const updates = {
            hazardTitle,
            description,
            location,
            severity,
            dateObserved,
            timeObserved
        };
        
        const updatedReport = await sqlApiUpdateReport(reportId, updates);
        
        // Update localStorage
        reports[reportIndex] = updatedReport;
        localStorage.setItem('reports', JSON.stringify(reports));
        
        addNotification('Hazard Report Updated', `Your report "${hazardTitle}" has been updated`, 'success');
        
        showToast('Report updated successfully!', 'success');
        document.getElementById('hazardForm').reset();
        currentEditingReportId = null;
        
        const submitButton = document.querySelector('#hazardForm button[type="submit"]');
        if (submitButton) {
            submitButton.textContent = 'Submit Hazard Report';
        }
        
        setTimeout(() => {
            showSection('dashboard');
            loadUserReports();
        }, 1000);
    } catch (error) {
        showToast('Failed to update report: ' + error.message, 'error');
    }
}
```

### 6. Replace `loadUserReports()` 

**NEW CODE:**
```javascript
async function loadUserReports() {
    const user = getCurrentUser();
    if (!user) return;
    
    try {
        // Fetch from SQL API with user filter
        const userReports = await sqlApiGetReports({ userId: user.id });
        
        // Cache locally
        if (userReports.length > 0) {
            const allReports = getStorageData('reports');
            const updatedReports = allReports.filter(r => r.userId !== user.id);
            updatedReports.push(...userReports);
            localStorage.setItem('reports', JSON.stringify(updatedReports));
        }
        
        displayReports(userReports, 'reportsList');
        updateStats(userReports);
    } catch (error) {
        console.warn('Failed to fetch reports from API, using localStorage');
        const reports = getStorageData('reports');
        const userReports = reports.filter(r => r.userId === user.id);
        displayReports(userReports, 'reportsList');
        updateStats(userReports);
    }
}
```

### 7. Replace `initializeCloudSync()` 

**NEW CODE:**
```javascript
async function initializeCloudSync() {
    // Check if backend API is available
    const isApiAvailable = await checkSqlApiHealth();
    
    if (!isApiAvailable) {
        console.warn('SQL API not available, using localStorage only');
        updateSyncStatusDisplay();
        setupLocalStorageSync();
        return;
    }
    
    console.info('SQL API available, starting real-time sync...');
    updateSyncStatusDisplay();
    
    // Initial sync
    try {
        await syncFromSqlApi();
        refreshVisibleReportViews();
    } catch (error) {
        console.warn('Initial sync failed:', error.message);
    }
    
    // Continuous polling every 5 seconds
    if (cloudSyncState.pollIntervalId) {
        clearInterval(cloudSyncState.pollIntervalId);
    }
    
    cloudSyncState.pollIntervalId = setInterval(async () => {
        try {
            await syncFromSqlApi();
            refreshVisibleReportViews();
        } catch (error) {
            console.warn('Sync failed:', error.message);
        }
    }, 5000);
    
    // Sync on focus
    window.addEventListener('focus', () => {
        syncFromSqlApi().then(() => {
            refreshVisibleReportViews();
        });
    });
    
    // Sync on visibility
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            syncFromSqlApi().then(() => {
                refreshVisibleReportViews();
            });
        }
    });
}

async function syncFromSqlApi() {
    try {
        // Fetch users and reports from SQL API
        const [users, reports] = await Promise.all([
            sqlApiGetUsers(),
            sqlApiGetReports()
        ]);
        
        // Update localStorage
        localStorage.setItem('users', JSON.stringify(users));
        localStorage.setItem('reports', JSON.stringify(reports));
        
        return { users, reports };
    } catch (error) {
        console.warn('Failed to sync from SQL API:', error.message);
        throw error;
    }
}
```

## Migration Checklist

- [ ] Include `sql-api-integration.js` in `index.html`
- [ ] Update `handleReportSubmit()` function
- [ ] Update `handleSignup()` function
- [ ] Update `handleLogin()` function
- [ ] Update `deleteReport()` function
- [ ] Update `updateReport()` function
- [ ] Update `loadUserReports()` function
- [ ] Update `initializeCloudSync()` function
- [ ] Update `loadAdminPanel()` to use `sqlApiGetReports()`
- [ ] Test all user workflows (signup, login, report creation)
- [ ] Verify real-time sync is working (5-second polling)
- [ ] Test offline fallback (localStorage)
- [ ] Update admin statistics endpoints

## Configuration

### Set Backend URL

```javascript
// At application startup:
setApiUrl('http://localhost:3001/api');
```

### Or via environment variable

```html
<script>
    window.MINEGUARD_API_URL = 'http://localhost:3001/api';
</script>
```

### Or via localStorage

```javascript
localStorage.setItem('mineguardApiUrl', 'http://localhost:3001/api');
```

## Error Handling

The SQL API integration includes automatic fallback to localStorage if the API is unavailable. This ensures your app continues to work even if the backend is temporarily down.

```javascript
async function loadUserReports() {
    try {
        // Try SQL API first
        const reports = await sqlApiGetReports({ userId: user.id });
        return reports;
    } catch (error) {
        // Fall back to localStorage
        console.warn('API failed, using cached data');
        return getStorageData('reports').filter(r => r.userId === user.id);
    }
}
```

## Real-time Sync Improvements

The new backend enables:
- **5-second polling** instead of 7-second (faster updates)
- **Error resilience** with automatic retries
- **Connection pooling** for better performance
- **Proper data types** and validation
- **Database relationships** (foreign keys)

## Offline Support

The app maintains localStorage cache for offline access:
1. All data fetched from SQL API is cached locally
2. Updates made offline are synced when connection returns
3. Fallback to localStorage if API is unavailable

## Performance Tips

1. Use `sqlApiGetReports({ userId })` to fetch only relevant reports
2. Implement pagination for large datasets
3. Use `sqlApiGetReportStats()` for dashboard metrics
4. Cache admin data locally to reduce API calls

## Next Steps

1. Start the backend: `npm start` (in backend directory)
2. Update frontend files as per guide above
3. Test with frontend at `http://localhost:3000`
4. Verify real-time sync is working
5. Remove old JSONBin.io code when ready

## Troubleshooting

### API Connection Failed
- Check backend is running: `http://localhost:3001/api/health`
- Verify CORS is configured correctly
- Check network tab for actual errors

### Data Not Syncing
- Check browser console for error messages
- Verify backend is running
- Check localStorage for cached data

### Users/Reports Not Loading
- Check that backend database was initialized: `npm run init-db`
- Run migration if needed: `npm run migrate`
- Check browser DevTools > Network > see API responses

## Support

For issues, check:
1. Backend logs (console output from `npm start`)
2. Browser console (F12 > Console tab)
3. Network tab (F12 > Network tab)
