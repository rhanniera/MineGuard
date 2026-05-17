// ============================
// DATA MANAGEMENT & STORAGE
// ============================

// Get data from localStorage or initialize empty arrays
function getStorageData(key) {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
}

// Optional shared database URL (JSONBin.io or Firebase Realtime Database REST endpoint)
// Example JSONBin: https://api.jsonbin.io/v3/b/YOUR_BIN_ID
// Example Firebase: https://your-project-default-rtdb.firebaseio.com
const DEMO_SHARED_ENDPOINT = 'https://api.jsonbin.io/v3/b/6a094d96250b1311c360c7ce';
const JSONBIN_MASTER_KEY = '$2a$10$fVqQW8fZrgNXj9Q28zQRY.o3vzbZFrMJH9QrgbxS8TWKejKg.Geoi';

function getCloudDatabaseUrl() {
    const runtimeValue = window.MINEGUARD_CLOUD_DB_URL;
    const persistedValue = localStorage.getItem('mineguardCloudDbUrl');
    const demoMode = localStorage.getItem('mineguardDemoMode') === 'true';
    const value = (runtimeValue || persistedValue || '').trim();
    
    if (demoMode) {
        return DEMO_SHARED_ENDPOINT;
    }
    
    return value.replace(/\/+$/, '');
}

function isCloudSyncEnabled() {
    const isDemoMode = localStorage.getItem('mineguardDemoMode') === 'true';
    const hasUrl = /^https?:\/\//i.test(getCloudDatabaseUrl());
    return isDemoMode || hasUrl;
}

const cloudSyncState = {
    isSyncing: false,
    isApplyingRemoteChanges: false,
    pushTimers: {},
    pollIntervalId: null
};

function getRecordVersion(record) {
    if (!record || typeof record !== 'object') return 0;
    if (record.lastUpdated) return new Date(record.lastUpdated).getTime() || 0;
    if (record.submittedDate) return new Date(record.submittedDate).getTime() || 0;
    if (record.updatedAt) return new Date(record.updatedAt).getTime() || 0;
    return Number(record.id) || 0;
}

function getMergeKey(record, keyName) {
    if (keyName === 'users') {
        return record && record.email ? `email:${record.email.toLowerCase()}` : `id:${record.id}`;
    }
    return `id:${record && record.id}`;
}

function mergeRecords(localRecords, remoteRecords, keyName) {
    const localArray = Array.isArray(localRecords) ? localRecords : [];
    const remoteArray = Array.isArray(remoteRecords) ? remoteRecords : [];
    const mergedMap = new Map();

    localArray.forEach(item => {
        const mergeKey = getMergeKey(item, keyName);
        mergedMap.set(mergeKey, item);
    });

    remoteArray.forEach(item => {
        const mergeKey = getMergeKey(item, keyName);
        const existing = mergedMap.get(mergeKey);
        if (!existing || getRecordVersion(item) >= getRecordVersion(existing)) {
            mergedMap.set(mergeKey, item);
        }
    });

    return Array.from(mergedMap.values()).sort((a, b) => {
        const aVersion = getRecordVersion(a);
        const bVersion = getRecordVersion(b);
        return aVersion - bVersion;
    });
}

function arraysEqual(a, b) {
    return JSON.stringify(a) === JSON.stringify(b);
}

async function fetchCloudData(key) {
    const baseUrl = getCloudDatabaseUrl();
    if (!baseUrl) return null;

    try {
        let fetchUrl = baseUrl;
        let headers = {
            'Content-Type': 'application/json'
        };
        
        // Handle both JSONBin and Firebase URL formats
        if (baseUrl.includes('jsonbin.io')) {
            // JSONBin: use base URL directly, no key appended
            fetchUrl = baseUrl;
            // Add authentication header for JSONBin
            headers['X-Master-Key'] = JSONBIN_MASTER_KEY;
        } else {
            // Firebase: append key.json
            fetchUrl = `${baseUrl}/${key}.json`;
        }
        
        const response = await fetch(fetchUrl, {
            method: 'GET',
            headers: headers
        });

        // 404 means no data has been pushed yet - return empty array
        if (response.status === 404) {
            console.log(`Cloud: No data yet for ${key}`);
            return [];
        }

        if (!response.ok) {
            console.warn(`Cloud fetch error for ${key}: ${response.status}`);
            return null;
        }

        let payload = await response.json();
        
        // Handle JSONBin response format (wraps data in record property)
        if (baseUrl.includes('jsonbin.io') && payload.record) {
            payload = payload.record;
        }
        
        // Extract the specific key from the data
        if (baseUrl.includes('jsonbin.io')) {
            payload = payload[key] || [];
        }
        
        // Firebase returns null for non-existent paths
        if (payload === null) {
            return [];
        }
        
        return Array.isArray(payload) ? payload : [];
    } catch (error) {
        console.warn(`Cloud fetch exception for ${key}:`, error.message);
        return null;
    }
}

async function pushCloudData(key, data) {
    const baseUrl = getCloudDatabaseUrl();
    if (!baseUrl) return;

    try {
        let fetchUrl = baseUrl;
        let headers = {
            'Content-Type': 'application/json'
        };
        let body;
        
        // Handle both JSONBin and Firebase URL formats
        if (baseUrl.includes('jsonbin.io')) {
            // JSONBin: need to push entire object with both users and reports
            fetchUrl = baseUrl;
            const users = key === 'users' ? data : getStorageData('users');
            const reports = key === 'reports' ? data : getStorageData('reports');
            body = JSON.stringify({ users, reports });
            // Add authentication header for JSONBin
            headers['X-Master-Key'] = JSONBIN_MASTER_KEY;
        } else {
            // Firebase: push individual key
            fetchUrl = `${baseUrl}/${key}.json`;
            body = JSON.stringify(Array.isArray(data) ? data : []);
        }
        
        const response = await fetch(fetchUrl, {
            method: 'PUT',
            headers: headers,
            body: body
        });

        if (!response.ok) {
            console.warn(`Cloud push failed for ${key}: ${response.status}`);
            return;
        }
        
        console.log(`Cloud: Successfully pushed ${key}`);
    } catch (error) {
        console.warn(`Cloud push exception for ${key}:`, error.message);
    }
}

