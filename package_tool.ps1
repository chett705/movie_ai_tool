param(
    [string]$SourceDir = $PSScriptRoot,
    [string]$OutputFile = ""
)

if (-not $OutputFile) {
    $OutputFile = Join-Path $PSScriptRoot "CineKhmer_AI_Studio.zip"
}

Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "  CineKhmer AI Studio - Packing Clean Portable Zip" -ForegroundColor Cyan
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host ""

if (Test-Path $OutputFile) {
    Write-Host "[*] Removing previous ZIP file..." -ForegroundColor Gray
    Remove-Item $OutputFile -Force
}

$sourcePath = (Resolve-Path $SourceDir).Path.TrimEnd('\')
$stagingDir = Join-Path $env:TEMP ("CineKhmer_Package_" + (Get-Random))

if (Test-Path $stagingDir) { Remove-Item $stagingDir -Recurse -Force }
New-Item -ItemType Directory -Path $stagingDir | Out-Null

$excludeMatches = @(
    "\.git",
    "\__pycache__",
    "\temp_uploads",
    "\cache_audio",
    "\.venv",
    "CineKhmer_AI_Studio.zip"
)

Write-Host "[*] Copying clean project files to staging area..." -ForegroundColor Gray

$allFiles = Get-ChildItem -Path $sourcePath -Recurse -File
foreach ($f in $allFiles) {
    $full = $f.FullName
    $skip = $false
    foreach ($pat in $excludeMatches) {
        if ($full.IndexOf($pat, [System.StringComparison]::OrdinalIgnoreCase) -ge 0) {
            $skip = $true
            break
        }
    }
    if (-not $skip) {
        $rel = $f.FullName.Substring($sourcePath.Length + 1)
        $dest = Join-Path $stagingDir $rel
        $destDir = Split-Path $dest -Parent
        if (-not (Test-Path $destDir)) { New-Item -ItemType Directory -Path $destDir -Force | Out-Null }
        Copy-Item -Path $f.FullName -Destination $dest -Force
    }
}

# Ensure empty cache_audio and temp_uploads exist with .gitkeep
New-Item -ItemType Directory -Path (Join-Path $stagingDir "cache_audio") -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $stagingDir "temp_uploads") -Force | Out-Null
"" | Out-File (Join-Path $stagingDir "cache_audio\.gitkeep") -Encoding utf8
"" | Out-File (Join-Path $stagingDir "temp_uploads\.gitkeep") -Encoding utf8

Write-Host "[*] Compressing into: $OutputFile..." -ForegroundColor Gray
Compress-Archive -Path (Join-Path $stagingDir "*") -DestinationPath $OutputFile -Force

Remove-Item $stagingDir -Recurse -Force

if (Test-Path $OutputFile) {
    $sizeMb = [math]::Round((Get-Item $OutputFile).Length / 1MB, 2)
    Write-Host ""
    Write-Host "======================================================================" -ForegroundColor Green
    Write-Host "  SUCCESS! Clean portable ZIP is ready:" -ForegroundColor Green
    Write-Host "  $OutputFile" -ForegroundColor Yellow
    Write-Host "  File Size: $sizeMb MB" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  How to use on another computer (របៀបប្រើលើកុំព្យូទ័រផ្សេង):" -ForegroundColor Cyan
    Write-Host "  1. Copy 'CineKhmer_AI_Studio.zip' to a USB Flash Drive or Google Drive."
    Write-Host "  2. Extract the ZIP on the other computer."
    Write-Host "  3. Double-click 'START_APP.bat' to start the studio with 1 click!"
    Write-Host "======================================================================" -ForegroundColor Green
}
