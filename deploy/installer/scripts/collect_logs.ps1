param(
    [string]$Destination = "",
    [switch]$IncludeServiceLogs
)

$rootPath = Join-Path $env:APPDATA "RoutingML"
$logRoot = Join-Path $rootPath "logs"
if (!(Test-Path $logRoot)) {
    Write-Host "로그 디렉터리를 찾을 수 없습니다: $logRoot"
    exit 1
}

if ([string]::IsNullOrWhiteSpace($Destination)) {
    $timestamp = (Get-Date).ToString("yyyyMMdd_HHmmss")
    $Destination = Join-Path ([Environment]::GetFolderPath('Desktop')) "RoutingMLLogs_$timestamp.zip"
}

$tempDir = Join-Path ([System.IO.Path]::GetTempPath()) "RoutingMLLogs_$(Get-Random)"
New-Item -ItemType Directory -Path $tempDir | Out-Null

Copy-Item -Path $logRoot -Destination (Join-Path $tempDir "logs") -Recurse

if ($IncludeServiceLogs) {
    $serviceLog = Join-Path $rootPath "service"
    if (Test-Path $serviceLog) {
        Copy-Item -Path $serviceLog -Destination (Join-Path $tempDir "service") -Recurse
    }
}

$settingsPath = Join-Path $rootPath "config"
if (Test-Path $settingsPath) {
    Copy-Item -Path $settingsPath -Destination (Join-Path $tempDir "config") -Recurse
}

if (Test-Path "$tempDir.zip") { Remove-Item "$tempDir.zip" -Force }
Compress-Archive -Path (Join-Path $tempDir '*') -DestinationPath $Destination -Force
Remove-Item $tempDir -Recurse -Force

Write-Host "로그가 수집되었습니다: $Destination"