function queueCloudPush(key, data) {
    if (!isCloudSyncEnabled()) return;
    if (cloudSyncState.isApplyingRemoteChanges) return;

    if (cloudSyncState.pushTimers[key]) {
        clearTimeout(cloudSyncState.pushTimers[key]);
    }

    cloudSyncState.pushTimers[key] = setTimeout(async () => {
        try {
            await pushCloudData(key, data);
        } catch (error) {
            console.warn('Cloud push failed:', error.message);
        }
    }, 350);
}

async function syncCloudKey(key) {
    const localData = getStorageData(key);
    
    try {
        const remoteData = await fetchCloudData(key);

        // If remote fetch failed (null), skip sync but keep local data
        if (remoteData === null) {
            console.warn(`Skipping sync for ${key}: could not reach cloud`);
            return;
        }

        const mergedData = mergeRecords(localData, remoteData, key);
        const localChanged = !arraysEqual(localData, mergedData);
        const remoteChanged = !arraysEqual(remoteData, mergedData);

        if (localChanged) {
            console.log(`Cloud: Updating local ${key} (${mergedData.length} records)`);
            cloudSyncState.isApplyingRemoteChanges = true;
            localStorage.setItem(key, JSON.stringify(mergedData));
            cloudSyncState.isApplyingRemoteChanges = false;
        }

        if (remoteChanged) {
            console.log(`Cloud: Pushing ${key} to cloud (${mergedData.length} records)`);
            await pushCloudData(key, mergedData);
        }
    } catch (error) {
        console.warn(`Error syncing ${key}:`, error.message);
    }
}

async function syncCloudData() {
    if (!isCloudSyncEnabled() || cloudSyncState.isSyncing) return;
    cloudSyncState.isSyncing = true;

    try {
        await syncCloudKey('users');
        await syncCloudKey('reports');
    } catch (error) {
        console.warn('Cloud sync failed:', error.message);
    } finally {
        cloudSyncState.isSyncing = false;
    }
}

function refreshVisibleReportViews() {
    const adminSection = document.getElementById('admin');
    const dashboardSection = document.getElementById('dashboard');

    if (adminSection && adminSection.classList.contains('active') && isAdmin()) {
        loadAdminPanel();
    }

    if (dashboardSection && dashboardSection.classList.contains('active')) {
        loadUserReports();
    }
}

function updateSyncStatusDisplay() {
    const statusIndicator = document.getElementById('syncStatusIndicator');
    const statusText = document.getElementById('syncStatusText');
    const cloudDbUrlInput = document.getElementById('cloudDbUrl');
    const demoModeCheckbox = document.getElementById('demoModeToggle');
    
    if (!statusIndicator || !statusText) return;
    
    const isDemoMode = localStorage.getItem('mineguardDemoMode') === 'true';
    
    if (demoModeCheckbox) {
        demoModeCheckbox.checked = isDemoMode;
    }
    
    if (isCloudSyncEnabled()) {
        statusIndicator.className = 'status-indicator status-syncing';
        if (isDemoMode) {
            statusText.textContent = '🌐 Demo Shared Mode (Shared Testing)';
        } else {
            statusText.textContent = '🔄 Cloud Sync Active';
        }
        if (cloudDbUrlInput) {
            cloudDbUrlInput.value = isDemoMode ? '' : getCloudDatabaseUrl();
        }
    } else {
        statusIndicator.className = 'status-indicator status-local';
        statusText.textContent = '📱 Local Storage Only';
        if (cloudDbUrlInput) {
            cloudDbUrlInput.value = '';
        }
    }
}

function toggleAdminSettings() {
    const settingsDiv = document.getElementById('adminSettings');
    if (settingsDiv) {
        const isHidden = settingsDiv.style.display === 'none';
        settingsDiv.style.display = isHidden ? 'block' : 'none';
        if (isHidden) {
            updateSyncStatusDisplay();
        }
    }
}

function toggleDemoMode() {
    const isCurrentlyEnabled = localStorage.getItem('mineguardDemoMode') === 'true';
    if (isCurrentlyEnabled) {
        localStorage.removeItem('mineguardDemoMode');
        showToast('Demo mode disabled. Using local storage.', 'info');
    } else {
        localStorage.removeItem('mineguardCloudDbUrl');
        localStorage.setItem('mineguardDemoMode', 'true');
        showToast('Demo mode enabled! Reports now sync across all browsers testing this app.', 'success');
    }
    updateSyncStatusDisplay();
    initializeCloudSync();
}

function saveCloudDbUrl() {
    const urlInput = document.getElementById('cloudDbUrl');
    if (!urlInput) return;
    
    const url = urlInput.value.trim();
    
    if (!url) {
        showToast('Please enter a valid Firebase Realtime Database URL', 'error');
        return;
    }
    
    if (!/^https?:\/\//i.test(url)) {
        showToast('URL must start with http:// or https://', 'error');
        return;
    }
    
    localStorage.setItem('mineguardCloudDbUrl', url.replace(/\/+$/, ''));
    showToast('Cloud database URL saved! Syncing will start automatically.', 'success');
    updateSyncStatusDisplay();
    initializeCloudSync();
}

function disableCloudSync() {
    if (confirm('Disable cloud sync? Reports will remain local to this device.')) {
        localStorage.removeItem('mineguardCloudDbUrl');
        showToast('Cloud sync disabled. Using local storage only.', 'info');
        updateSyncStatusDisplay();
    }
}

function initializeCloudSync() {
    if (!isCloudSyncEnabled()) {
        console.info('Cloud sync disabled. Set window.MINEGUARD_CLOUD_DB_URL for multi-device syncing.');
        updateSyncStatusDisplay();
        // Setup localStorage cross-tab sync as fallback
        setupLocalStorageSync();
        return;
    }

    console.info('Cloud sync enabled. Starting sync...');
    
    // Force immediate sync to ensure admin user and all data is pushed to cloud
    // This is critical to prevent sync conflicts when multiple users interact
    syncCloudData().then(() => {
        console.log('Initial cloud sync completed');
        // Clear the admin sync flag after successful sync
        localStorage.removeItem('adminSyncRequired');
        refreshVisibleReportViews();
    });

    if (cloudSyncState.pollIntervalId) {
        clearInterval(cloudSyncState.pollIntervalId);
    }

    // Poll cloud for changes every 7 seconds
    cloudSyncState.pollIntervalId = setInterval(() => {
        syncCloudData().then(() => {
            refreshVisibleReportViews();
        });
    }, 7000);

    window.addEventListener('focus', () => {
        syncCloudData().then(() => {
            refreshVisibleReportViews();
        });
    });

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            syncCloudData().then(() => {
                refreshVisibleReportViews();
            });
        }
    });

    window.addEventListener('storage', event => {
        if (event.key === 'reports' || event.key === 'users') {
            refreshVisibleReportViews();
        }
    });
}

