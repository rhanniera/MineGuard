/**
 * SQL API Integration Module for MineGuard Frontend
 * Replaces JSONBin.io with local SQL database backend
 * Include this before the main script.js
 */

// ============================
// SQL API CONFIGURATION
// ============================

// Configure the API endpoint (change to match your backend URL)
const SQL_API_CONFIG = {
    baseURL: window.MINEGUARD_API_URL || localStorage.getItem('mineguardApiUrl') || 'http://localhost:3001/api',
    timeout: 10000,
    retryAttempts: 3,
    retryDelay: 1000
};

// Set API URL (can be configured at runtime)
function setApiUrl(url) {
    SQL_API_CONFIG.baseURL = url;
    localStorage.setItem('mineguardApiUrl', url);
}

function getApiUrl() {
    return SQL_API_CONFIG.baseURL;
}

// ============================
// SQL API HELPER FUNCTIONS
// ============================

async function fetchWithRetry(url, options = {}, retryCount = 0) {
    try {
        const response = await fetch(url, {
            timeout: SQL_API_CONFIG.timeout,
            ...options
        });

        if (!response.ok) {
            if (response.status === 409) {
                throw new Error('Conflict: Resource already exists');
            }
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return response;
    } catch (error) {
        if (retryCount < SQL_API_CONFIG.retryAttempts) {
            console.warn(`Request failed, retrying... (${retryCount + 1}/${SQL_API_CONFIG.retryAttempts})`);
            await new Promise(resolve => setTimeout(resolve, SQL_API_CONFIG.retryDelay));
            return fetchWithRetry(url, options, retryCount + 1);
        }
        throw error;
    }
}

// ============================
// USER API FUNCTIONS
// ============================

async function sqlApiGetUsers() {
    try {
        const response = await fetchWithRetry(`${SQL_API_CONFIG.baseURL}/users`);
        return await response.json();
    } catch (error) {
        console.warn('Failed to fetch users from SQL API:', error.message);
        return [];
    }
}

async function sqlApiGetUserById(userId) {
    try {
        const response = await fetchWithRetry(`${SQL_API_CONFIG.baseURL}/users/${userId}`);
        return await response.json();
    } catch (error) {
        console.warn(`Failed to fetch user ${userId}:`, error.message);
        return null;
    }
}

async function sqlApiGetUserByEmail(email) {
    try {
        const response = await fetchWithRetry(`${SQL_API_CONFIG.baseURL}/users/email/${encodeURIComponent(email)}`);
        return await response.json();
    } catch (error) {
        console.warn(`Failed to fetch user by email:`, error.message);
        return null;
    }
}

async function sqlApiCreateUser(userData) {
    try {
        const response = await fetchWithRetry(`${SQL_API_CONFIG.baseURL}/users`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData)
        });
        return await response.json();
    } catch (error) {
        console.error('Failed to create user:', error.message);
        throw error;
    }
}

async function sqlApiLoginUser(email, password) {
    try {
        const response = await fetchWithRetry(`${SQL_API_CONFIG.baseURL}/users/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        return await response.json();
    } catch (error) {
        console.error('Login failed:', error.message);
        throw error;
    }
}

async function sqlApiUpdateUser(userId, updates) {
    try {
        const response = await fetchWithRetry(`${SQL_API_CONFIG.baseURL}/users/${userId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates)
        });
        return await response.json();
    } catch (error) {
        console.error('Failed to update user:', error.message);
        throw error;
    }
}

async function sqlApiDeleteUser(userId) {
    try {
        const response = await fetchWithRetry(`${SQL_API_CONFIG.baseURL}/users/${userId}`, {
            method: 'DELETE'
        });
        return await response.json();
    } catch (error) {
        console.error('Failed to delete user:', error.message);
        throw error;
    }
}

async function sqlApiMakeAdmin(userId) {
    try {
        const response = await fetchWithRetry(`${SQL_API_CONFIG.baseURL}/users/${userId}/make-admin`, {
            method: 'POST'
        });
        return await response.json();
    } catch (error) {
        console.error('Failed to make user admin:', error.message);
        throw error;
    }
}

// ============================
// REPORT API FUNCTIONS
// ============================

async function sqlApiGetReports(filters = {}) {
    try {
        const params = new URLSearchParams();
        if (filters.status) params.append('status', filters.status);
        if (filters.severity) params.append('severity', filters.severity);
        if (filters.userId) params.append('userId', filters.userId);

        const url = `${SQL_API_CONFIG.baseURL}/reports${params.toString() ? '?' + params.toString() : ''}`;
        const response = await fetchWithRetry(url);
        return await response.json();
    } catch (error) {
        console.warn('Failed to fetch reports from SQL API:', error.message);
        return [];
    }
}

