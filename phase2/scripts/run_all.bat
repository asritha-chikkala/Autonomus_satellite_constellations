@echo off
title Autonomous Satellite Constellation Launcher
echo =================================================================
echo   LAUNCHING AUTONOMOUS SATELLITE CONSTELLATION MISSION CONTROL
echo =================================================================

:: Switch working directory to the project root
cd /d "%~dp0.."

echo [1/4] Running system verification check...
python scripts\verify_system.py

echo.
echo [2/4] Ensuring ports 8000 and 3000 are clean...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8000') do taskkill /f /pid %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000') do taskkill /f /pid %%a >nul 2>&1

echo.
echo [3/4] Starting FastAPI + AI Backend on http://localhost:8000 ...
start "Satellite Backend (Port 8000)" cmd /k python scripts\start_backend.py

echo.
echo [4/4] Starting Next.js WebGL Frontend on http://localhost:3000 ...
start "Satellite Frontend (Port 3000)" cmd /k "cd frontend && npm run dev"

echo.
echo =================================================================
echo   Backend and Frontend services launched in separate windows!
echo   IMPORTANT: Keep those two command windows open while running.
echo =================================================================
echo.
echo Waiting for Next.js Frontend server to be ready on port 3000...
set count=0
:wait_frontend
set /a count+=1
timeout /t 1 /nobreak >nul
netstat -an | findstr ":3000 " | findstr "LISTENING" >nul
if not errorlevel 1 goto frontend_ready
if %count% geq 35 goto frontend_timeout
echo   Waiting... (%count%s)
goto wait_frontend

:frontend_ready
echo.
echo [OK] Next.js frontend is listening on port 3000!
echo Opening Mission Control Dashboard in your browser...
echo   Primary:  http://localhost:3000
echo   Fallback: http://127.0.0.1:3000
echo   Backend:  http://localhost:8000
timeout /t 2 /nobreak >nul
start http://localhost:3000
echo.
echo System is running. Press any key to stop this launcher window (services will stay open).
pause
exit /b 0

:frontend_timeout
echo.
echo [WARNING] Frontend took longer than expected to bind to port 3000.
echo Opening browser anyway: http://localhost:3000
echo If you see "localhost refused to connect", please wait a few seconds and press F5 to refresh.
echo Also check the "Satellite Frontend" window to verify npm output.
start http://localhost:3000
pause

