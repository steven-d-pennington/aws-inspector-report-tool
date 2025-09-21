# Docker Setup Validation Script
# This script validates that Docker is properly configured and ready

Write-Host "=== Docker Setup Validation ===" -ForegroundColor Green

# Check if Docker is installed
Write-Host "`n1. Checking Docker installation..." -ForegroundColor Yellow
try {
    $dockerVersion = docker version --format "{{.Client.Version}}" 2>$null
    if ($dockerVersion) {
        Write-Host "✅ Docker Client installed: $dockerVersion" -ForegroundColor Green
    } else {
        Write-Host "❌ Docker not found in PATH" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ Docker not installed or not in PATH" -ForegroundColor Red
    exit 1
}

# Check if Docker daemon is running
Write-Host "`n2. Checking Docker daemon..." -ForegroundColor Yellow
try {
    $dockerInfo = docker info --format "{{.ServerVersion}}" 2>$null
    if ($dockerInfo) {
        Write-Host "✅ Docker daemon running: $dockerInfo" -ForegroundColor Green
    } else {
        Write-Host "❌ Docker daemon not running" -ForegroundColor Red
        Write-Host "   Please start Docker Desktop:" -ForegroundColor Yellow
        Write-Host "   - Open Docker Desktop application" -ForegroundColor Yellow
        Write-Host "   - Wait for it to fully start (whale icon in system tray)" -ForegroundColor Yellow
        Write-Host "   - Then run this script again" -ForegroundColor Yellow
        exit 1
    }
} catch {
    Write-Host "❌ Cannot connect to Docker daemon" -ForegroundColor Red
    Write-Host "   Please start Docker Desktop first" -ForegroundColor Yellow
    exit 1
}

# Check Docker Compose
Write-Host "`n3. Checking Docker Compose..." -ForegroundColor Yellow
try {
    $composeVersion = docker compose version --short 2>$null
    if ($composeVersion) {
        Write-Host "✅ Docker Compose available: $composeVersion" -ForegroundColor Green
    } else {
        Write-Host "❌ Docker Compose not available" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ Docker Compose not available" -ForegroundColor Red
    exit 1
}

# Validate compose configuration
Write-Host "`n4. Validating Docker Compose configuration..." -ForegroundColor Yellow
try {
    $configTest = docker compose config 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Docker Compose configuration valid" -ForegroundColor Green
    } else {
        Write-Host "❌ Docker Compose configuration has errors" -ForegroundColor Red
        docker compose config
        exit 1
    }
} catch {
    Write-Host "❌ Failed to validate Docker Compose configuration" -ForegroundColor Red
    exit 1
}

# Check .env file
Write-Host "`n5. Checking environment configuration..." -ForegroundColor Yellow
if (Test-Path ".env") {
    Write-Host "✅ .env file found" -ForegroundColor Green

    # Check for required variables
    $envContent = Get-Content ".env" -Raw
    $requiredVars = @("DB_PASSWORD", "NODE_ENV", "PORT")

    foreach ($var in $requiredVars) {
        if ($envContent -match "$var=.+") {
            Write-Host "✅ $var is set" -ForegroundColor Green
        } else {
            Write-Host "⚠️  $var not found in .env" -ForegroundColor Yellow
        }
    }
} else {
    Write-Host "⚠️  .env file not found" -ForegroundColor Yellow
    Write-Host "   Run: cp .env.example .env" -ForegroundColor Yellow
}

# Check available disk space
Write-Host "`n6. Checking disk space..." -ForegroundColor Yellow
try {
    $disk = Get-WmiObject -Class Win32_LogicalDisk -Filter "DeviceID='C:'"
    $freeGB = [math]::Round($disk.FreeSpace / 1GB, 2)

    if ($freeGB -gt 10) {
        Write-Host "✅ Available disk space: $freeGB GB" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Low disk space: $freeGB GB" -ForegroundColor Yellow
        Write-Host "   Recommend at least 10GB free for Docker operations" -ForegroundColor Yellow
    }
} catch {
    Write-Host "⚠️  Could not check disk space" -ForegroundColor Yellow
}

Write-Host "`n=== Validation Complete ===" -ForegroundColor Green

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n🚀 Ready to start containers!" -ForegroundColor Green
    Write-Host "`nNext steps:" -ForegroundColor Yellow
    Write-Host "1. docker compose -f docker-compose.yml -f docker-compose.dev.yml up" -ForegroundColor Cyan
    Write-Host "2. Wait for services to start (may take 2-3 minutes first time)" -ForegroundColor Cyan
    Write-Host "3. Open http://localhost:3000" -ForegroundColor Cyan
} else {
    Write-Host "`n❌ Issues found - please resolve before starting containers" -ForegroundColor Red
}