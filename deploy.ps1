# Quick deploy script for serenidad.app ESP32-S2 portal (Windows PowerShell)
# This script uploads filesystem and firmware in one go

Write-Host "=== serenidad.app Deployment Script ===" -ForegroundColor Cyan
Write-Host ""

# Check if PlatformIO is installed
try {
    $null = Get-Command pio -ErrorAction Stop
} catch {
    Write-Host "❌ PlatformIO not found!" -ForegroundColor Red
    Write-Host "Install it with: pip install platformio" -ForegroundColor Yellow
    exit 1
}

# Check if data directory exists and has files
if (-not (Test-Path "data\index.html")) {
    Write-Host "❌ data\ directory not found or missing index.html" -ForegroundColor Red
    Write-Host "Make sure you're in the project root directory" -ForegroundColor Yellow
    exit 1
}

Write-Host "📦 Step 1: Uploading filesystem (web files)..." -ForegroundColor Yellow
pio run -t uploadfs

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Filesystem upload failed!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "✅ Filesystem uploaded successfully" -ForegroundColor Green
Write-Host ""
Write-Host "⏳ Waiting 2 seconds before firmware upload..." -ForegroundColor Yellow
Start-Sleep -Seconds 2

Write-Host ""
Write-Host "💾 Step 2: Uploading firmware..." -ForegroundColor Yellow
pio run -t upload

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Firmware upload failed!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "✅ Firmware uploaded successfully" -ForegroundColor Green
Write-Host ""
Write-Host "🎉 Deployment complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Unplug from laptop"
Write-Host "2. Power via USB power bank or adapter"
Write-Host "3. Connect to WiFi: serenidad.app"
Write-Host "4. Visit: http://192.168.4.1"
Write-Host ""
Write-Host "To view logs: http://192.168.4.1/admin/logs?key=SERENIDADKEY" -ForegroundColor Cyan
Write-Host ""
Write-Host "To monitor serial output: pio device monitor" -ForegroundColor Cyan
