# Copy frontend to frontend-prediction and frontend-training

Write-Host "Creating frontend-prediction and frontend-training directories..."

# Create directories
New-Item -ItemType Directory -Path "frontend-prediction" -Force | Out-Null
New-Item -ItemType Directory -Path "frontend-training" -Force | Out-Null

Write-Host "Copying source files (excluding node_modules, .vite, dist)..."

# Copy everything except node_modules, .vite, dist
$excludeDirs = @('node_modules', '.vite', 'dist')
Get-ChildItem -Path "frontend" -Recurse | Where-Object {
    $item = $_
    $exclude = $false
    foreach ($dir in $excludeDirs) {
        if ($item.FullName -like "*\$dir\*" -or $item.Name -eq $dir) {
            $exclude = $true
            break
        }
    }
    -not $exclude
} | ForEach-Object {
    $dest = $_.FullName.Replace("frontend", "frontend-prediction")
    if ($_.PSIsContainer) {
        New-Item -ItemType Directory -Path $dest -Force | Out-Null
    } else {
        $destDir = Split-Path -Path $dest
        if (-not (Test-Path $destDir)) {
            New-Item -ItemType Directory -Path $destDir -Force | Out-Null
        }
        Copy-Item -Path $_.FullName -Destination $dest -Force
    }
}

Write-Host "Copying to frontend-training..."
Get-ChildItem -Path "frontend" -Recurse | Where-Object {
    $item = $_
    $exclude = $false
    foreach ($dir in $excludeDirs) {
        if ($item.FullName -like "*\$dir\*" -or $item.Name -eq $dir) {
            $exclude = $true
            break
        }
    }
    -not $exclude
} | ForEach-Object {
    $dest = $_.FullName.Replace("frontend", "frontend-training")
    if ($_.PSIsContainer) {
        New-Item -ItemType Directory -Path $dest -Force | Out-Null
    } else {
        $destDir = Split-Path -Path $dest
        if (-not (Test-Path $destDir)) {
            New-Item -ItemType Directory -Path $destDir -Force | Out-Null
        }
        Copy-Item -Path $_.FullName -Destination $dest -Force
    }
}

Write-Host "✓ Copy completed!"
Write-Host "  - frontend-prediction (port 5173)"
Write-Host "  - frontend-training (port 5174)"
