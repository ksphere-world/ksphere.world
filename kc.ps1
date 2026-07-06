# =========================================================
# Kindness Chain - Full-Stack Code & Backend Context Generator
# =========================================================

$frontendPath = "C:\Users\iamri\KC"
$backendPath  = "C:\Users\iamri\kspherebackends"
$outputDir    = "C:\Users\iamri\Generator"

$timestamp  = Get-Date -Format "yyyyMMdd_HHmmss"
$outputFile = Join-Path $outputDir "KC_fullstack_$timestamp.txt"

# 1. Ensure missing directories exist
if (-not (Test-Path $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir | Out-Null
    Write-Host "📂 Created generator directory: $outputDir" -ForegroundColor Yellow
}

if (-not (Test-Path $backendPath)) {
    New-Item -ItemType Directory -Path $backendPath | Out-Null
    Write-Host "📂 Created backend directory: $backendPath" -ForegroundColor Yellow
}

# Track if Docker Desktop was opened by this script
$startedDockerByScript = $false

# Helper function to check if Docker daemon is responsive
function Test-DockerRunning {
    try {
        $null = docker info 2>&1
        return $LASTEXITCODE -eq 0
    } catch {
        return $false
    }
}

# 2. Check & Auto-Start Docker Desktop if needed
if (-not (Test-DockerRunning)) {
    Write-Host "🐳 Docker is not running. Starting Docker Desktop..." -ForegroundColor Yellow
    $dockerExe = "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    
    if (Test-Path $dockerExe) {
        Start-Process $dockerExe
        $startedDockerByScript = $true
        
        Write-Host "⏳ Waiting for Docker engine to start..." -ForegroundColor Yellow
        $timeout = 60
        $elapsed = 0
        while (-not (Test-DockerRunning) -and ($elapsed -lt $timeout)) {
            Start-Sleep -Seconds 3
            $elapsed += 3
            Write-Host "   Waiting... ($elapsed/$timeout seconds)" -ForegroundColor Gray
        }
        
        if (Test-DockerRunning) {
            Write-Host "✅ Docker engine is live!" -ForegroundColor Green
        } else {
            Write-Host "⚠️ Docker timed out starting. Proceeding with file scan..." -ForegroundColor Red
        }
    } else {
        Write-Host "⚠️ Could not find Docker Desktop at: $dockerExe" -ForegroundColor Red
    }
} else {
    Write-Host "✅ Docker is already running." -ForegroundColor Green
}

# 3. Initialize and Start Supabase in Backend Directory
Set-Location -Path $backendPath

$supabaseCli = Get-Command supabase -ErrorAction SilentlyContinue

if ($supabaseCli) {
    # Check if supabase config exists, if not initialize
    if (-not (Test-Path (Join-Path $backendPath "supabase\config.toml"))) {
        Write-Host "⚡ Initializing Supabase in $backendPath..." -ForegroundColor Yellow
        supabase init
    }

    if (Test-DockerRunning) {
        Write-Host "🚀 Starting local Supabase containers..." -ForegroundColor Yellow
        supabase start
    }
} else {
    Write-Host "⚠️ Supabase CLI not found in system PATH. Skipping 'supabase start'." -ForegroundColor Red
}

# 4. Define valid extensions (Added .sql, .ts, .tsx, .toml for backend/Supabase)
$validExtensions = @('.js', '.jsx', '.ts', '.tsx', '.css', '.json', '.html', '.yml', '.yaml', '.md', '.sql', '.toml')

# Helper function to recursively collect files
function Get-ProjectCodeFiles($basePath, $prefixName) {
    if (-not (Test-Path $basePath)) { return @() }
    
    Get-ChildItem -Path $basePath -Recurse -File | Where-Object {
        $isValidExt       = $validExtensions -contains $_.Extension
        $isNotNodeModules = $_.FullName -notmatch '\\node_modules\\'
        $isNotGit         = $_.FullName -notmatch '\\\.git\\'
        $isNotTemp        = $_.FullName -notmatch '\\\.supabase\\\.temp\\'
        $isNotDist        = $_.FullName -notmatch '\\dist\\'
        $isNotLock        = $_.Name -ne 'package-lock.json' -and $_.Name -ne 'pnpm-lock.yaml'
        $isNotEnv         = $_.Name -ne '.env' -and $_.Name -ne '.env.local'
        
        $isValidExt -and $isNotNodeModules -and $isNotGit -and $isNotTemp -and $isNotDist -and $isNotLock -and $isNotEnv
    } | ForEach-Object {
        $relPath = $_.FullName.Substring($basePath.Length + 1)
        [PSCustomObject]@{
            DisplayPath = "$prefixName\$relPath"
            FullPath    = $_.FullName
        }
    }
}

Write-Host "🔍 Scanning Frontend & Backend files..." -ForegroundColor Yellow
$allFiles = @()
$allFiles += Get-ProjectCodeFiles -basePath $frontendPath -prefixName "KC_frontend"
$allFiles += Get-ProjectFiles -basePath $backendPath -prefixName "kspherebackends"

# 5. Build Final Code Output Text
$outputContent = [System.Text.StringBuilder]::new()
[void]$outputContent.AppendLine("=== KINDNESS CHAIN - FULLSTACK CODE & BACKEND CONTEXT ===")
[void]$outputContent.AppendLine("Generated on: $(Get-Date)`n")

foreach ($fileItem in $allFiles) {
    [void]$outputContent.AppendLine("--------------------------------------------------")
    [void]$outputContent.AppendLine("FILE: $($fileItem.DisplayPath)")
    [void]$outputContent.AppendLine("--------------------------------------------------")
    
    $fileText = Get-Content $fileItem.FullPath -Raw
    [void]$outputContent.AppendLine($fileText)
    [void]$outputContent.AppendLine()
}

$finalText = $outputContent.ToString()

# 6. Stop Supabase Stack
if ($supabaseCli -and (Test-DockerRunning)) {
    Write-Host "🛑 Stopping Supabase containers..." -ForegroundColor Yellow
    supabase stop
}

# 7. Close Docker Desktop if it was opened by this script
if ($startedDockerByScript) {
    Write-Host "🚪 Closing Docker Desktop..." -ForegroundColor Yellow
    Get-Process "Docker Desktop" -ErrorAction SilentlyContinue | Stop-Process -Force
    Get-Process "com.docker.backend" -ErrorAction SilentlyContinue | Stop-Process -Force
}

# 8. Save & Copy to Clipboard
Set-Clipboard -Value $finalText
$finalText | Out-File -FilePath $outputFile -Encoding UTF8

Write-Host "--------------------------------------------------" -ForegroundColor Cyan
Write-Host "✅ SUCCESS! All Frontend & Backend code copied to clipboard." -ForegroundColor Green
Write-Host "📂 Backup saved to: $outputFile" -ForegroundColor Green
Write-Host "--------------------------------------------------" -ForegroundColor Cyan