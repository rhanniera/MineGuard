require('dotenv').config();
const { runAsync, allAsync, closeDatabase } = require('../db/connection');

// Sample users with Base64-encoded passwords
const SAMPLE_USERS = [
    {
        id: Date.now() - 100000,
        fullName: 'Sarah Johnson',
        company: 'Goldfield Mining',
        jobRole: 'Safety Officer',
        email: 'sarah.johnson@goldfield.com',
        password: Buffer.from('Password123').toString('base64'), // Password123
        memberSince: '01/15/2026',
        notifications: 'all',
        isAdmin: 0
    },
    {
        id: Date.now() - 90000,
        fullName: 'Marcus Chen',
        company: 'Copper Ridge Mines',
        jobRole: 'Site Manager',
        email: 'marcus.chen@copperridge.com',
        password: Buffer.from('SecurePass456').toString('base64'), // SecurePass456
        memberSince: '02/10/2026',
        notifications: 'all',
        isAdmin: 0
    },
    {
        id: Date.now() - 80000,
        fullName: 'Elena Rodriguez',
        company: 'Sierra Lithium',
        jobRole: 'Hazard Analyst',
        email: 'elena.rodriguez@sierra-lithium.com',
        password: Buffer.from('MineHazard789').toString('base64'), // MineHazard789
        memberSince: '01/20/2026',
        notifications: 'critical',
        isAdmin: 0
    },
    {
        id: Date.now() - 70000,
        fullName: 'James Williams',
        company: 'Diamond Peak Operations',
        jobRole: 'Operations Director',
        email: 'james.williams@diamond-peak.com',
        password: Buffer.from('DiamondOps2026').toString('base64'), // DiamondOps2026
        memberSince: '02/01/2026',
        notifications: 'all',
        isAdmin: 0
    },
    {
        id: Date.now() - 60000,
        fullName: 'Lisa Thompson',
        company: 'Ore Valley Mining',
        jobRole: 'Environmental Specialist',
        email: 'lisa.thompson@orevalley.com',
        password: Buffer.from('SafetyFirst2026').toString('base64'), // SafetyFirst2026
        memberSince: '02/05/2026',
        notifications: 'all',
        isAdmin: 0
    }
];

// Sample reports
const SAMPLE_REPORTS = [
    {
        id: Date.now() - 50000,
        userId: SAMPLE_USERS[0].id,
        submittedBy: SAMPLE_USERS[0].fullName,
        company: SAMPLE_USERS[0].company,
        hazardTitle: 'Unstable Support Beam - Level 2',
        description: 'Noticed a visible crack in the support beam near the main shaft entrance. The crack appears to be approximately 2-3 inches long and has been spreading. This poses an immediate safety risk to workers in the area.',
        location: 'Main Shaft - Level 2, Goldfield Mining',
        severity: 'High',
        dateObserved: '05/20/2026',
        timeObserved: '14:30',
        status: 'In Progress',
        submittedDate: new Date(Date.now() - 300000).toISOString(),
        lastUpdated: new Date(Date.now() - 100000).toISOString()
    },
    {
        id: Date.now() - 40000,
        userId: SAMPLE_USERS[1].id,
        submittedBy: SAMPLE_USERS[1].fullName,
        company: SAMPLE_USERS[1].company,
        hazardTitle: 'Gas Leak Detection Equipment Malfunction',
        description: 'Gas detection equipment at Station C is not responding correctly. Readings are inconsistent and may be masking actual gas presence. Equipment was last calibrated 3 months ago and may need servicing.',
        location: 'Station C, Copper Ridge Mines',
        severity: 'Critical',
        dateObserved: '05/25/2026',
        timeObserved: '09:15',
        status: 'Pending',
        submittedDate: new Date(Date.now() - 250000).toISOString(),
        lastUpdated: new Date(Date.now() - 250000).toISOString()
    },
    {
        id: Date.now() - 30000,
        userId: SAMPLE_USERS[2].id,
        submittedBy: SAMPLE_USERS[2].fullName,
        company: SAMPLE_USERS[2].company,
        hazardTitle: 'Inadequate PPE Storage',
        description: 'Personal protective equipment storage area lacks proper ventilation and humidity control. Helmets and respiratory protection equipment showing signs of deterioration. Fire extinguishers are also inaccessible due to blocked emergency exits.',
        location: 'Equipment Storage Building, Sierra Lithium',
        severity: 'Medium',
        dateObserved: '05/24/2026',
        timeObserved: '11:00',
        status: 'Resolved',
        submittedDate: new Date(Date.now() - 400000).toISOString(),
        lastUpdated: new Date(Date.now() - 50000).toISOString()
    },
    {
        id: Date.now() - 20000,
        userId: SAMPLE_USERS[3].id,
        submittedBy: SAMPLE_USERS[3].fullName,
        company: SAMPLE_USERS[3].company,
        hazardTitle: 'Improper Safety Procedures',
        description: 'Workers observed entering hazardous zones without proper authorization or supervision. Three workers bypassed the safety checkpoint at the eastern entrance. This is a recurring violation that needs immediate attention.',
        location: 'Eastern Entrance, Diamond Peak Operations',
        severity: 'High',
        dateObserved: '05/26/2026',
        timeObserved: '16:45',
        status: 'In Progress',
        submittedDate: new Date(Date.now() - 150000).toISOString(),
        lastUpdated: new Date(Date.now() - 100000).toISOString()
    },
    {
        id: Date.now() - 10000,
        userId: SAMPLE_USERS[4].id,
        submittedBy: SAMPLE_USERS[4].fullName,
        company: SAMPLE_USERS[4].company,
        hazardTitle: 'Environmental Water Contamination',
        description: 'Groundwater testing shows elevated levels of heavy metals near the tailings dam. pH levels are also abnormal. This may indicate a breach in containment or improper waste management procedures.',
        location: 'Tailings Dam Area, Ore Valley Mining',
        severity: 'Critical',
        dateObserved: '05/22/2026',
        timeObserved: '10:30',
        status: 'Pending',
        submittedDate: new Date(Date.now() - 500000).toISOString(),
        lastUpdated: new Date(Date.now() - 500000).toISOString()
    }
];

