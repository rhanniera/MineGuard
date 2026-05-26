<!-- MineGuard Frontend - Updated for SQL Backend -->
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MineGuard - Workplace Hazard Reporting System</title>
    <link rel="stylesheet" href="styles.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
</head>
<body>
    <!-- Your existing HTML content goes here -->

    <!-- Configure SQL API Backend (add this before scripts) -->
    <script>
        // Set API URL before loading integration module
        // Default: http://localhost:3001/api
        window.MINEGUARD_API_URL = 'http://localhost:3001/api';
    </script>

    <!-- NEW: SQL API Integration Module (required!) -->
    <script src="sql-api-integration.js"></script>

    <!-- Existing application script -->
    <script src="script.js"></script>

    <!-- Optional: Initialize app on startup -->
    <script>
        document.addEventListener('DOMContentLoaded', function() {
            console.log('MineGuard loading with SQL backend');
            console.log('API URL:', getApiUrl());
            
            // Check API health on startup
            checkSqlApiHealth().catch(error => {
                console.warn('SQL API not available, will use localStorage fallback');
            });

            // Initialize app (this function is defined in script.js)
            initializeApp();
        });
    </script>
</body>
</html>
