const express = require('express');
const router = express.Router();
const { runAsync, getAsync, allAsync } = require('../db/connection');

// Get all reports
router.get('/', async (req, res) => {
    try {
        const status = req.query.status;
        const severity = req.query.severity;
        const userId = req.query.userId;

        let query = 'SELECT * FROM reports WHERE 1=1';
        const params = [];

        if (status) {
            query += ' AND status = ?';
            params.push(status);
        }
        if (severity) {
            query += ' AND severity = ?';
            params.push(severity);
        }
        if (userId) {
            query += ' AND userId = ?';
            params.push(userId);
        }

        query += ' ORDER BY submittedDate DESC';

        const reports = await allAsync(query, params);
        
        // Fetch comments for each report
        for (const report of reports) {
            const comments = await allAsync(
                'SELECT * FROM report_comments WHERE reportId = ? ORDER BY createdAt DESC',
                [report.id]
            );
            report.comments = comments;
        }

        res.json(reports);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get report by ID
router.get('/:id', async (req, res) => {
    try {
        const report = await getAsync('SELECT * FROM reports WHERE id = ?', [req.params.id]);
        
        if (!report) {
            return res.status(404).json({ error: 'Report not found' });
        }

        // Fetch comments
        const comments = await allAsync(
            'SELECT * FROM report_comments WHERE reportId = ? ORDER BY createdAt DESC',
            [req.params.id]
        );
        report.comments = comments;

        res.json(report);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create new report
router.post('/', async (req, res) => {
    try {
        const {
            userId,
            submittedBy,
            company,
            hazardTitle,
            description,
            location,
            severity,
            dateObserved,
            timeObserved
        } = req.body;

        // Validate required fields
        if (!userId || !submittedBy || !company || !hazardTitle || !description || 
            !location || !severity || !dateObserved || !timeObserved) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const id = Date.now();
        const submittedDate = new Date().toISOString();
        const lastUpdated = submittedDate;
        const status = 'Pending';

        await runAsync(
            `INSERT INTO reports (id, userId, submittedBy, company, hazardTitle, description, location, severity, dateObserved, timeObserved, status, submittedDate, lastUpdated)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, userId, submittedBy, company, hazardTitle, description, location, severity, dateObserved, timeObserved, status, submittedDate, lastUpdated]
        );

        const newReport = await getAsync('SELECT * FROM reports WHERE id = ?', [id]);
        newReport.comments = [];
        res.status(201).json(newReport);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update report
router.put('/:id', async (req, res) => {
    try {
        const { hazardTitle, description, location, severity, dateObserved, timeObserved, status } = req.body;

        const updateFields = [];
        const updateValues = [];

        if (hazardTitle !== undefined) {
            updateFields.push('hazardTitle = ?');
            updateValues.push(hazardTitle);
        }
        if (description !== undefined) {
            updateFields.push('description = ?');
            updateValues.push(description);
        }
        if (location !== undefined) {
            updateFields.push('location = ?');
            updateValues.push(location);
        }
        if (severity !== undefined) {
            updateFields.push('severity = ?');
            updateValues.push(severity);
        }
        if (dateObserved !== undefined) {
            updateFields.push('dateObserved = ?');
            updateValues.push(dateObserved);
        }
        if (timeObserved !== undefined) {
            updateFields.push('timeObserved = ?');
            updateValues.push(timeObserved);
        }
        if (status !== undefined) {
            updateFields.push('status = ?');
            updateValues.push(status);
        }

        if (updateFields.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }

        updateFields.push('lastUpdated = ?');
        updateValues.push(new Date().toISOString());
        updateValues.push(req.params.id);

        await runAsync(
            `UPDATE reports SET ${updateFields.join(', ')} WHERE id = ?`,
            updateValues
        );

        const updatedReport = await getAsync('SELECT * FROM reports WHERE id = ?', [req.params.id]);
        const comments = await allAsync('SELECT * FROM report_comments WHERE reportId = ? ORDER BY createdAt DESC', [req.params.id]);
        updatedReport.comments = comments;

        res.json(updatedReport);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete report
router.delete('/:id', async (req, res) => {
    try {
        await runAsync('DELETE FROM reports WHERE id = ?', [req.params.id]);
        res.json({ message: 'Report deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Add comment to report
router.post('/:reportId/comments', async (req, res) => {
    try {
        const { userId, comment } = req.body;

        if (!userId || !comment) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const reportId = req.params.reportId;
        
        // Verify report exists
        const report = await getAsync('SELECT id FROM reports WHERE id = ?', [reportId]);
        if (!report) {
            return res.status(404).json({ error: 'Report not found' });
        }

        await runAsync(
            'INSERT INTO report_comments (reportId, userId, comment) VALUES (?, ?, ?)',
            [reportId, userId, comment]
        );

        res.status(201).json({ message: 'Comment added successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get comments for report
router.get('/:reportId/comments', async (req, res) => {
    try {
        const comments = await allAsync(
            'SELECT * FROM report_comments WHERE reportId = ? ORDER BY createdAt DESC',
            [req.params.reportId]
        );
        res.json(comments);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get report statistics
router.get('/stats/summary', async (req, res) => {
    try {
        const totalReports = await getAsync('SELECT COUNT(*) as count FROM reports');
        const pendingReports = await getAsync("SELECT COUNT(*) as count FROM reports WHERE status = 'Pending'");
        const resolvedReports = await getAsync("SELECT COUNT(*) as count FROM reports WHERE status = 'Resolved'");
        const criticalReports = await getAsync("SELECT COUNT(*) as count FROM reports WHERE severity = 'Critical'");
        const highReports = await getAsync("SELECT COUNT(*) as count FROM reports WHERE severity = 'High'");

        const severityCount = await allAsync(
            "SELECT severity, COUNT(*) as count FROM reports GROUP BY severity"
        );

        res.json({
            totalReports: totalReports.count,
            pendingReports: pendingReports.count,
            resolvedReports: resolvedReports.count,
            criticalReports: criticalReports.count,
            highReports: highReports.count,
            bySeverity: severityCount
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