async function seedSampleData() {
    try {
        console.log('========================================');
        console.log('MineGuard Sample Data Seeding');
        console.log('========================================\n');

        // Count existing users (excluding admin)
        const existingUsers = await allAsync('SELECT COUNT(*) as count FROM users WHERE isAdmin = 0');
        console.log(`Existing non-admin users: ${existingUsers[0]?.count || 0}`);

        // Add sample users
        console.log(`\nAdding ${SAMPLE_USERS.length} sample users...`);
        let usersAdded = 0;
        for (const user of SAMPLE_USERS) {
            try {
                // Check if user exists by email
                const existing = await allAsync(
                    'SELECT id FROM users WHERE email = ?',
                    [user.email]
                ).catch(() => []);

                if (existing && existing.length > 0) {
                    console.log(`⊘ Skipped: ${user.email} (already exists)`);
                } else {
                    await runAsync(
                        `INSERT INTO users (id, fullName, company, jobRole, email, password, memberSince, notifications, isAdmin)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [user.id, user.fullName, user.company, user.jobRole, user.email, user.password, user.memberSince, user.notifications, user.isAdmin]
                    );
                    usersAdded++;
                    console.log(`✓ Added: ${user.email} (${user.fullName})`);
                }
            } catch (error) {
                console.warn(`✗ Failed to add ${user.email}:`, error.message);
            }
        }

        console.log(`\nAdding ${SAMPLE_REPORTS.length} sample reports...`);
        let reportsAdded = 0;
        for (const report of SAMPLE_REPORTS) {
            try {
                const existing = await allAsync(
                    'SELECT id FROM reports WHERE id = ?',
                    [report.id]
                ).catch(() => []);

                if (existing && existing.length > 0) {
                    console.log(`⊘ Skipped: "${report.hazardTitle}" (already exists)`);
                } else {
                    await runAsync(
                        `INSERT INTO reports (id, userId, submittedBy, company, hazardTitle, description, location, severity, dateObserved, timeObserved, status, submittedDate, lastUpdated)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [report.id, report.userId, report.submittedBy, report.company, report.hazardTitle, report.description, report.location, report.severity, report.dateObserved, report.timeObserved, report.status, report.submittedDate, report.lastUpdated]
                    );
                    reportsAdded++;
                    console.log(`✓ Added: "${report.hazardTitle}" (${report.severity})`);
                }
            } catch (error) {
                console.warn(`✗ Failed to add report "${report.hazardTitle}":`, error.message);
            }
        }

        // Verify
        console.log('\n--- Sample Data Summary ---');
        const totalUsers = await allAsync('SELECT COUNT(*) as count FROM users');
        const totalReports = await allAsync('SELECT COUNT(*) as count FROM reports');
        
        console.log(`Total Users in Database: ${totalUsers[0]?.count || 0}`);
        console.log(`Total Reports in Database: ${totalReports[0]?.count || 0}`);
        console.log(`\n✓ Sample data seeding complete!`);

        console.log('\n--- Sample User Credentials (for testing) ---');
        for (const user of SAMPLE_USERS) {
            const decodedPassword = Buffer.from(user.password, 'base64').toString('utf-8');
            console.log(`Email: ${user.email} | Password: ${decodedPassword}`);
        }

        process.exit(0);
    } catch (error) {
        console.error('Seeding failed:', error);
        process.exit(1);
    } finally {
        await closeDatabase();
    }
}

seedSampleData();
