@echo off
echo ============================================
echo Inserting Dummy Data into Live Presence DB
echo ============================================
echo.

echo Checking if PostgreSQL container is running...
docker ps | findstr live-presence-postgres >nul
if errorlevel 1 (
    echo ERROR: PostgreSQL container is not running!
    echo Starting containers...
    docker-compose -f docker-compose.local.yml up -d postgres
    timeout /t 5 >nul
)

echo.
echo Inserting dummy data...
docker exec -i live-presence-postgres psql -U postgres -d livepresence < insert_dummy_data.sql

echo.
echo ============================================
echo Done! Check the output above for summary.
echo ============================================
echo.
echo You can now:
echo 1. Open http://localhost:3000 in your browser
echo 2. Login with user09@gmail.com / 123456
echo 3. Click "Go Live" to see nearby users on the map
echo 4. Switch to Feed view to see posts
echo.
pause
