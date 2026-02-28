#!/usr/bin/env pwsh
# Sub2API Development Environment Setup Script for Windows
# This script installs all required development tools using Scoop

$ErrorActionPreference = "Stop"

Write-Host "🚀 Sub2API Development Environment Setup" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# Check if running on Windows
if (-not $IsWindows -and -not ($PSVersionTable.PSVersion.Major -le 5)) {
    Write-Host "❌ This script is designed for Windows. For Linux/macOS, please use the shell script." -ForegroundColor Red
    exit 1
}

# Function to check if a command exists
function Test-CommandExists {
    param($command)
    $null -ne (Get-Command $command -ErrorAction SilentlyContinue)
}

# Step 1: Install Scoop if not already installed
Write-Host "📦 Checking Scoop package manager..." -ForegroundColor Yellow
if (-not (Test-CommandExists scoop)) {
    Write-Host "Installing Scoop..." -ForegroundColor Green
    try {
        Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser -Force
        Invoke-RestMethod -Uri https://get.scoop.sh | Invoke-Expression
        Write-Host "✅ Scoop installed successfully" -ForegroundColor Green
    } catch {
        Write-Host "❌ Failed to install Scoop: $_" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "✅ Scoop already installed" -ForegroundColor Green
}

# Refresh environment
$env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")

# Step 2: Install Git (required for Scoop buckets)
Write-Host ""
Write-Host "🔧 Checking Git..." -ForegroundColor Yellow
if (-not (Test-CommandExists git)) {
    Write-Host "Installing Git..." -ForegroundColor Green
    scoop install git
    Write-Host "✅ Git installed successfully" -ForegroundColor Green
} else {
    Write-Host "✅ Git already installed" -ForegroundColor Green
}

# Step 3: Add required Scoop buckets
Write-Host ""
Write-Host "📚 Adding Scoop buckets..." -ForegroundColor Yellow
$buckets = @("main", "extras")
foreach ($bucket in $buckets) {
    $bucketList = scoop bucket list
    if ($bucketList -notmatch $bucket) {
        Write-Host "Adding bucket: $bucket" -ForegroundColor Green
        scoop bucket add $bucket
    } else {
        Write-Host "✅ Bucket '$bucket' already added" -ForegroundColor Green
    }
}

# Step 4: Install Just
Write-Host ""
Write-Host "⚙️  Checking Just (task runner)..." -ForegroundColor Yellow
if (-not (Test-CommandExists just)) {
    Write-Host "Installing Just..." -ForegroundColor Green
    scoop install just
    Write-Host "✅ Just installed successfully" -ForegroundColor Green
} else {
    Write-Host "✅ Just already installed" -ForegroundColor Green
}

# Step 5: Install Pixi
Write-Host ""
Write-Host "🐍 Checking Pixi (package manager)..." -ForegroundColor Yellow
if (-not (Test-CommandExists pixi)) {
    Write-Host "Installing Pixi..." -ForegroundColor Green
    scoop install pixi
    Write-Host "✅ Pixi installed successfully" -ForegroundColor Green
} else {
    Write-Host "✅ Pixi already installed" -ForegroundColor Green
}

# Step 6: Install Rust (for rust-script)
Write-Host ""
Write-Host "🦀 Checking Rust..." -ForegroundColor Yellow
if (-not (Test-CommandExists rustc)) {
    Write-Host "Installing Rust..." -ForegroundColor Green
    scoop install rustup
    Write-Host "Installing default Rust toolchain..." -ForegroundColor Green
    rustup default stable
    Write-Host "✅ Rust installed successfully" -ForegroundColor Green
} else {
    Write-Host "✅ Rust already installed" -ForegroundColor Green
}

# Step 7: Install rust-script
Write-Host ""
Write-Host "📜 Checking rust-script..." -ForegroundColor Yellow
if (-not (Test-CommandExists rust-script)) {
    Write-Host "Installing rust-script via cargo..." -ForegroundColor Green
    cargo install rust-script
    Write-Host "✅ rust-script installed successfully" -ForegroundColor Green
} else {
    Write-Host "✅ rust-script already installed" -ForegroundColor Green
}

# Step 8: Install PostgreSQL (optional, for local development)
Write-Host ""
Write-Host "🐘 Checking PostgreSQL..." -ForegroundColor Yellow
if (-not (Test-CommandExists psql)) {
    Write-Host "PostgreSQL not found. Install? (Y/n): " -NoNewline -ForegroundColor Cyan
    $installPg = Read-Host
    if ($installPg -eq "" -or $installPg -eq "Y" -or $installPg -eq "y") {
        Write-Host "Installing PostgreSQL..." -ForegroundColor Green
        scoop install postgresql
        Write-Host "✅ PostgreSQL installed successfully" -ForegroundColor Green
    } else {
        Write-Host "⏭️  Skipping PostgreSQL installation" -ForegroundColor Yellow
    }
} else {
    Write-Host "✅ PostgreSQL already installed" -ForegroundColor Green
}

# Step 9: Install Redis (optional, for local development)
Write-Host ""
Write-Host "🔴 Checking Redis..." -ForegroundColor Yellow
if (-not (Test-CommandExists redis-server)) {
    Write-Host "Redis not found. Install? (Y/n): " -NoNewline -ForegroundColor Cyan
    $installRedis = Read-Host
    if ($installRedis -eq "" -or $installRedis -eq "Y" -or $installRedis -eq "y") {
        Write-Host "Installing Redis..." -ForegroundColor Green
        scoop install redis
        Write-Host "✅ Redis installed successfully" -ForegroundColor Green
    } else {
        Write-Host "⏭️  Skipping Redis installation" -ForegroundColor Yellow
    }
} else {
    Write-Host "✅ Redis already installed" -ForegroundColor Green
}

# Step 10: Setup Pixi environment
Write-Host ""
Write-Host "🔧 Setting up Pixi environment..." -ForegroundColor Yellow
if (Test-Path "pixi.toml") {
    Write-Host "Installing Pixi dependencies..." -ForegroundColor Green
    pixi install
    Write-Host "✅ Pixi environment ready" -ForegroundColor Green
} else {
    Write-Host "⚠️  pixi.toml not found, skipping Pixi setup" -ForegroundColor Yellow
}

# Summary
Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "✅ Setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Installed tools:" -ForegroundColor Cyan
Write-Host "  • Scoop   - Package manager" -ForegroundColor White
Write-Host "  • Just    - Task runner" -ForegroundColor White
Write-Host "  • Pixi    - Project package manager" -ForegroundColor White
Write-Host "  • Rust    - Rust toolchain" -ForegroundColor White
Write-Host "  • rust-script - Rust script runner" -ForegroundColor White
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Run 'just' to see available commands" -ForegroundColor White
Write-Host "  2. Run 'just db-init' to initialize the database" -ForegroundColor White
Write-Host "  3. Run 'just db-install' to setup schema" -ForegroundColor White
Write-Host "  4. Run 'just dev-vue' or 'just dev-react' to start development" -ForegroundColor White
Write-Host ""
