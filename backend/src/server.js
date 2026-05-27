require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { initializeDatabase, seedAdminUser } = require('./db/schema');
const { closeDatabase } = require('./db/connection');

// Import routes
const usersRoutes = require('./routes/users');
const reportsRoutes = require('./routes/reports');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// CORS configuration
const corsOptions = {
    origin: ['http://localhost:3000', 'http://localhost:3001', 'http://127.0.0.1:3000', 'http://127.0.0.1:3001', 'file://'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', '*'],
    optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Routes
app.use('/api/users', usersRoutes);
app.use('/api/reports', reportsRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});

// Sync endpoint for real-time updates (returns last sync time and changed records)
app.get('/api/sync', async (req, res) => {
    try {
        const { users, reports } = require('./db/connection');
        const lastSync = req.query.lastSync ? new Date(req.query.lastSync) : new Date(0);
        
        res.json({
            timestamp: new Date().toISOString(),
            message: 'Use individual /api/users and /api/reports endpoints for data'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

// Initialize database and start server
async function startServer() {
    try {
        console.log('========================================');
        console.log('MineGuard Backend Server');
        console.log('========================================\n');

        // Initialize database
        await initializeDatabase();
        await seedAdminUser();

        // Start server
        app.listen(PORT, () => {
            console.log(`✓ Server running on http://localhost:${PORT}`);
            console.log(`✓ Database: ${process.env.DATABASE_PATH || './data/mineguard.db'}`);
            console.log(`\nAvailable endpoints:`);
            console.log(`  GET    /api/health              - Health check`);
            console.log(`  GET    /api/users               - Get all users`);
            console.log(`  POST   /api/users               - Create new user (sign up)`);
            console.log(`  POST   /api/users/login         - User login`);
            console.log(`  GET    /api/users/:id           - Get user by ID`);
            console.log(`  PUT    /api/users/:id           - Update user`);
            console.log(`  DELETE /api/users/:id           - Delete user`);
            console.log(`  GET    /api/reports             - Get all reports (with filters)`);
            console.log(`  POST   /api/reports             - Create new report`);
            console.log(`  GET    /api/reports/:id         - Get report by ID`);
            console.log(`  PUT    /api/reports/:id         - Update report`);
            console.log(`  DELETE /api/reports/:id         - Delete report`);
            console.log(`  POST   /api/reports/:id/comments - Add comment to report`);
            console.log(`  GET    /api/reports/stats/summary - Get statistics`);
            console.log(`\nServer ready for requests!\n`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log('\nShutting down server...');
    await closeDatabase();
    process.exit(0);
});

startServer();
