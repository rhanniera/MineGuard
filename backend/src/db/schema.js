const { runAsync, getAsync, allAsync } = require('./connection');

const SCHEMA = `
-- Users Table
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    fullName TEXT NOT NULL,
    company TEXT NOT NULL,
    jobRole TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    isAdmin INTEGER DEFAULT 0,
    memberSince TEXT NOT NULL,
    notifications TEXT DEFAULT 'all',
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
    updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Reports Table
CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY,
    userId INTEGER NOT NULL,
    submittedBy TEXT NOT NULL,
    company TEXT NOT NULL,
    hazardTitle TEXT NOT NULL,
    description TEXT NOT NULL,
    location TEXT NOT NULL,
    severity TEXT NOT NULL CHECK(severity IN ('Low', 'Medium', 'High', 'Critical')),
    dateObserved TEXT NOT NULL,
    timeObserved TEXT NOT NULL,
    status TEXT DEFAULT 'Pending' CHECK(status IN ('Pending', 'In Progress', 'Resolved', 'Closed')),
    submittedDate TEXT NOT NULL,
    lastUpdated TEXT NOT NULL,
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
    updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES users(id)
);

-- Report Comments Table
CREATE TABLE IF NOT EXISTS report_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reportId INTEGER NOT NULL,
    userId INTEGER NOT NULL,
    comment TEXT NOT NULL,
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
    updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (reportId) REFERENCES reports(id) ON DELETE CASCADE,
    FOREIGN KEY (userId) REFERENCES users(id)
);

-- Deleted Records Table (for tracking deletions across syncs)
CREATE TABLE IF NOT EXISTS deleted_records (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL CHECK(type IN ('user', 'report')),
    entityId INTEGER NOT NULL,
    deletedAt TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT DEFAULT 'info' CHECK(type IN ('info', 'success', 'warning', 'error')),
    isRead INTEGER DEFAULT 0,
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);

-- Sync Log Table (for tracking when data was last synced)
CREATE TABLE IF NOT EXISTS sync_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity TEXT NOT NULL,
    lastSyncTime TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Create Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_reports_userId ON reports(userId);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_severity ON reports(severity);
CREATE INDEX IF NOT EXISTS idx_reports_submittedDate ON reports(submittedDate);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_notifications_userId ON notifications(userId);
CREATE INDEX IF NOT EXISTS idx_report_comments_reportId ON report_comments(reportId);
`;

async function initializeDatabase() {
    try {
        console.log('Initializing database schema...');
        
        // Split schema into individual statements
        const statements = SCHEMA.split(';')
            .map(stmt => stmt.trim())
            .filter(stmt => stmt.length > 0);
        
        for (const statement of statements) {
            await runAsync(statement);
        }
        
        console.log('✓ Database schema initialized successfully');
        return true;
    } catch (error) {
        console.error('Error initializing database:', error);
        throw error;
    }
}

async function seedAdminUser() {
    try {
        // Check if admin already exists
        const adminExists = await getAsync('SELECT id FROM users WHERE isAdmin = 1 LIMIT 1');
        
        if (!adminExists) {
            const adminId = Date.now();
            await runAsync(
                `INSERT INTO users (id, fullName, company, jobRole, email, password, isAdmin, memberSince)
                 VALUES (?, ?, ?, ?, ?, ?, 1, ?)`,
                [
                    adminId,
                    'Admin User',
                    'MineGuard',
                    'System Administrator',
                    'admin@mineguard.local',
                    Buffer.from('admin123').toString('base64'), // Base64 encoded like original
                    new Date().toLocaleDateString()
                ]
            );
            console.log('✓ Admin user created');
        } else {
            console.log('✓ Admin user already exists');
        }
    } catch (error) {
        console.error('Error seeding admin user:', error);
    }
}

module.exports = {
    initializeDatabase,
    seedAdminUser
};
