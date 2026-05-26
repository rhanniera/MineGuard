const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = process.env.DATABASE_PATH || './data/mineguard.db';

// Ensure data directory exists
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

let db = null;

function getDatabase() {
    if (!db) {
        db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                console.error('Database connection error:', err);
                process.exit(1);
            }
            console.log('Connected to SQLite database at:', dbPath);
        });
        
        // Enable foreign keys
        db.run('PRAGMA foreign_keys = ON');
    }
    return db;
}

function runAsync(sql, params = []) {
    return new Promise((resolve, reject) => {
        getDatabase().run(sql, params, function(err) {
            if (err) reject(err);
            else resolve({ lastID: this.lastID, changes: this.changes });
        });
    });
}

function getAsync(sql, params = []) {
    return new Promise((resolve, reject) => {
        getDatabase().get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

function allAsync(sql, params = []) {
    return new Promise((resolve, reject) => {
        getDatabase().all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
        });
    });
}

function closeDatabase() {
    return new Promise((resolve, reject) => {
        if (db) {
            db.close((err) => {
                if (err) reject(err);
                else {
                    db = null;
                    resolve();
                }
            });
        } else {
            resolve();
        }
    });
}

module.exports = {
    getDatabase,
    runAsync,
    getAsync,
    allAsync,
    closeDatabase,
    dbPath
};