function setupLocalStorageSync() {
    // Listen for localStorage changes from other tabs (cross-tab sync fallback)
    window.addEventListener('storage', (event) => {
        if (event.key === 'reports' || event.key === 'users') {
            console.info(`Cross-tab sync detected for ${event.key}`);
            refreshVisibleReportViews();
        }
    });
}

function saveStorageData(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
    queueCloudPush(key, data);
}

function getCurrentUser() {
    return JSON.parse(localStorage.getItem('currentUser')) || null;
}

function setCurrentUser(user) {
    localStorage.setItem('currentUser', JSON.stringify(user));
}

function isAdmin() {
    const user = getCurrentUser();
    return user && user.isAdmin === true;
}

// ============================
// PAGE INITIALIZATION
// ============================

document.addEventListener('DOMContentLoaded', function () {
    // Enable demo mode by default to use JSONBin.io cloud sync
    if (!localStorage.getItem('mineguardDemoMode') && !localStorage.getItem('mineguardCloudDbUrl')) {
        localStorage.setItem('mineguardDemoMode', 'true');
        console.log('Demo mode auto-enabled - using JSONBin.io for cloud sync');
    }
    
    initializeAdminAccount();
    initializeCloudSync();
    initializeApp();
    setupEventListeners();
    
    // Set today's date as default for date input
    const dateInput = document.getElementById('dateObserved');
    if (dateInput) {
        dateInput.valueAsDate = new Date();
    }
});

function initializeAdminAccount() {
    // Check if admin account exists
    const users = getStorageData('users');
    const adminExists = users.some(u => u.email === 'admin@admin.com');
    
    if (!adminExists) {
        const adminUser = {
            id: Date.now(),
            fullName: 'System Administrator',
            company: 'MineGuard Admin',
            jobRole: 'Administrator',
            email: 'admin@admin.com',
            password: btoa('Totheremix123!'), // Base64 encoding for consistency
            memberSince: new Date().toLocaleDateString(),
            notifications: 'all',
            isAdmin: true
        };
        
        users.push(adminUser);
        saveStorageData('users', users);
        console.log('Admin account created: admin@admin.com');
        
        // Ensure admin user is synced to cloud immediately before other operations
        // This prevents sync conflicts when other users create accounts
        localStorage.setItem('adminSyncRequired', 'true');
    }
}

function initializeApp() {
    const user = getCurrentUser();
    
    if (user) {
        // User is logged in
        document.getElementById('logoutBtn').style.display = 'block';
        document.getElementById('profileLink').style.display = 'block';
        document.getElementById('loginBtn').style.display = 'none';
        document.getElementById('signupBtn').style.display = 'none';
        document.getElementById('authTitle').textContent = 'Welcome, ' + user.fullName;
        
        // Show admin link only if user is admin
        if (isAdmin()) {
            document.getElementById('adminLink').style.display = 'block';
        } else {
            document.getElementById('adminLink').style.display = 'none';
        }
        
        loadUserProfile();
        loadUserReports();
    } else {
        // User is logged out
        document.getElementById('logoutBtn').style.display = 'none';
        document.getElementById('profileLink').style.display = 'none';
        document.getElementById('adminLink').style.display = 'none';
        document.getElementById('loginBtn').style.display = 'block';
        document.getElementById('signupBtn').style.display = 'block';
        showSection('home');
    }
}

function setupEventListeners() {
    // Authentication forms
    document.getElementById('signupForm').addEventListener('submit', handleSignup);
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    
    // Hazard report form
    document.getElementById('hazardForm').addEventListener('submit', handleReportSubmit);
    
    // Profile form
    document.getElementById('profileForm').addEventListener('submit', handleProfileUpdate);
    document.getElementById('passwordForm').addEventListener('submit', handlePasswordChange);
    
    // Dashboard filters
    document.getElementById('searchReports').addEventListener('input', filterReports);
    document.getElementById('filterStatus').addEventListener('change', filterReports);
    document.getElementById('filterSeverity').addEventListener('change', filterReports);
    
    // Admin filters
    document.getElementById('adminSearchReports').addEventListener('input', filterAdminReports);
    document.getElementById('adminFilterStatus').addEventListener('change', filterAdminReports);
    document.getElementById('adminFilterSeverity').addEventListener('change', filterAdminReports);
    
    // Mobile menu toggle
    document.getElementById('hamburger').addEventListener('click', toggleMobileMenu);
    
    // Close mobile menu when clicking on nav link
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', closeMobileMenu);
    });
    
    // Close modals when clicking outside the modal content
    const reportModal = document.getElementById('reportModal');
    const usersModal = document.getElementById('usersModal');
    
    if (reportModal) {
        reportModal.addEventListener('click', function(event) {
            if (event.target === this) {
                closeModal();
            }
        });
    }
    
    if (usersModal) {
        usersModal.addEventListener('click', function(event) {
            if (event.target === this) {
                closeUsersModal();
            }
        });
    }
}

// ============================
// NAVIGATION & SECTIONS
// ============================

function showSection(sectionId) {
    // Check if user is logged in for protected sections
    const user = getCurrentUser();
    const protectedSections = ['report', 'dashboard', 'profile'];
    const adminSections = ['admin'];
    
    if (protectedSections.includes(sectionId) && !user) {
        showToast('Please log in first', 'info');
        showSection('auth');
        return;
    }
    
    // Check if user is admin for admin sections
    if (adminSections.includes(sectionId) && !isAdmin()) {
        showToast('Admin access required. Only administrators can access this section.', 'error');
        showSection('home');
        return;
    }
    
    // Hide all sections
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
    });
    
    // Show selected section
    const section = document.getElementById(sectionId);
    if (section) {
        section.classList.add('active');
        
        // Load data when switching to certain sections
        if (sectionId === 'dashboard') {
            loadUserReports();
            syncCloudData().then(() => {
                loadUserReports();
            });
        } else if (sectionId === 'admin') {
            loadAdminPanel();
            syncCloudData().then(() => {
                loadAdminPanel();
            });
        } else if (sectionId === 'profile') {
            loadUserProfile();
        }
    }
}

function checkAuthAndNavigate(sectionId) {
    const user = getCurrentUser();
    if (!user) {
        showSection('auth');
    } else {
        showSection(sectionId);
    }
}

