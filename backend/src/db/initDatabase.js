require('dotenv').config();
const { initializeDatabase, seedAdminUser } = require('./schema');
const { closeDatabase } = require('./connection');

async function main() {
    try {
        await initializeDatabase();
        await seedAdminUser();
        console.log('\n✓ Database initialization complete!');
        console.log('Ready to migrate data from JSONBin.io');
        process.exit(0);
    } catch (error) {
        console.error('Failed to initialize database:', error);
        process.exit(1);
    } finally {
        await closeDatabase();
    }
}

main();
