# WatchGuard Windows PowerShell Setup Script
# Run as Administrator

Write-Host @"

╔════════════════════════════════════════════════════════════╗
║     WATCHGUARD - Windows Development Setup Script          ║
╚════════════════════════════════════════════════════════════╝

"@ -ForegroundColor Cyan

# Check if running as admin
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "⚠ Please run this script as Administrator" -ForegroundColor Yellow
    exit 1
}

# Function to check if command exists
function Test-Command($command) {
    try {
        Get-Command $command -ErrorAction Stop
        return $true
    } catch {
        return $false
    }
}

# Check Node.js
Write-Host "`n[1/6] Checking Node.js..." -ForegroundColor Yellow
if (Test-Command "node") {
    $nodeVersion = node --version
    Write-Host "  ✓ Node.js $nodeVersion installed" -ForegroundColor Green
} else {
    Write-Host "  ✗ Node.js not found. Please install from https://nodejs.org/" -ForegroundColor Red
    exit 1
}

# Check Python
Write-Host "`n[2/6] Checking Python..." -ForegroundColor Yellow
if (Test-Command "python") {
    $pythonVersion = python --version 2>&1
    Write-Host "  ✓ $pythonVersion installed" -ForegroundColor Green
} else {
    Write-Host "  ✗ Python not found. Please install from https://python.org/" -ForegroundColor Red
    exit 1
}

# Check PostgreSQL
Write-Host "`n[3/6] Checking PostgreSQL..." -ForegroundColor Yellow
if (Test-Command "psql") {
    Write-Host "  ✓ PostgreSQL installed" -ForegroundColor Green
} else {
    Write-Host "  ⚠ PostgreSQL not found in PATH. Make sure it's installed." -ForegroundColor Yellow
}

# Install frontend dependencies
Write-Host "`n[4/6] Installing frontend dependencies..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✓ Frontend dependencies installed" -ForegroundColor Green
} else {
    Write-Host "  ✗ Failed to install frontend dependencies" -ForegroundColor Red
}

# Install backend dependencies
Write-Host "`n[5/6] Installing backend dependencies..." -ForegroundColor Yellow
Push-Location backend
npm install
if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✓ Backend dependencies installed" -ForegroundColor Green
} else {
    Write-Host "  ✗ Failed to install backend dependencies" -ForegroundColor Red
}
Pop-Location

# Install biometrics dependencies
Write-Host "`n[6/6] Installing biometrics dependencies..." -ForegroundColor Yellow
Push-Location backend/biometrics_service
pip install -r requirements.txt
if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✓ Biometrics dependencies installed" -ForegroundColor Green
} else {
    Write-Host "  ✗ Failed to install biometrics dependencies" -ForegroundColor Red
}
Pop-Location

# Create .env files if not exist
Write-Host "`n[Setup] Creating configuration files..." -ForegroundColor Yellow

if (-not (Test-Path "backend/.env")) {
    Copy-Item "backend/.env.example" "backend/.env"
    Write-Host "  ✓ Created backend/.env" -ForegroundColor Green
}

if (-not (Test-Path "backend/biometrics_service/.env")) {
    Copy-Item "backend/biometrics_service/.env.example" "backend/biometrics_service/.env"
    Write-Host "  ✓ Created biometrics_service/.env" -ForegroundColor Green
}

# Create models directory
$modelsDir = "backend/biometrics_service/models"
if (-not (Test-Path $modelsDir)) {
    New-Item -ItemType Directory -Path $modelsDir -Force | Out-Null
    Write-Host "  ✓ Created models directory" -ForegroundColor Green
}

# Create uploads directory
$uploadsDir = "backend/uploads/logos"
if (-not (Test-Path $uploadsDir)) {
    New-Item -ItemType Directory -Path $uploadsDir -Force | Out-Null
    Write-Host "  ✓ Created uploads directory" -ForegroundColor Green
}

Write-Host @"

╔════════════════════════════════════════════════════════════╗
║                    SETUP COMPLETE!                         ║
╠════════════════════════════════════════════════════════════╣
║                                                            ║
║  Next steps:                                               ║
║                                                            ║
║  1. Configure backend/.env with your database credentials  ║
║                                                            ║
║  2. Download biometric models to:                          ║
║     backend/biometrics_service/models/                     ║
║     - yunet_n_640_640.onnx                                 ║
║     - w600k_r50.onnx                                       ║
║                                                            ║
║  3. Run database migrations:                               ║
║     cd backend && npm run migrate && npm run seed          ║
║                                                            ║
║  4. Start all services:                                    ║
║     .\scripts\start_dev_all.ps1                            ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝

"@ -ForegroundColor Cyan