function toggleMobileMenu() {
    const navMenu = document.getElementById('navMenu');
    navMenu.classList.toggle('active');
}

function closeMobileMenu() {
    const navMenu = document.getElementById('navMenu');
    navMenu.classList.remove('active');
}

// ============================
// AUTHENTICATION
// ============================

function toggleAuthForm() {
    const signupForm = document.getElementById('signupForm');
    const loginForm = document.getElementById('loginForm');
    const authTitle = document.getElementById('authTitle');
    
    signupForm.classList.toggle('active-form');
    loginForm.classList.toggle('active-form');
    
    authTitle.textContent = signupForm.classList.contains('active-form') 
        ? 'Create Your Account' 
        : 'Login to Your Account';
}

function showLoginForm() {
    const signupForm = document.getElementById('signupForm');
    const loginForm = document.getElementById('loginForm');
    const authTitle = document.getElementById('authTitle');
    
    // Show login form
    signupForm.classList.remove('active-form');
    loginForm.classList.add('active-form');
    authTitle.textContent = 'Login to Your Account';
    
    // Navigate to auth section
    showSection('auth');
}

function showSignupForm() {
    const signupForm = document.getElementById('signupForm');
    const loginForm = document.getElementById('loginForm');
    const authTitle = document.getElementById('authTitle');
    
    // Show signup form
    signupForm.classList.add('active-form');
    loginForm.classList.remove('active-form');
    authTitle.textContent = 'Create Your Account';
    
    // Navigate to auth section
    showSection('auth');
}

function validatePassword(password) {
    return password.length >= 8;
}

function handleSignup(e) {
    e.preventDefault();
    
    const fullName = document.getElementById('fullName').value.trim();
    const company = document.getElementById('company').value.trim();
    const jobRole = document.getElementById('jobRole').value.trim();
    const email = document.getElementById('signupEmail').value.trim();
    const password = document.getElementById('signupPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    
    // Validation
    if (!fullName || !company || !jobRole || !email) {
        showToast('Please fill all required fields', 'error');
        return;
    }
    
    if (!validatePassword(password)) {
        showToast('Password must be at least 8 characters', 'error');
        return;
    }
    
    if (password !== confirmPassword) {
        showToast('Passwords do not match', 'error');
        return;
    }
    
    // Check if email already exists
    const users = getStorageData('users');
    if (users.some(u => u.email === email)) {
        showToast('Email already registered', 'error');
        return;
    }
    
    // Create new user
    const newUser = {
        id: Date.now(),
        fullName,
        company,
        jobRole,
        email,
        password: btoa(password), // Simple encoding (not secure, use hashing in production)
        memberSince: new Date().toLocaleDateString(),
        notifications: 'all'
    };
    
    users.push(newUser);
    saveStorageData('users', users);
    
    // Force immediate sync to cloud so admin can see new user
    if (isCloudSyncEnabled()) {
        console.log('New user registered: forcing cloud sync');
        syncCloudData();
    }
    
    setCurrentUser(newUser);
    showToast('Account created successfully!', 'success');
    
    // Reset form and switch to login
    document.getElementById('signupForm').reset();
    setTimeout(() => {
        initializeApp();
        showSection('home');
    }, 1000);
}

function handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    
    if (!email || !password) {
        showToast('Please enter email and password', 'error');
        return;
    }
    
    const users = getStorageData('users');
    const user = users.find(u => u.email === email && u.password === btoa(password));
    
    if (!user) {
        showToast('Invalid email or password', 'error');
        return;
    }
    
    setCurrentUser(user);
    
    if (user.isAdmin) {
        showToast('Welcome Admin! You now have access to the admin dashboard.', 'success');
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
}

function logout() {
    localStorage.removeItem('currentUser');
    document.getElementById('adminLink').style.display = 'none';
    document.getElementById('loginBtn').style.display = 'block';
    document.getElementById('signupBtn').style.display = 'block';
    showToast('Logged out successfully', 'success');
    setTimeout(() => {
        initializeApp();
        showSection('home');
    }, 500);
}

// ============================
// HAZARD REPORT MANAGEMENT
// ============================

function handleReportSubmit(e) {
    e.preventDefault();
    
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
        id: Date.now(),
        userId: user.id,
        submittedBy: anonymous ? 'Anonymous' : user.fullName,
        company: user.company,
        hazardTitle,
        description,
        location,
        severity,
        dateObserved,
        timeObserved,
        status: 'Pending',
        submittedDate: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        comments: []
    };
    
    const reports = getStorageData('reports');
    reports.push(newReport);
    saveStorageData('reports', reports);
    
    // Force immediate sync to cloud to ensure report is immediately visible to admin
    if (isCloudSyncEnabled()) {
        syncCloudData();
    }
    
    showToast('Hazard report submitted successfully!', 'success');
    document.getElementById('hazardForm').reset();
    
    setTimeout(() => {
        showSection('dashboard');
        loadUserReports();
    }, 1000);
}

function deleteReport(reportId) {
    if (confirm('Are you sure you want to delete this report?')) {
        const reports = getStorageData('reports');
        const filteredReports = reports.filter(r => r.id !== reportId);
        saveStorageData('reports', filteredReports);
        showToast('Report deleted successfully', 'success');
        loadUserReports();
    }
}

function editReport(reportId) {
    const reports = getStorageData('reports');
    const report = reports.find(r => r.id === reportId);
    
    if (!report) {
        showToast('Report not found', 'error');
        return;
    }
    
    if (report.status === 'Resolved') {
        showToast('Cannot edit resolved reports', 'error');
        return;
    }
    
    // Pre-fill the form
    document.getElementById('hazardTitle').value = report.hazardTitle;
    document.getElementById('hazardDescription').value = report.description;
    document.getElementById('location').value = report.location;
    document.getElementById('severity').value = report.severity;
    document.getElementById('dateObserved').value = report.dateObserved;
    document.getElementById('timeObserved').value = report.timeObserved;
    
    // Update the form submit handler to update instead of create
    const form = document.getElementById('hazardForm');
    form.onsubmit = function(e) {
        e.preventDefault();
        updateReport(reportId);
    };
    
    showSection('report');
    document.querySelector('.section-header p').textContent = 'Edit your hazard report';
}

