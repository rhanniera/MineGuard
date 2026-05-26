require('dotenv').config();
const fetch = require('node-fetch');
const { runAsync, allAsync, closeDatabase } = require('../db/connection');

const JSONBIN_BIN_ID = process.env.JSONBIN_BIN_ID || '6a094d96250b1311c360c7ce';
const JSONBIN_MASTER_KEY = process.env.JSONBIN_MASTER_KEY || '$2a$10$fVqQW8fZrgNXj9Q28zQRY.o3vzbZFrMJH9QrgbxS8TWKejKg.Geoi';
const JSONBIN_URL = `https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}`;

async function fetchFromJsonBin() {
    try {
        console.log('Fetching data from JSONBin.io...');
        const response = await fetch(JSONBIN_URL, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'X-Master-Key': JSONBIN_MASTER_KEY
            }
        });

        if (!response.ok) {
            throw new Error(`JSONBin fetch failed: ${response.status}`);
        }

        const data = await response.json();
        console.log('✓ Data fetched from JSONBin.io');
        return data.record || {};
    } catch (error) {
        console.error('Error fetching from JSONBin.io:', error.message);
        console.log('Note: If JSONBin data is unavailable, you can use sample data instead.');
        return { users: [], reports: [] };
    }
}

async function migrateUsers(users) {
    console.log(`\nMigrating ${users.length} users...`);
    let migrated = 0;
    let skipped = 0;

    for (const user of users) {
        try {
            const id = user.id || Date.now();
            const fullName = user.fullName || 'Unknown';
            const company = user.company || 'Unknown';
            const jobRole = user.jobRole || 'Unknown';
            const email = user.email || `user_${id}@mineguard.local`;
            const password = user.password || Buffer.from('password').toString('base64');
            const memberSince = user.memberSince || new Date().toLocaleDateString();
            const notifications = user.notifications || 'all';
            const isAdmin = user.isAdmin ? 1 : 0;

            // Check if user already exists
            const existing = await runAsync(
                'SELECT id FROM users WHERE id = ? OR email = ?',
                [id, email]
            ).catch(() => null);

            if (existing) {
                skipped++;
                continue;
            }

            await runAsync(
                `INSERT INTO users (id, fullName, company, jobRole, email, password, isAdmin, memberSince, notifications)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [id, fullName, company, jobRole, email, password, isAdmin, memberSince, notifications]
            );
            migrated++;
        } catch (error) {
            console.warn(`Warning: Could not migrate user ${user.email || user.id}:`, error.message);
        }
    }

    console.log(`✓ Migrated ${migrated} users (${skipped} skipped)`);
}

async function migrateReports(reports) {
    console.log(`\nMigrating ${reports.length} reports...`);
    let migrated = 0;
    let skipped = 0;

    for (const report of reports) {
        try {
            const id = report.id || Date.now();
            const userId = report.userId || null;
            const submittedBy = report.submittedBy || 'Unknown';
            const company = report.company || 'Unknown';
            const hazardTitle = report.hazardTitle || 'No Title';
            const description = report.description || '';
            const location = report.location || 'Unknown';
            const severity = report.severity || 'Medium';
            const dateObserved = report.dateObserved || new Date().toISOString().split('T')[0];
            const timeObserved = report.timeObserved || '00:00';
            const status = report.status || 'Pending';
            const submittedDate = report.submittedDate || new Date().toISOString();
            const lastUpdated = report.lastUpdated || new Date().toISOString();

            // Check if report already exists
            const existing = await runAsync(
                'SELECT id FROM reports WHERE id = ?',
                [id]
            ).catch(() => null);

            if (existing) {
                skipped++;
                continue;
            }

            // Only insert if userId exists in database (if provided)
            if (userId) {
                const userExists = await runAsync(
                    'SELECT id FROM users WHERE id = ?',
                    [userId]
                ).catch(() => null);

                if (!userExists) {
                    console.warn(`Skipping report ${id}: user ${userId} not found in database`);
                    skipped++;
                    continue;
                }
            }

            await runAsync(
                `INSERT INTO reports (id, userId, submittedBy, company, hazardTitle, description, location, severity, dateObserved, timeObserved, status, submittedDate, lastUpdated)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [id, userId, submittedBy, company, hazardTitle, description, location, severity, dateObserved, timeObserved, status, submittedDate, lastUpdated]
            );

            // Migrate comments if present
            if (report.comments && Array.isArray(report.comments)) {
                for (const comment of report.comments) {
                    try {
                        await runAsync(
                            `INSERT INTO report_comments (reportId, userId, comment, createdAt)
                             VALUES (?, ?, ?, ?)`,
                            [id, comment.userId || userId, comment.text || comment, comment.date || new Date().toISOString()]
                        );
                    } catch (commentError) {
                        console.warn(`Warning: Could not migrate comment for report ${id}`);
                    }
                }
            }

            migrated++;
        } catch (error) {
            console.warn(`Warning: Could not migrate report ${report.id}:`, error.message);
        }
    }

    console.log(`✓ Migrated ${migrated} reports (${skipped} skipped)`);
}

async function verifyMigration() {
    try {
        console.log('\n--- Migration Summary ---');
        const userCount = await runAsync('SELECT COUNT(*) as count FROM users').then(r => r.count);
        const reportCount = await runAsync('SELECT COUNT(*) as count FROM reports').then(r => r.count);
        const commentCount = await runAsync('SELECT COUNT(*) as count FROM report_comments').then(r => r.count);

        console.log(`Users: ${userCount}`);
        console.log(`Reports: ${reportCount}`);
        console.log(`Comments: ${commentCount}`);
        console.log('✓ Migration complete!\n');
    } catch (error) {
        console.warn('Could not verify migration:', error.message);
    }
}

async function main() {
    try {
        console.log('========================================');
        console.log('MineGuard Data Migration');
        console.log('JSONBin.io → SQLite Database');
        console.log('========================================\n');

        const data = await fetchFromJsonBin();
        const users = data.users || [];
        const reports = data.reports || [];

        if (users.length === 0 && reports.length === 0) {
            console.log('\n⚠ No data found in JSONBin.io');
            console.log('You can manually add data through the API or web interface.');
            process.exit(0);
        }

        await migrateUsers(users);
        await migrateReports(reports);
        await verifyMigration();

        console.log('✓ Data migration complete! You can now start the backend server.');
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    } finally {
        await closeDatabase();
    }
}

main();
