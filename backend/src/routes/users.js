const express = require('express');
const router = express.Router();
const { runAsync, getAsync, allAsync } = require('../db/connection');

// Get all users
router.get('/', async (req, res) => {
    try {
        const users = await allAsync('SELECT * FROM users ORDER BY createdAt DESC');
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get user by ID
router.get('/:id', async (req, res) => {
    try {
        const user = await getAsync('SELECT * FROM users WHERE id = ?', [req.params.id]);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get user by email
router.get('/email/:email', async (req, res) => {
    try {
        const user = await getAsync('SELECT * FROM users WHERE email = ?', [req.params.email]);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create new user (Sign up)
router.post('/', async (req, res) => {
    try {
        const { fullName, company, jobRole, email, password } = req.body;

        // Validate required fields
        if (!fullName || !company || !jobRole || !email || !password) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Check if user already exists
        const existing = await getAsync('SELECT id FROM users WHERE email = ?', [email]);
        if (existing) {
            return res.status(409).json({ error: 'Email already registered' });
        }

        const id = Date.now();
        const memberSince = new Date().toLocaleDateString();

        await runAsync(
            `INSERT INTO users (id, fullName, company, jobRole, email, password, memberSince, notifications)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, fullName, company, jobRole, email, password, memberSince, 'all']
        );

        const newUser = await getAsync('SELECT * FROM users WHERE id = ?', [id]);
        res.status(201).json(newUser);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Login user (verify credentials)
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password required' });
        }

        // Case-insensitive email matching
        const user = await getAsync('SELECT * FROM users WHERE LOWER(email) = LOWER(?) AND password = ?', [email, password]);
        
        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        res.json(user);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update user
router.put('/:id', async (req, res) => {
    try {
        const { fullName, company, jobRole, notifications } = req.body;

        const updateFields = [];
        const updateValues = [];

        if (fullName !== undefined) {
            updateFields.push('fullName = ?');
            updateValues.push(fullName);
        }
        if (company !== undefined) {
            updateFields.push('company = ?');
            updateValues.push(company);
        }
        if (jobRole !== undefined) {
            updateFields.push('jobRole = ?');
            updateValues.push(jobRole);
        }
        if (notifications !== undefined) {
            updateFields.push('notifications = ?');
            updateValues.push(notifications);
        }

        if (updateFields.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }

        updateValues.push(req.params.id);
        updateFields.push('updatedAt = CURRENT_TIMESTAMP');

        await runAsync(
            `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`,
            updateValues
        );

        const updatedUser = await getAsync('SELECT * FROM users WHERE id = ?', [req.params.id]);
        res.json(updatedUser);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete user
router.delete('/:id', async (req, res) => {
    try {
        await runAsync('DELETE FROM users WHERE id = ?', [req.params.id]);
        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get admin users
router.get('/admin/list', async (req, res) => {
    try {
        const admins = await allAsync('SELECT * FROM users WHERE isAdmin = 1');
        res.json(admins);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Set user as admin
router.post('/:id/make-admin', async (req, res) => {
    try {
        await runAsync('UPDATE users SET isAdmin = 1 WHERE id = ?', [req.params.id]);
        const user = await getAsync('SELECT * FROM users WHERE id = ?', [req.params.id]);
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
