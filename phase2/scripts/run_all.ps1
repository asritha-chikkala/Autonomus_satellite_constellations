# PowerShell Script to Launch Full Autonomous Satellite Constellation System
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "  LAUNCHING AUTONOMOUS SATELLITE MISSION CONTROL SYSTEM" -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan

$baseDir = Split-Path -Parent $PSScriptRoot

# 1. Run Verification
Write-Host "`n[1/4] Running system verification..." -ForegroundColor Yellow
python "$baseDir\scripts\verify_system.py"

# 2. Clear any lingering processes on ports 8000 & 3000
Write-Host "`n[2/4] Ensuring ports 8000 and 3000 are free..." -ForegroundColor Yellow
$p8000 = (Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue).OwningProcess | Select-Object -Unique
if ($p8000) { Stop-Process -Id $p8000 -Force -ErrorAction SilentlyContinue }
$p3000 = (Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue).OwningProcess | Select-Object -Unique
if ($p3000) { Stop-Process -Id $p3000 -Force -ErrorAction SilentlyContinue }
Start-Sleep -Seconds 1

# 3. Launch Backend
Write-Host "`n[3/4] Launching FastAPI Backend on http://localhost:8000 ..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "python `"$baseDir\scripts\start_backend.py`""

# 4. Launch Frontend
Write-Host "`n[4/4] Launching Next.js Frontend on http://localhost:3000 ..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd `"$baseDir\frontend`"; npm run dev"

Write-Host "`n=================================================================" -ForegroundColor Green
Write-Host "  System online! Open browser to: http://localhost:3000" -ForegroundColor Green
Write-Host "=================================================================" -ForegroundColor Green
