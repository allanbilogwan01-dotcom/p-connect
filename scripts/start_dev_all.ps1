# WatchGuard Development Startup Script
# Starts all services for local development

Write-Host @"

╔════════════════════════════════════════════════════════════╗
║     WATCHGUARD - Starting Development Environment          ║
╚════════════════════════════════════════════════════════════╝

"@ -ForegroundColor Cyan

$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptPath

# Function to start a service in a new window
function Start-Service {
    param(
        [string]$Name,
        [string]$Command,
        [string]$WorkingDir
    )
    
    $fullPath = Join-Path $projectRoot $WorkingDir
    
    Write-Host "Starting $Name..." -ForegroundColor Yellow
    
    Start-Process powershell -ArgumentList @(
        "-NoExit",
        "-Command",
        "Set-Location '$fullPath'; Write-Host 'Starting $Name...' -ForegroundColor Cyan; $Command"
    ) -WindowStyle Normal
    
    Start-Sleep -Seconds 2
}

# Start Biometrics Service
Start-Service -Name "Biometrics Service" -Command "python main.py" -WorkingDir "backend/biometrics_service"

# Start Backend API
Start-Service -Name "Backend API" -Command "npm run dev" -WorkingDir "backend"

# Start Frontend
Start-Service -Name "Frontend" -Command "npm run dev" -WorkingDir "."

# Wait for services to start
Write-Host "`nWaiting for services to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# Health checks
Write-Host "`nRunning health checks..." -ForegroundColor Yellow

# Check biometrics
try {
    $bioHealth = Invoke-RestMethod -Uri "http://localhost:8000/health" -Method Get -TimeoutSec 5
    if ($bioHealth.ok) {
        Write-Host "  ✓ Biometrics Service: HEALTHY" -ForegroundColor Green
    } else {
        Write-Host "  ⚠ Biometrics Service: DEGRADED" -ForegroundColor Yellow
    }
} catch {
    Write-Host "  ✗ Biometrics Service: NOT RESPONDING" -ForegroundColor Red
}

# Check backend
try {
    $apiHealth = Invoke-RestMethod -Uri "http://localhost:3001/api/health" -Method Get -TimeoutSec 5
    if ($apiHealth.status -eq "ok") {
        Write-Host "  ✓ Backend API: HEALTHY" -ForegroundColor Green
    } else {
        Write-Host "  ⚠ Backend API: DEGRADED" -ForegroundColor Yellow
    }
} catch {
    Write-Host "  ✗ Backend API: NOT RESPONDING" -ForegroundColor Red
}

Write-Host @"

╔════════════════════════════════════════════════════════════╗
║                    ALL SERVICES STARTED                    ║
╠════════════════════════════════════════════════════════════╣
║                                                            ║
║  Frontend:    http://localhost:5173                        ║
║  Backend:     http://localhost:3001                        ║
║  Biometrics:  http://localhost:8000                        ║
║  API Docs:    http://localhost:8000/docs                   ║
║                                                            ║
║  Default Login:                                            ║
║    Username: admin                                         ║
║    Password: admin123                                      ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝

"@ -ForegroundColor Green

# Open browser
$openBrowser = Read-Host "Open browser to frontend? (Y/n)"
if ($openBrowser -ne "n" -and $openBrowser -ne "N") {
    Start-Process "http://localhost:5173"
}
