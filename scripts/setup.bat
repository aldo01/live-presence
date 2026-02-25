@echo off
REM Live Presence - Development Environment Setup Script (Windows)
REM This script installs all required dependencies for local development

setlocal enabledelayedexpansion

cls
echo.
echo ============================================================
echo   Live Presence - Development Setup (Windows)
echo ============================================================
echo.

REM ==============================================================================
REM Java Setup
REM ==============================================================================

echo [1/4] Checking Java...
echo.

where java >nul 2>nul
if %ERRORLEVEL% == 0 (
    for /f "tokens=*" %%i in ('java -version 2^>^&1 ^| findstr /R "version"') do set JAVA_OUTPUT=%%i
    echo !JAVA_OUTPUT!
    
    echo !JAVA_OUTPUT! | findstr /I "21" >nul
    if %ERRORLEVEL% == 0 (
        echo [OK] Java 21 is installed
    ) else (
        echo [WARNING] Java is installed but it's not version 21
        echo Download Java 21 from: https://adoptium.net/ or https://www.oracle.com/java/technologies/downloads/
    )
) else (
    echo [ERROR] Java not found
    echo.
    echo Please install Java 21 from one of these sources:
    echo 1. Adoptium: https://adoptium.net/ (recommended, free, open-source)
    echo 2. Oracle: https://www.oracle.com/java/technologies/downloads/
    echo 3. Microsoft: https://www.microsoft.com/openjdk
    echo.
    echo After installation:
    echo - Restart this command prompt
    echo - Run "java -version" to verify
    echo - Re-run this setup script
    echo.
    pause
    goto end
)

echo.

REM ==============================================================================
REM Docker Check
REM ==============================================================================

echo [2/4] Checking Docker...
echo.

where docker >nul 2>nul
if %ERRORLEVEL% == 0 (
    for /f "tokens=*" %%i in ('docker --version 2^>^&1') do set DOCKER_OUTPUT=%%i
    echo [OK] !DOCKER_OUTPUT!
) else (
    echo [ERROR] Docker not found
    echo.
    echo Install Docker Desktop from: https://www.docker.com/products/docker-desktop
    echo.
    pause
    goto end
)

echo.

REM ==============================================================================
REM Docker Compose Check
REM ==============================================================================

echo [3/4] Checking Docker Compose...
echo.

where docker-compose >nul 2>nul
if %ERRORLEVEL% == 0 (
    for /f "tokens=*" %%i in ('docker-compose --version 2^>^&1') do set COMPOSE_OUTPUT=%%i
    echo [OK] !COMPOSE_OUTPUT!
) else (
    docker compose version >nul 2>nul
    if %ERRORLEVEL% == 0 (
        echo [OK] Docker Compose V2 is installed
    ) else (
        echo [ERROR] Docker Compose not found
        echo.
        echo Install Docker Desktop from: https://www.docker.com/products/docker-desktop
        echo.
        pause
        goto end
    )
)

echo.

REM ==============================================================================
REM Node.js Check (Optional)
REM ==============================================================================

echo [4/4] Checking Node.js (optional for frontend)...
echo.

where node >nul 2>nul
if %ERRORLEVEL% == 0 (
    for /f "tokens=*" %%i in ('node --version 2^>^&1') do set NODE_OUTPUT=%%i
    echo [OK] Node.js !NODE_OUTPUT! is installed
) else (
    echo [OPTIONAL] Node.js not found
    echo Install from: https://nodejs.org/ (LTS recommended)
)

echo.

REM ==============================================================================
REM Summary & Next Steps
REM ==============================================================================

cls
echo.
echo ============================================================
echo   Setup Complete!
echo ============================================================
echo.
echo Next Steps:
echo -----------
echo.
echo 1. Start the local development stack:
echo    .\scripts\start-local.bat
echo.
echo 2. In another terminal, run the backend:
echo    cd backend
echo    .\gradlew bootRun
echo.
echo 3. In another terminal (if Node.js installed), start frontend:
echo    cd frontend
echo    npm install
echo    npm run dev
echo.
echo Access points:
echo ---------------
echo Frontend:        http://localhost:3000
echo Backend API:     http://localhost:8080
echo Health Check:    http://localhost:8080/actuator/health
echo.
echo Documentation:
echo ----------------
echo Java Setup:      .\JAVA_SETUP.md
echo Full Guide:      .\LOCAL_DEVELOPMENT.md
echo Quick Reference: .\QUICKSTART.md
echo.
echo Troubleshooting:
echo -----------------
echo If Java is not found after installation:
echo   1. Restart this command prompt
echo   2. Open System Properties ^> Environment Variables
echo   3. Add JAVA_HOME pointing to your Java 21 installation
echo   4. Add JAVA_HOME\bin to PATH
echo   5. Restart command prompt and re-run this script
echo.

pause
goto end

:end
REM End of script