function updateReport(reportId) {
    const reports = getStorageData('reports');
    const reportIndex = reports.findIndex(r => r.id === reportId);
    
    if (reportIndex === -1) {
        showToast('Report not found', 'error');
        return;
    }
    
    const report = reports[reportIndex];
    
    report.hazardTitle = document.getElementById('hazardTitle').value.trim();
    report.description = document.getElementById('hazardDescription').value.trim();
    report.location = document.getElementById('location').value.trim();
    report.severity = document.getElementById('severity').value;
    report.dateObserved = document.getElementById('dateObserved').value;
    report.timeObserved = document.getElementById('timeObserved').value;
    report.lastUpdated = new Date().toISOString();
    
    reports[reportIndex] = report;
    saveStorageData('reports', reports);
    
    showToast('Report updated successfully!', 'success');
    document.getElementById('hazardForm').reset();
    
    // Reset form submit handler
    const form = document.getElementById('hazardForm');
    form.onsubmit = handleReportSubmit;
    
    setTimeout(() => {
        showSection('dashboard');
        loadUserReports();
    }, 1000);
}

// ============================
// DASHBOARD & REPORTING
// ============================

function loadUserReports() {
    const user = getCurrentUser();
    if (!user) return;
    
    const reports = getStorageData('reports');
    const userReports = reports.filter(r => r.userId === user.id);
    
    displayReports(userReports, 'reportsList');
    updateStats(userReports);
}

function displayReports(reports, containerId) {
    const container = document.getElementById(containerId);
    const noReports = document.getElementById('noReports');
    
    if (reports.length === 0) {
        container.style.display = 'none';
        noReports.style.display = 'block';
        return;
    }
    
    container.style.display = 'grid';
    noReports.style.display = 'none';
    container.innerHTML = '';
    
    reports.forEach(report => {
        const reportCard = createReportCard(report);
        container.appendChild(reportCard);
    });
}

function createReportCard(report) {
    const card = document.createElement('div');
    card.className = `report-card ${report.severity.toLowerCase()}`;
    
    const submittedDate = new Date(report.submittedDate).toLocaleDateString();
    const description = report.description.substring(0, 150) + (report.description.length > 150 ? '...' : '');
    
    card.innerHTML = `
        <div class="report-header">
            <h3 class="report-title">${report.hazardTitle}</h3>
            <div class="report-meta">
                <span class="badge severity-${report.severity.toLowerCase()}">${report.severity}</span>
                <span class="badge status-${report.status.toLowerCase().replace(' ', '')}">${report.status}</span>
            </div>
        </div>
        <div class="report-meta">
            <span><strong>Location:</strong> ${report.location}</span>
            <span><strong>Submitted:</strong> ${submittedDate}</span>
        </div>
        <p class="report-description">${description}</p>
        <div class="report-actions">
            <button class="btn btn-primary" onclick="viewReport(${report.id})">View Details</button>
            ${report.status !== 'Resolved' ? `<button class="btn btn-secondary" onclick="editReport(${report.id})">Edit</button>` : ''}
            <button class="btn btn-danger" onclick="deleteReport(${report.id})">Delete</button>
        </div>
    `;
    
    return card;
}

function viewReport(reportId) {
    const reports = getStorageData('reports');
    const report = reports.find(r => r.id === reportId);
    
    if (!report) {
        showToast('Report not found', 'error');
        return;
    }
    
    const modal = document.getElementById('reportModal');
    const modalBody = document.getElementById('modalBody');
    
    const submittedDate = new Date(report.submittedDate).toLocaleString();
    const dateObserved = new Date(report.dateObserved).toLocaleDateString();
    
    let commentsHtml = '<h4>Comments:</h4>';
    if (report.comments && report.comments.length > 0) {
        report.comments.forEach(comment => {
            commentsHtml += `<p><strong>${comment.author}:</strong> ${comment.text}</p>`;
        });
    } else {
        commentsHtml += '<p>No comments yet</p>';
    }
    
    modalBody.innerHTML = `
        <div class="modal-report-header">
            <h2>${report.hazardTitle}</h2>
            <div style="display: flex; gap: 1rem; margin-top: 0.5rem;">
                <span class="badge severity-${report.severity.toLowerCase()}">${report.severity}</span>
                <span class="badge status-${report.status.toLowerCase().replace(' ', '')}">${report.status}</span>
            </div>
        </div>
        
        <div class="modal-info">
            <div class="modal-info-row">
                <span class="modal-info-label">Description:</span>
            </div>
            <p style="color: var(--text-light);">${report.description}</p>
            
            <div class="modal-info-row">
                <span class="modal-info-label">Location:</span>
                <span class="modal-info-value">${report.location}</span>
            </div>
            
            <div class="modal-info-row">
                <span class="modal-info-label">Date Observed:</span>
                <span class="modal-info-value">${dateObserved}</span>
            </div>
            
            <div class="modal-info-row">
                <span class="modal-info-label">Time Observed:</span>
                <span class="modal-info-value">${report.timeObserved}</span>
            </div>
            
            <div class="modal-info-row">
                <span class="modal-info-label">Submitted By:</span>
                <span class="modal-info-value">${report.submittedBy}</span>
            </div>
            
            <div class="modal-info-row">
                <span class="modal-info-label">Company:</span>
                <span class="modal-info-value">${report.company}</span>
            </div>
            
            <div class="modal-info-row">
                <span class="modal-info-label">Submitted Date:</span>
                <span class="modal-info-value">${submittedDate}</span>
            </div>
        </div>
        
        <div style="background: var(--bg-light); padding: 1rem; border-radius: 6px; margin-bottom: 1rem;">
            ${commentsHtml}
        </div>
        
        ${report.status !== 'Resolved' ? `
            <div style="margin-bottom: 1rem;">
                <input type="text" id="commentInput" placeholder="Add a comment..." style="width: 100%; padding: 0.75rem; border: 1px solid var(--border-light); border-radius: 6px;">
            </div>
            <div class="modal-actions">
                <button class="btn btn-primary" onclick="addComment(${report.id})">Add Comment</button>
                <button class="btn btn-secondary" onclick="closeModal()">Close</button>
            </div>
        ` : `
            <div class="modal-actions">
                <button class="btn btn-secondary" onclick="closeModal()">Close</button>
            </div>
        `}
    `;
    
    modal.classList.add('active');
}

function closeModal() {
    const modal = document.getElementById('reportModal');
    modal.classList.remove('active');
}

