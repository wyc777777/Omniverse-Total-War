# ========================================
# Wan Jie Total War - Launcher
# ========================================

$ErrorActionPreference = "Stop"

# Get script directory
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   Wan Jie Total War - Starting..." -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# ========================================
# Step 1: Find Node.js
# ========================================
Write-Host "[1/3] Checking Node.js..." -ForegroundColor Yellow

$nodePath = $null
$npmPath = $null

# Check system Node first
try {
    $null = Get-Command node -ErrorAction Stop
    $nodePath = "node"
    $npmPath = "npm"
    Write-Host "      OK: System Node.js found" -ForegroundColor Green
} catch {
    $portableNode = Join-Path $scriptDir "node-portable\node.exe"
    $portableNpm = Join-Path $scriptDir "node-portable\npm.cmd"
    
    if (Test-Path $portableNode) {
        $nodePath = $portableNode
        $npmPath = $portableNpm
        Write-Host "      OK: Using portable Node.js" -ForegroundColor Green
    } else {
        Write-Host ""
        Write-Host "  ERROR: Node.js not found!" -ForegroundColor Red
        Write-Host "  Install Node.js: https://nodejs.org" -ForegroundColor Red
        Write-Host "  Or make sure node-portable folder exists" -ForegroundColor Red
        Write-Host ""
        Read-Host "Press Enter to exit"
        exit 1
    }
}

# ========================================
# Step 2: Check dependencies
# ========================================
Write-Host ""
Write-Host "[2/3] Checking dependencies..." -ForegroundColor Yellow

$expressPath = Join-Path $scriptDir "node_modules\express\index.js"
$corsPath = Join-Path $scriptDir "node_modules\cors\lib\index.js"

if ((Test-Path $expressPath) -and (Test-Path $corsPath)) {
    Write-Host "      OK: Dependencies ready" -ForegroundColor Green
} else {
    Write-Host "      First run, installing dependencies..." -ForegroundColor Yellow
    
    $lastExit = 0
    if ($npmPath -eq "npm") {
        # 系统环境下的 npm 直接运行
        npm install --no-audit --no-fund
        $lastExit = $LASTEXITCODE
    } else {
        # 便携版使用 Start-Process 调用 cmd.exe
        $installProc = Start-Process -FilePath "cmd.exe" -ArgumentList "/c", "`"$npmPath`"", "install", "--no-audit", "--no-fund" -Wait -PassThru -NoNewWindow
        $lastExit = $installProc.ExitCode
    }
    
    if ($lastExit -ne 0) {
        Write-Host ""
        Write-Host "  ERROR: Failed to install dependencies!" -ForegroundColor Red
        Write-Host "  Please check your internet connection." -ForegroundColor Red
        Write-Host ""
        Read-Host "Press Enter to exit"
        exit 1
    }
    Write-Host "      OK: Dependencies installed" -ForegroundColor Green
}

# ========================================
# Step 3: Check port and start server
# ========================================
Write-Host ""
Write-Host "[3/3] Starting game server..." -ForegroundColor Yellow

$port = 3456

try {
    $portInUse = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue | Where-Object { $_.State -eq "Listen" }
    
    if ($portInUse) {
        Write-Host "      WARN: Port $port is in use, releasing..." -ForegroundColor Yellow
        foreach ($conn in $portInUse) {
            try {
                Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
            } catch {}
        }
        Start-Sleep -Seconds 1
        Write-Host "      OK: Port released" -ForegroundColor Green
    } else {
        Write-Host "      OK: Port available" -ForegroundColor Green
    }
} catch {
    Write-Host "      OK: Port check done" -ForegroundColor Green
}

# ========================================
# Start success message
# ========================================
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "   Server started!" -ForegroundColor Green
Write-Host "   URL: http://localhost:$port/start.html" -ForegroundColor White
Write-Host "   Close this window to stop server" -ForegroundColor Gray
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

# Open browser
try {
    Start-Process "http://localhost:$port/start.html"
} catch {}

# Start server
$serverPath = Join-Path $scriptDir "server.js"
& $nodePath $serverPath

# If server exits
Write-Host ""
Write-Host "  ERROR: Server stopped" -ForegroundColor Red
Write-Host "  Please screenshot the error above" -ForegroundColor Red
Write-Host ""
Read-Host "Press Enter to exit"
