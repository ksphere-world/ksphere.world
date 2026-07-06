# ==========================================
# Kindness Chain - Code Context Generator
# ==========================================

$projectPath = "C:\Users\iamri\KC"
$outputDir = "C:\Users\iamri\Generator"
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$outputFile = Join-Path $outputDir "KC_code_$timestamp.txt"

# 1. Create Generator folder if it doesn't exist
if (-not (Test-Path $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir | Out-Null
    Write-Host "Created missing directory: $outputDir" -ForegroundColor Yellow
}

# 2. Define what files to grab (ADDED .yml, .yaml, and .md)
$validExtensions = @('.js', '.jsx', '.css', '.json', '.html', '.yml', '.yaml', '.md')

# 3. Find all files, ignoring node_modules, .git, and lock files
$files = Get-ChildItem -Path $projectPath -Recurse -File | Where-Object {
    $isValidExt = $validExtensions -contains $_.Extension
    $isNotNodeModules = $_.FullName -notmatch '\\node_modules\\'
    $isNotGit = $_.FullName -notmatch '\\.git\\'
    $isNotLock = $_.Name -ne 'package-lock.json'
    $isNotEnv = $_.Name -ne '.env' # Added this to protect your Supabase keys!
    
    $isValidExt -and $isNotNodeModules -and $isNotGit -and $isNotLock -and $isNotEnv
}

# 4. Build the output text
$outputContent = [System.Text.StringBuilder]::new()
[void]$outputContent.AppendLine("=== KINDNESS CHAIN - CURRENT CODE ===")
[void]$outputContent.AppendLine("Generated on: $(Get-Date)`n")

foreach ($file in $files) {
    # Get relative path (e.g., frontend/src/App.jsx)
    $relativePath = $file.FullName.Substring($projectPath.Length + 1)
    
    [void]$outputContent.AppendLine("--------------------------------------------------")
    [void]$outputContent.AppendLine("FILE: $relativePath")
    [void]$outputContent.AppendLine("--------------------------------------------------")
    
    $content = Get-Content $file.FullName -Raw
    [void]$outputContent.AppendLine($content)
    [void]$outputContent.AppendLine()
}

$finalText = $outputContent.ToString()

# 5. Copy to Clipboard
Set-Clipboard -Value $finalText

# 6. Save to Text File in Generator folder
$finalText | Out-File -FilePath $outputFile -Encoding UTF8

# 7. Print Success Messages
Write-Host "--------------------------------------------------" -ForegroundColor Cyan
Write-Host "✅ SUCCESS! All code copied to clipboard." -ForegroundColor Green
Write-Host "📂 Backup saved to: $outputFile" -ForegroundColor Green
Write-Host "--------------------------------------------------" -ForegroundColor Cyan