function showUsersModal() {
    const allUsers = getStorageData('users');
    const regularUsers = allUsers.filter(u => !u.isAdmin);
    
    const modal = document.getElementById('usersModal');
    const modalBody = document.getElementById('usersModalBody');
    
    let usersHtml = '<h2>Registered Users</h2>';
    usersHtml += `<p style="color: var(--text-light); margin-bottom: 1.5rem;">Total Users: ${regularUsers.length}</p>`;
    
    if (regularUsers.length === 0) {
        usersHtml += '<p style="text-align: center; color: var(--text-light);">No registered users yet</p>';
    } else {
        usersHtml += '<div style="overflow-y: auto; max-height: 500px;">';
        regularUsers.forEach(user => {
            usersHtml += `
                <div style="border: 1px solid var(--border-light); padding: 1rem; margin-bottom: 1rem; border-radius: 6px; background: var(--bg-light);">
                    <h4 style="margin-top: 0;">${user.fullName}</h4>
                    <div class="modal-info-row">
                        <span class="modal-info-label">Email:</span>
                        <span class="modal-info-value">${user.email}</span>
                    </div>
                    <div class="modal-info-row">
                        <span class="modal-info-label">Company:</span>
                        <span class="modal-info-value">${user.company}</span>
                    </div>
                    <div class="modal-info-row">
                        <span class="modal-info-label">Job Role:</span>
                        <span class="modal-info-value">${user.jobRole}</span>
                    </div>
                    <div class="modal-info-row">
                        <span class="modal-info-label">Member Since:</span>
                        <span class="modal-info-value">${user.memberSince}</span>
                    </div>
                </div>
            `;
        });
        usersHtml += '</div>';
    }
    
    usersHtml += `
        <div class="modal-actions" style="margin-top: 1.5rem;">
            <button class="btn btn-secondary" onclick="closeUsersModal()">Close</button>
        </div>
    `;
    
    modalBody.innerHTML = usersHtml;
    modal.classList.add('active');
}

function closeUsersModal() {
    const modal = document.getElementById('usersModal');
    modal.classList.remove('active');
}

function addComment(reportId) {
    const commentText = document.getElementById('commentInput').value.trim();
    
    if (!commentText) {
        showToast('Please enter a comment', 'error');
        return;
    }
    
    const user = getCurrentUser();
    const reports = getStorageData('reports');
    const reportIndex = reports.findIndex(r => r.id === reportId);
    
    if (reportIndex === -1) {
        showToast('Report not found', 'error');
        return;
    }
    
    const report = reports[reportIndex];
    if (!report.comments) {
        report.comments = [];
    }
    
    report.comments.push({
        author: user.fullName,
        text: commentText,
        date: new Date().toLocaleString()
    });
    report.lastUpdated = new Date().toISOString();
    
    reports[reportIndex] = report;
    saveStorageData('reports', reports);
    
    showToast('Comment added successfully', 'success');
    viewReport(reportId);
}

function updateStats(reports) {
    document.getElementById('totalReports').textContent = reports.length;
    document.getElementById('pendingReports').textContent = reports.filter(r => r.status === 'Pending').length;
    document.getElementById('reviewReports').textContent = reports.filter(r => r.status === 'In Review').length;
    document.getElementById('resolvedReports').textContent = reports.filter(r => r.status === 'Resolved').length;
}

function filterReports() {
    const user = getCurrentUser();
    if (!user) return;
    
    const searchTerm = document.getElementById('searchReports').value.toLowerCase();
    const statusFilter = document.getElementById('filterStatus').value;
    const severityFilter = document.getElementById('filterSeverity').value;
    
    let reports = getStorageData('reports').filter(r => r.userId === user.id);
    
    // Apply search filter
    if (searchTerm) {
        reports = reports.filter(r =>
            r.hazardTitle.toLowerCase().includes(searchTerm) ||
            r.description.toLowerCase().includes(searchTerm) ||
            r.location.toLowerCase().includes(searchTerm)
        );
    }
    
    // Apply status filter
    if (statusFilter) {
        reports = reports.filter(r => r.status === statusFilter);
    }
    
    // Apply severity filter
    if (severityFilter) {
        reports = reports.filter(r => r.severity === severityFilter);
    }
    
    displayReports(reports, 'reportsList');
}

// ============================
// PROFILE MANAGEMENT
// ============================

function loadUserProfile() {
    const user = getCurrentUser();
    if (!user) return;
    
    document.getElementById('profileFullName').textContent = user.fullName;
    document.getElementById('profileCompany').textContent = user.company;
    document.getElementById('profileJobRole').textContent = user.jobRole;
    document.getElementById('profileEmail').textContent = user.email;
    document.getElementById('profileMemberSince').textContent = user.memberSince;
    
    document.getElementById('updateFullName').value = user.fullName;
    document.getElementById('updateCompany').value = user.company;
    document.getElementById('updateJobRole').value = user.jobRole;
    document.getElementById('updateEmail').value = user.email;
    document.getElementById('notificationSettings').value = user.notifications || 'all';
}

function handleProfileUpdate(e) {
    e.preventDefault();
    
    const user = getCurrentUser();
    if (!user) return;
    
    user.fullName = document.getElementById('updateFullName').value.trim();
    user.company = document.getElementById('updateCompany').value.trim();
    user.jobRole = document.getElementById('updateJobRole').value.trim();
    user.email = document.getElementById('updateEmail').value.trim();
    user.notifications = document.getElementById('notificationSettings').value;
    user.updatedAt = new Date().toISOString();
    
    // Update in users array
    const users = getStorageData('users');
    const userIndex = users.findIndex(u => u.id === user.id);
    users[userIndex] = user;
    saveStorageData('users', users);
    setCurrentUser(user);
    
    showToast('Profile updated successfully!', 'success');
    loadUserProfile();
}

function showChangePassword() {
    document.getElementById('changePasswordForm').style.display = 'block';
}

function hideChangePassword() {
    document.getElementById('changePasswordForm').style.display = 'none';
    document.getElementById('passwordForm').reset();
}

function handlePasswordChange(e) {
    e.preventDefault();
    
    const user = getCurrentUser();
    if (!user) return;
    
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmNewPassword').value;
    
    // Verify current password
    if (user.password !== btoa(currentPassword)) {
        showToast('Current password is incorrect', 'error');
        return;
    }
    
    // Validate new password
    if (!validatePassword(newPassword)) {
        showToast('New password must be at least 8 characters', 'error');
        return;
    }
    
    if (newPassword !== confirmPassword) {
        showToast('Passwords do not match', 'error');
        return;
    }
    
    // Update password
    user.password = btoa(newPassword);
    user.updatedAt = new Date().toISOString();
    
    const users = getStorageData('users');
    const userIndex = users.findIndex(u => u.id === user.id);
    users[userIndex] = user;
    saveStorageData('users', users);
    setCurrentUser(user);
    
    showToast('Password changed successfully!', 'success');
    hideChangePassword();
}

