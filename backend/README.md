# MineGuard Backend - SQL Database Migration

## Overview

This is the new backend for MineGuard that replaces JSONBin.io with a robust SQL database (SQLite) for better performance, real-time consistency, and scalability.

## Features

✓ **SQLite Database** - Local file-based database for easy deployment  
✓ **RESTful API** - Standard HTTP endpoints for all operations  
✓ **Real-time Sync** - Frequent polling support for near-real-time updates  
✓ **Data Migration** - Automated migration from JSONBin.io  
✓ **Comprehensive Schema** - Properly normalized tables with relationships  
✓ **User Management** - Authentication, role management (admin/user)  
✓ **Report Management** - Full CRUD operations with comments  
✓ **Statistics & Analytics** - Built-in reporting endpoints  

## Installation

### Prerequisites
- Node.js 14+ 
- npm or yarn

### Setup Steps

```bash
# 1. Navigate to backend directory
cd backend

# 2. Install dependencies
npm install

# 3. Create environment configuration
cp .env.example .env

# 4. Initialize database
npm run init-db

# 5. Migrate data from JSONBin.io (optional)
npm run migrate

# 6. Start the server
npm start
```

For development with auto-reload:
```bash
npm run dev
```

## Database Schema

### Users Table
```
id (INTEGER, PRIMARY KEY)
fullName (TEXT)
company (TEXT)
jobRole (TEXT)
email (TEXT, UNIQUE)
password (TEXT) - base64 encoded
isAdmin (INTEGER) - 0 or 1
memberSince (TEXT)
notifications (TEXT) - 'all', 'important', 'none'
createdAt (TEXT, TIMESTAMP)
updatedAt (TEXT, TIMESTAMP)
```

### Reports Table
```
id (INTEGER, PRIMARY KEY)
userId (INTEGER, FOREIGN KEY → users.id)
submittedBy (TEXT)
company (TEXT)
hazardTitle (TEXT)
description (TEXT)
location (TEXT)
severity (TEXT) - Low, Medium, High, Critical
dateObserved (TEXT)
timeObserved (TEXT)
status (TEXT) - Pending, In Progress, Resolved, Closed
submittedDate (TEXT, TIMESTAMP)
lastUpdated (TEXT, TIMESTAMP)
createdAt (TEXT, TIMESTAMP)
updatedAt (TEXT, TIMESTAMP)
```

### Report Comments Table
```
id (INTEGER, PRIMARY KEY AUTOINCREMENT)
reportId (INTEGER, FOREIGN KEY → reports.id)
userId (INTEGER, FOREIGN KEY → users.id)
comment (TEXT)
createdAt (TEXT, TIMESTAMP)
updatedAt (TEXT, TIMESTAMP)
```

### Additional Tables
- **deleted_records**: Tracks deletions across syncs
- **notifications**: User notifications
- **sync_log**: Tracks last sync times

## API Endpoints

### User Management

#### Get all users
```
GET /api/users
```

#### Get user by ID
```
GET /api/users/:id
```

#### Get user by email
```
GET /api/users/email/:email
```

#### Sign up (create new user)
```
POST /api/users
Content-Type: application/json

{
  "fullName": "John Doe",
  "company": "Mining Corp",
  "jobRole": "Safety Officer",
  "email": "john@mineguard.local",
  "password": "base64_encoded_password"
}
```

#### Login
```
POST /api/users/login
Content-Type: application/json

{
  "email": "john@mineguard.local",
  "password": "base64_encoded_password"
}
```

#### Update user
```
PUT /api/users/:id
Content-Type: application/json

{
  "fullName": "Jane Doe",
  "notifications": "important"
}
```

#### Delete user
```
DELETE /api/users/:id
```

### Report Management

#### Get all reports
```
GET /api/reports
Query Parameters:
  - status: Pending, In Progress, Resolved, Closed
  - severity: Low, Medium, High, Critical
  - userId: Filter by user ID
```

#### Get report by ID
```
GET /api/reports/:id
```

#### Create new report
```
POST /api/reports
Content-Type: application/json

{
  "userId": 1234567890,
  "submittedBy": "John Doe",
  "company": "Mining Corp",
  "hazardTitle": "Loose Equipment",
  "description": "Found loose bolts on crane",
  "location": "Section A2",
  "severity": "High",
  "dateObserved": "2024-05-27",
  "timeObserved": "14:30"
}
```

#### Update report
```
PUT /api/reports/:id
Content-Type: application/json

{
  "status": "In Progress",
  "severity": "Critical"
}
```

#### Delete report
```
DELETE /api/reports/:id
```

#### Add comment to report
```
POST /api/reports/:reportId/comments
Content-Type: application/json

{
  "userId": 1234567890,
  "comment": "Safety team reviewing this issue"
}
```

#### Get report comments
```
GET /api/reports/:reportId/comments
```

#### Get statistics
```
GET /api/reports/stats/summary
```

Returns:
```json
{
  "totalReports": 45,
  "pendingReports": 12,
  "resolvedReports": 28,
  "criticalReports": 3,
  "highReports": 8,
  "bySeverity": [
    { "severity": "Critical", "count": 3 },
    { "severity": "High", "count": 8 },
    ...
  ]
}
```

## Frontend Integration

Update your frontend to use the new SQL API instead of JSONBin.io:

```javascript
// Replace JSONBin.io calls with:
const API_BASE_URL = 'http://localhost:3001/api';

async function fetchUsers() {
  const response = await fetch(`${API_BASE_URL}/users`);
  return response.json();
}

async function createReport(reportData) {
  const response = await fetch(`${API_BASE_URL}/reports`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(reportData)
  });
  return response.json();
}
```

## Real-time Synchronization

For real-time updates without WebSockets, the frontend can:

1. **Polling** - Call `/api/reports` and `/api/users` every 3-5 seconds
2. **Version Tracking** - Use `lastUpdated` timestamps to detect changes
3. **Optimistic Updates** - Update local state immediately, sync after
4. **Push on Focus** - Full sync when browser window regains focus

## Data Migration

The migration script automatically:
1. Fetches data from JSONBin.io
2. Transforms it to SQL format
3. Validates user relationships
4. Inserts all records into the database
5. Preserves IDs and timestamps

Run migration:
```bash
npm run migrate
```

## Environment Configuration

Create a `.env` file based on `.env.example`:

```
PORT=3001
NODE_ENV=development
DATABASE_PATH=./data/mineguard.db
CORS_ORIGIN=http://localhost:3000,file://
```

## Troubleshooting

### Database not found
```bash
npm run init-db
```

### Port already in use
Change PORT in `.env` to an available port (e.g., 3002)

### CORS errors
Update `CORS_ORIGIN` in `.env` to include your frontend URL

### Migration fails
Check that JSONBin credentials are correct in `.env`

## Performance Optimizations

✓ Database indexes on frequently queried columns  
✓ Foreign key constraints for data integrity  
✓ Prepared statements to prevent SQL injection  
✓ Connection pooling ready for scaling  

## Future Enhancements

- WebSocket support for true real-time updates
- Database migrations framework
- Caching layer (Redis)
- Advanced search and filtering
- Full-text search capabilities
- Data export/import functionality
- Audit logging

## Support

For issues or questions, check the main MineGuard documentation.