async function sqlApiGetReportById(reportId) {
    try {
        const response = await fetchWithRetry(`${SQL_API_CONFIG.baseURL}/reports/${reportId}`);
        return await response.json();
    } catch (error) {
        console.warn(`Failed to fetch report ${reportId}:`, error.message);
        return null;
    }
}

async function sqlApiCreateReport(reportData) {
    try {
        const response = await fetchWithRetry(`${SQL_API_CONFIG.baseURL}/reports`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(reportData)
        });
        return await response.json();
    } catch (error) {
        console.error('Failed to create report:', error.message);
        throw error;
    }
}

async function sqlApiUpdateReport(reportId, updates) {
    try {
        const response = await fetchWithRetry(`${SQL_API_CONFIG.baseURL}/reports/${reportId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates)
        });
        return await response.json();
    } catch (error) {
        console.error('Failed to update report:', error.message);
        throw error;
    }
}

async function sqlApiDeleteReport(reportId) {
    try {
        const response = await fetchWithRetry(`${SQL_API_CONFIG.baseURL}/reports/${reportId}`, {
            method: 'DELETE'
        });
        return await response.json();
    } catch (error) {
        console.error('Failed to delete report:', error.message);
        throw error;
    }
}

async function sqlApiAddComment(reportId, userId, comment) {
    try {
        const response = await fetchWithRetry(`${SQL_API_CONFIG.baseURL}/reports/${reportId}/comments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, comment })
        });
        return await response.json();
    } catch (error) {
        console.error('Failed to add comment:', error.message);
        throw error;
    }
}

async function sqlApiGetReportComments(reportId) {
    try {
        const response = await fetchWithRetry(`${SQL_API_CONFIG.baseURL}/reports/${reportId}/comments`);
        return await response.json();
    } catch (error) {
        console.warn(`Failed to fetch comments for report ${reportId}:`, error.message);
        return [];
    }
}

async function sqlApiGetReportStats() {
    try {
        const response = await fetchWithRetry(`${SQL_API_CONFIG.baseURL}/reports/stats/summary`);
        return await response.json();
    } catch (error) {
        console.warn('Failed to fetch report statistics:', error.message);
        return null;
    }
}

// ============================
// HEALTH CHECK
// ============================

async function checkSqlApiHealth() {
    try {
        const response = await fetchWithRetry(`${SQL_API_CONFIG.baseURL.replace('/api', '')}/api/health`);
        const health = await response.json();
        console.log('✓ SQL API is healthy', health);
        return true;
    } catch (error) {
        console.error('SQL API health check failed:', error.message);
        return false;
    }
}

// ============================
// DATA SYNC WITH FALLBACK
// ============================

/**
 * Hybrid fetch that tries SQL API first, falls back to localStorage
 */
async function getHybridUsers() {
    try {
        const sqlUsers = await sqlApiGetUsers();
        if (sqlUsers.length > 0) {
            // Cache in localStorage for offline access
            localStorage.setItem('users', JSON.stringify(sqlUsers));
            return sqlUsers;
        }
    } catch (error) {
        console.warn('SQL API failed, checking localStorage...');
    }

    // Fallback to localStorage
    return getStorageData('users');
}

async function getHybridReports() {
    try {
        const sqlReports = await sqlApiGetReports();
        if (sqlReports.length > 0 || sqlReports.length === 0) {
            // Cache in localStorage
            localStorage.setItem('reports', JSON.stringify(sqlReports));
            return sqlReports;
        }
    } catch (error) {
        console.warn('SQL API failed, checking localStorage...');
    }

    // Fallback to localStorage
    return getStorageData('reports');
}

/**
 * Save data to both SQL API and localStorage
 */
async function saveUserToStorage(user) {
    try {
        // Try to save to SQL API first
        if (user.id) {
            return await sqlApiUpdateUser(user.id, user);
        } else {
            return await sqlApiCreateUser(user);
        }
    } catch (error) {
        console.warn('Failed to save to SQL API, saving to localStorage:', error.message);
        // Fallback to localStorage
        const users = getStorageData('users');
        const index = users.findIndex(u => u.id === user.id);
        if (index >= 0) {
            users[index] = user;
        } else {
            users.push(user);
        }
        localStorage.setItem('users', JSON.stringify(users));
        return user;
    }
}

async function saveReportToStorage(report) {
    try {
        // Try to save to SQL API first
        if (report.id) {
            return await sqlApiUpdateReport(report.id, report);
        } else {
            return await sqlApiCreateReport(report);
        }
    } catch (error) {
        console.warn('Failed to save to SQL API, saving to localStorage:', error.message);
        // Fallback to localStorage
        const reports = getStorageData('reports');
        const index = reports.findIndex(r => r.id === report.id);
        if (index >= 0) {
            reports[index] = report;
        } else {
            reports.push(report);
        }
        localStorage.setItem('reports', JSON.stringify(reports));
        return report;
    }
}