function deleteAccount() {
    if (confirm('Are you sure? This action cannot be undone. All your data will be permanently deleted.')) {
        if (confirm('This is your final warning. Delete account?')) {
            const user = getCurrentUser();
            const users = getStorageData('users');
            const filteredUsers = users.filter(u => u.id !== user.id);
            saveStorageData('users', filteredUsers);
            
            const reports = getStorageData('reports');
            const filteredReports = reports.filter(r => r.userId !== user.id);
            saveStorageData('reports', filteredReports);
            
            logout();
        }
    }
}

// ============================
// ADMIN PANEL
// ============================

function loadAdminPanel() {
    const user = getCurrentUser();
    if (!isAdmin()) {
        showToast('Admin access required', 'error');
        showSection('home');
        return;
    }
    
    updateSyncStatusDisplay();
    
    // Force sync from cloud to ensure admin sees latest data from all users
    // This is critical for seeing reports from other users
    if (isCloudSyncEnabled()) {
        console.log('Admin panel: Forcing cloud sync to fetch latest data from all users');
        syncCloudData();
    }
    
    const allReports = getStorageData('reports');
    const allUsers = getStorageData('users');
    
    // Calculate stats
    const stats = {
        total: allReports.length,
        critical: allReports.filter(r => r.severity === 'Critical').length,
        high: allReports.filter(r => r.severity === 'High').length,
        pending: allReports.filter(r => r.status === 'Pending').length,
        inReview: allReports.filter(r => r.status === 'In Review').length,
        resolved: allReports.filter(r => r.status === 'Resolved').length,
        totalUsers: allUsers.filter(u => !u.isAdmin).length,
        avgTime: calculateAvgResolutionTime(allReports)
    };
    
    document.getElementById('adminTotalReports').textContent = stats.total;
    document.getElementById('adminCriticalReports').textContent = stats.critical;
    document.getElementById('adminPendingReports').textContent = stats.pending;
    document.getElementById('adminAvgTime').textContent = stats.avgTime;
    
    // Add additional stats display with clickable total users
    const statsContainer = document.querySelector('.admin-stats');
    if (statsContainer && !document.getElementById('adminHighReports')) {
        const additionalStats = `
            <div class="stat-card">
                <h4>High Severity</h4>
                <p id="adminHighReports">${stats.high}</p>
            </div>
            <div class="stat-card">
                <h4>In Review</h4>
                <p id="adminInReviewReports">${stats.inReview}</p>
            </div>
            <div class="stat-card">
                <h4>Resolved</h4>
                <p id="adminResolvedReports">${stats.resolved}</p>
            </div>
            <div class="stat-card" style="cursor: pointer; transition: all 0.3s ease;" onmouseover="this.style.transform='translateY(-5px)'; this.style.boxShadow='0 10px 25px rgba(0,0,0,0.15)';" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 8px rgba(0,0,0,0.1)';" onclick="showUsersModal()">
                <h4>Total Users</h4>
                <p id="adminTotalUsers" style="margin: 0;">${stats.totalUsers}</p>
                <p style="font-size: 0.85rem; color: var(--text-light); margin-top: 0.5rem;">Click to view list</p>
            </div>
        `;
        statsContainer.insertAdjacentHTML('beforeend', additionalStats);
    } else if (document.getElementById('adminHighReports')) {
        document.getElementById('adminHighReports').textContent = stats.high;
        document.getElementById('adminInReviewReports').textContent = stats.inReview;
        document.getElementById('adminResolvedReports').textContent = stats.resolved;
        document.getElementById('adminTotalUsers').textContent = stats.totalUsers;
    }
    
    displayAdminReports(allReports);
}

function displayAdminReports(reports) {
    const container = document.getElementById('adminReportsList');
    container.innerHTML = '';
    
    if (reports.length === 0) {
        container.innerHTML = '<p style="text-align: center; padding: 2rem; color: var(--text-light);">No hazard reports in the system yet</p>';
        return;
    }
    
    reports.forEach(report => {
        const card = document.createElement('div');
        card.className = `admin-report-card ${report.severity.toLowerCase()}`;
        
        const submittedDate = new Date(report.submittedDate).toLocaleDateString();
        
        card.innerHTML = `
            <div class="admin-report-header">
                <div>
                    <h3 class="admin-report-title">${report.hazardTitle}</h3>
                    <p class="admin-report-submitter">Submitted by: ${report.submittedBy} | ${report.company}</p>
                </div>
                <div>
                    <span class="badge severity-${report.severity.toLowerCase()}">${report.severity}</span>
                    <span class="badge status-${report.status.toLowerCase().replace(' ', '')}">${report.status}</span>
                </div>
            </div>
            <p style="color: var(--text-light); margin: 1rem 0;">${report.description.substring(0, 200)}...</p>
            <p style="color: var(--text-light); font-size: 0.9rem; margin-bottom: 1rem;">
                <strong>Location:</strong> ${report.location} | <strong>Submitted:</strong> ${submittedDate}
            </p>
            <div class="admin-report-actions">
                <button class="btn btn-primary" onclick="openAdminReportDetail(${report.id})">View Details</button>
                <select class="status-update" onchange="updateReportStatus(${report.id}, this.value)">
                    <option value="">Change Status</option>
                    <option value="Pending">Pending</option>
                    <option value="In Review">In Review</option>
                    <option value="Resolved">Resolved</option>
                </select>
                <button class="btn btn-danger" onclick="adminDeleteReport(${report.id})">Delete</button>
            </div>
        `;
        
        container.appendChild(card);
    });
}

function openAdminReportDetail(reportId) {
    const reports = getStorageData('reports');
    const report = reports.find(r => r.id === reportId);
    
    if (!report) {
        showToast('Report not found', 'error');
        return;
    }
    
    viewReport(reportId);
}

function updateReportStatus(reportId, newStatus) {
    if (!newStatus) return;
    
    if (!isAdmin()) {
        showToast('Only admins can update report status', 'error');
        return;
    }
    
    const reports = getStorageData('reports');
    const reportIndex = reports.findIndex(r => r.id === reportId);
    
    if (reportIndex === -1) {
        showToast('Report not found', 'error');
        return;
    }
    
    reports[reportIndex].status = newStatus;
    reports[reportIndex].lastUpdated = new Date().toISOString();
    saveStorageData('reports', reports);
    
    showToast(`Report status updated to: ${newStatus}`, 'success');
    loadAdminPanel();
}

function adminDeleteReport(reportId) {
    if (!isAdmin()) {
        showToast('Only admins can delete reports', 'error');
        return;
    }
    
    if (confirm('Are you sure you want to permanently delete this report? This action cannot be undone.')) {
        const reports = getStorageData('reports');
        const filteredReports = reports.filter(r => r.id !== reportId);
        saveStorageData('reports', filteredReports);
        showToast('Report deleted successfully', 'success');
        loadAdminPanel();
    }
}

function filterAdminReports() {
    if (!isAdmin()) {
        showToast('Admin access required', 'error');
        return;
    }
    
    const searchTerm = document.getElementById('adminSearchReports').value.toLowerCase();
    const statusFilter = document.getElementById('adminFilterStatus').value;
    const severityFilter = document.getElementById('adminFilterSeverity').value;
    
    let reports = getStorageData('reports');
    
    if (searchTerm) {
        reports = reports.filter(r =>
            r.hazardTitle.toLowerCase().includes(searchTerm) ||
            r.description.toLowerCase().includes(searchTerm) ||
            r.location.toLowerCase().includes(searchTerm) ||
            r.submittedBy.toLowerCase().includes(searchTerm)
        );
    }
    
    if (statusFilter) {
        reports = reports.filter(r => r.status === statusFilter);
    }
    
    if (severityFilter) {
        reports = reports.filter(r => r.severity === severityFilter);
    }
    
    displayAdminReports(reports);
}

function exportReportsAsJSON() {
    if (!isAdmin()) {
        showToast('Admin access required', 'error');
        return;
    }
    
    const reports = getStorageData('reports');
    const dataStr = JSON.stringify(reports, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `hazard-reports-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    showToast('Reports exported successfully', 'success');
}

function exportReportsAsCSV() {
    if (!isAdmin()) {
        showToast('Admin access required', 'error');
        return;
    }
    
    const reports = getStorageData('reports');
    
    if (reports.length === 0) {
        showToast('No reports to export', 'warning');
        return;
    }
    
    // Create CSV header
    const headers = ['ID', 'Title', 'Description', 'Location', 'Severity', 'Status', 'Submitted By', 'Company', 'Date Observed', 'Time Observed', 'Submitted Date'];
    const csvContent = [
        headers.join(','),
        ...reports.map(r => [
            r.id,
            `"${r.hazardTitle}"`,
            `"${r.description.substring(0, 100)}"`,
            `"${r.location}"`,
            r.severity,
            r.status,
            r.submittedBy,
            r.company,
            r.dateObserved,
            r.timeObserved,
            new Date(r.submittedDate).toLocaleString()
        ].join(','))
    ].join('\n');
    
    const dataBlob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `hazard-reports-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    showToast('Reports exported as CSV successfully', 'success');
}

function calculateAvgResolutionTime(reports) {
    const resolvedReports = reports.filter(r => r.status === 'Resolved');
    
    if (resolvedReports.length === 0) return '-';
    
    // Simple calculation - difference between submitted and today
    const totalDays = resolvedReports.reduce((sum, r) => {
        const submitted = new Date(r.submittedDate);
        const days = Math.floor((new Date() - submitted) / (1000 * 60 * 60 * 24));
        return sum + days;
    }, 0);
    
    return Math.round(totalDays / resolvedReports.length) + ' days';
}

// ============================
// FAQ FUNCTIONALITY
// ============================

function toggleFAQ(element) {
    const faqItem = element.parentElement;
    
    // Close other items
    document.querySelectorAll('.faq-item').forEach(item => {
        if (item !== faqItem) {
            item.classList.remove('active');
        }
    });
    
    faqItem.classList.toggle('active');
}

// ============================
// NOTIFICATIONS & FEEDBACK
// ============================

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast show ${type}`;
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// ============================
// UTILITY FUNCTIONS
// ============================

// Initialize the app when page loads
window.addEventListener('load', function () {
    console.log('MineGuard Hazard Reporting System initialized');
    console.log('Hazard reports:', getStorageData('reports'));
    console.log('Registered users:', getStorageData('users').length);
});

// Demo data initialization (optional - comment out if not needed)
function initializeDemoData() {
    if (!localStorage.getItem('demoDataInitialized')) {
        const demoUsers = [
            {
                id: 1,
                fullName: 'John Smith',
                company: 'ABC Mining Ltd.',
                jobRole: 'Underground Supervisor',
                email: 'john@example.com',
                password: btoa('password123'),
                memberSince: '2024-01-15',
                notifications: 'all'
            },
            {
                id: 2,
                fullName: 'Sarah Johnson',
                company: 'XYZ Resources',
                jobRole: 'Safety Officer',
                email: 'sarah@example.com',
                password: btoa('password123'),
                memberSince: '2024-02-20',
                notifications: 'critical'
            }
        ];
        
        const demoReports = [
            {
                id: 101,
                userId: 1,
                submittedBy: 'John Smith',
                company: 'ABC Mining Ltd.',
                hazardTitle: 'Loose Roof Bolts',
                description: 'Several roof bolts in Level 3, Section B appeared to be loosened. They should be inspected and tightened immediately.',
                location: 'Level 3, Section B',
                severity: 'High',
                dateObserved: '2024-12-10',
                timeObserved: '14:30',
                status: 'In Review',
                submittedDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
                comments: [{author: 'Safety Team', text: 'Engineer assigned for inspection'}]
            },
            {
                id: 102,
                userId: 2,
                submittedBy: 'Sarah Johnson',
                company: 'XYZ Resources',
                hazardTitle: 'Gas Accumulation Alert',
                description: 'Methane levels elevated in ventilation area. Reading: 1.2%. Ventilation increased and area temporarily restricted.',
                location: 'Ventilation Shaft A',
                severity: 'Critical',
                dateObserved: '2024-12-12',
                timeObserved: '09:15',
                status: 'Pending',
                submittedDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
                comments: []
            }
        ];
        
        saveStorageData('users', demoUsers);
        saveStorageData('reports', demoReports);
        localStorage.setItem('demoDataInitialized', 'true');
    }
}

// Uncomment this line to initialize demo data on first load
// initializeDemoData();
